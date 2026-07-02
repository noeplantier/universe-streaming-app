variable "aws_region" {
  description = "AWS region pour les agents k6"
  default     = "eu-west-3" # Paris — proche de Supabase EU
}

variable "key_name" {
  description = "Nom de la paire de clés SSH AWS existante"
  type        = string
}

variable "n_agents" {
  description = "Nombre d'agents k6 (2 000 VUs par agent recommandé)"
  default     = 5
}

variable "agent_instance_type" {
  description = "Type EC2 pour les agents k6 (c5.2xlarge = 8 vCPUs, 16 GB RAM)"
  default     = "c5.2xlarge"
}

variable "monitor_instance_type" {
  description = "Type EC2 pour InfluxDB + Grafana"
  default     = "t3.medium"
}

variable "supabase_anon_key" {
  description = "Clé anon Supabase (passée aux agents via env)"
  type        = string
  sensitive   = true
}

variable "supabase_url" {
  description = "URL du projet Supabase"
  default     = "https://knrzbdqfflobfjdmqyte.supabase.co"
}
