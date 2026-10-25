output "status" {
  description = "This root defines staging. It has not been applied or deployed."
  value       = "defined-not-deployed"
}

output "db_endpoint" {
  description = "Intended local endpoint for the db service. Not a public staging URL."
  value       = "localhost:${var.db_host_port}"
}

output "intelligence_endpoint" {
  description = "Intended local endpoint for the intelligence service. Not a public staging URL."
  value       = "http://localhost:${var.intelligence_host_port}"
}

output "backend_endpoint" {
  description = "Intended local endpoint for the backend service. Not a public staging URL."
  value       = "http://localhost:${var.backend_host_port}"
}

output "frontend_endpoint" {
  description = "Intended local endpoint for the frontend service. Not a public staging URL."
  value       = "http://localhost:${var.frontend_host_port}"
}
