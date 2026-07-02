output "monitor_public_ip" {
  description = "IP publique du serveur Grafana/InfluxDB"
  value       = aws_instance.monitor.public_ip
}

output "grafana_url" {
  description = "URL Grafana (admin / admin — change au premier login)"
  value       = "http://${aws_instance.monitor.public_ip}:3000"
}

output "influx_url" {
  description = "URL InfluxDB pour k6 --out"
  value       = "http://${aws_instance.monitor.public_ip}:8086/k6"
}

output "agent_public_ips" {
  description = "IPs publiques des agents k6"
  value       = aws_instance.agent[*].public_ip
}

output "agent_ssh_commands" {
  description = "Commandes SSH pour accéder aux agents"
  value = [
    for i, ip in aws_instance.agent[*].public_ip :
    "ssh -i ~/.ssh/${var.key_name}.pem ec2-user@${ip}"
  ]
}

output "run_command" {
  description = "Commande pour lancer le test depuis l'agent 0"
  value = <<-CMD
    # 1. Copier le script sur l'agent 0 :
    scp -i ~/.ssh/${var.key_name}.pem scripts/k6/universe_load_test.js \
        ec2-user@${aws_instance.agent[0].public_ip}:/tmp/

    # 2. Lancer le rampup depuis l'agent 0 (segment 0/5) :
    ssh -i ~/.ssh/${var.key_name}.pem ec2-user@${aws_instance.agent[0].public_ip} \
      "source /etc/k6.env && k6 run \
        --env SUPABASE_URL=$SUPABASE_URL \
        --env SUPABASE_ANON=$SUPABASE_ANON \
        --env K6_SCENARIO=rampup \
        --execution-segment='0:1/5' \
        --execution-segment-sequence='0,1/5,2/5,3/5,4/5,1' \
        --out influxdb=$INFLUX_URL \
        /tmp/universe_load_test.js"
  CMD
}

output "s3_reports_bucket" {
  description = "Bucket S3 pour stocker les rapports CSV"
  value       = aws_s3_bucket.reports.bucket
}
