/**
 * main.tf — Infrastructure de test de charge pour Universe App
 *
 * Crée :
 *   - 1 instance monitoring (InfluxDB 2 + Grafana)
 *   - N instances agents k6 (c5.2xlarge, 2 000 VUs chacune → 10 000 VUs total)
 *   - Security groups, IAM, S3 bucket pour les rapports
 *
 * Usage :
 *   terraform init
 *   terraform plan -var="key_name=ma-cle" -var="supabase_anon_key=xxx"
 *   terraform apply -auto-approve -var="key_name=ma-cle" -var="supabase_anon_key=xxx"
 *   # après le test :
 *   terraform destroy -auto-approve -var="key_name=ma-cle" -var="supabase_anon_key=xxx"
 *
 * Coût estimé : ~3–5 $/heure (5 × c5.2xlarge + 1 × t3.medium + transfert)
 */

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ─────────────────────────────────────────────────────────────────────────────
# Data sources
# ─────────────────────────────────────────────────────────────────────────────
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ─────────────────────────────────────────────────────────────────────────────
# VPC & réseau
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_vpc" "k6" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "universe-k6-vpc" }
}

resource "aws_internet_gateway" "k6" {
  vpc_id = aws_vpc.k6.id
  tags   = { Name = "universe-k6-igw" }
}

resource "aws_subnet" "k6" {
  vpc_id                  = aws_vpc.k6.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = data.aws_availability_zones.available.names[0]
  tags = { Name = "universe-k6-subnet" }
}

resource "aws_route_table" "k6" {
  vpc_id = aws_vpc.k6.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.k6.id
  }
}

resource "aws_route_table_association" "k6" {
  subnet_id      = aws_subnet.k6.id
  route_table_id = aws_route_table.k6.id
}

# ─────────────────────────────────────────────────────────────────────────────
# Security Groups
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_security_group" "monitor" {
  name   = "universe-k6-monitor"
  vpc_id = aws_vpc.k6.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Restreindre à ton IP en prod !
  }
  ingress {
    description = "Grafana"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "InfluxDB"
    from_port   = 8086
    to_port     = 8086
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"] # interne VPC uniquement
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "universe-k6-monitor-sg" }
}

resource "aws_security_group" "agent" {
  name   = "universe-k6-agent"
  vpc_id = aws_vpc.k6.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "universe-k6-agent-sg" }
}

# ─────────────────────────────────────────────────────────────────────────────
# S3 bucket — rapports de test
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "reports" {
  bucket        = "universe-k6-reports-${random_id.suffix.hex}"
  force_destroy = true
  tags          = { Name = "universe-k6-reports" }
}

resource "random_id" "suffix" {
  byte_length = 4
}

# ─────────────────────────────────────────────────────────────────────────────
# Instance monitoring (InfluxDB 2 + Grafana)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_instance" "monitor" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.monitor_instance_type
  key_name               = var.key_name
  subnet_id              = aws_subnet.k6.id
  vpc_security_group_ids = [aws_security_group.monitor.id]

  root_block_device {
    volume_size = 50 # GB — stockage métriques InfluxDB
    volume_type = "gp3"
  }

  user_data = <<-USERDATA
    #!/bin/bash
    set -e

    # ── InfluxDB 2 ──
    dnf install -y wget
    wget -q https://dl.influxdata.com/influxdb/releases/influxdb2-2.7.6-1.x86_64.rpm
    rpm -ivh influxdb2-2.7.6-1.x86_64.rpm
    systemctl enable --now influxd

    sleep 5
    influx setup \
      --username admin \
      --password Universe2024! \
      --org universe \
      --bucket k6 \
      --retention 7d \
      --force

    # Token pour k6 → affiche dans /home/ec2-user/influx_token.txt
    influx auth create \
      --org universe \
      --all-access \
      --description "k6-writer" \
      | tail -1 | awk '{print $3}' > /home/ec2-user/influx_token.txt

    # ── Grafana ──
    cat > /etc/yum.repos.d/grafana.repo << 'EOF'
    [grafana]
    name=grafana
    baseurl=https://rpm.grafana.com
    repo_gpgcheck=1
    enabled=1
    gpgcheck=1
    gpgkey=https://rpm.grafana.com/gpg.key
    EOF
    dnf install -y grafana
    systemctl enable --now grafana-server

    echo "✅ Monitor prêt" >> /var/log/universe-setup.log
  USERDATA

  tags = { Name = "universe-k6-monitor" }
}

# ─────────────────────────────────────────────────────────────────────────────
# Agents k6
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_instance" "agent" {
  count = var.n_agents

  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.agent_instance_type
  key_name               = var.key_name
  subnet_id              = aws_subnet.k6.id
  vpc_security_group_ids = [aws_security_group.agent.id]

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  user_data = <<-USERDATA
    #!/bin/bash
    set -e

    # Augmente les limites OS pour les sockets concurrents
    echo "* soft nofile 65535" >> /etc/security/limits.conf
    echo "* hard nofile 65535" >> /etc/security/limits.conf
    sysctl -w net.ipv4.ip_local_port_range="1024 65535"
    sysctl -w net.core.somaxconn=65535

    # ── k6 ──
    dnf install -y https://dl.k6.io/rpm/k6-v0.52.0-amd64.rpm 2>/dev/null || \
      (dnf install -y wget && \
       wget -q https://github.com/grafana/k6/releases/download/v0.52.0/k6-v0.52.0-linux-amd64.tar.gz && \
       tar xzf k6-*.tar.gz && mv k6-*/k6 /usr/local/bin/)

    # Écrit les env vars pour le test
    cat > /etc/k6.env << 'ENVFILE'
    SUPABASE_URL=${var.supabase_url}
    SUPABASE_ANON=${var.supabase_anon_key}
    INFLUX_URL=http://${aws_instance.monitor.private_ip}:8086/k6
    ENVFILE

    echo "✅ Agent k6 prêt" >> /var/log/universe-setup.log
  USERDATA

  tags = { Name = "universe-k6-agent-${count.index}" }

  depends_on = [aws_instance.monitor]
}
