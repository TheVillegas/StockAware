variable "db_host_port" {
  description = "Host port published by the db service in docker-compose.yml. Default matches PG_PORT."
  type        = number
  default     = 5432
}

variable "database_name" {
  description = "PostgreSQL database name. Default matches PG_DATABASE in docker-compose.yml. Not a credential."
  type        = string
  default     = "erp_replica"
}

variable "intelligence_host_port" {
  description = "Host port published by the intelligence service. Default matches INTELLIGENCE_PORT."
  type        = number
  default     = 8000
}

variable "intelligence_health_path" {
  description = "HTTP path used by the intelligence healthcheck in docker-compose.yml."
  type        = string
  default     = "/health"
}

variable "backend_host_port" {
  description = "Host port published by the backend service. Default matches BACKEND_PORT."
  type        = number
  default     = 3000
}

variable "frontend_host_port" {
  description = "Host port published by the frontend service. Default matches FRONTEND_PORT."
  type        = number
  default     = 4200
}

variable "frontend_container_port" {
  description = "Container port that receives the frontend host mapping in docker-compose.yml."
  type        = number
  default     = 80
}
