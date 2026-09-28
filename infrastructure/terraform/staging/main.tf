# Preliminary staging definition only.
# These null_resource entries mirror docker-compose.yml. They do not create
# networks, servers, databases, or containers. Do not treat a plan as a deploy.

resource "null_resource" "staging_network" {
  triggers = {
    source            = "docker-compose.yml"
    network_kind      = "implicit-compose-project-network"
    attached_services = "db,intelligence,backend,frontend"
  }
}

resource "null_resource" "staging_db" {
  triggers = {
    source         = "docker-compose.yml"
    service        = "db"
    container_name = "erp-db"
    image          = "postgres:16-alpine"
    host_port      = tostring(var.db_host_port)
    database_name  = var.database_name
    volume         = "pgdata"
    network        = null_resource.staging_network.id
  }
}

resource "null_resource" "staging_intelligence" {
  triggers = {
    source         = "docker-compose.yml"
    service        = "intelligence"
    container_name = "erp-intelligence"
    build_context  = "apps/intelligence-service"
    host_port      = tostring(var.intelligence_host_port)
    health_path    = var.intelligence_health_path
    network        = null_resource.staging_network.id
  }
}

resource "null_resource" "staging_backend" {
  triggers = {
    source              = "docker-compose.yml"
    service             = "backend"
    container_name      = "erp-backend"
    build_context       = "apps/backend"
    host_port           = tostring(var.backend_host_port)
    depends_on_services = "db,intelligence"
    intelligence_url    = "http://intelligence:8000"
    network             = null_resource.staging_network.id
    db                  = null_resource.staging_db.id
    intelligence        = null_resource.staging_intelligence.id
  }
}

resource "null_resource" "staging_frontend" {
  triggers = {
    source         = "docker-compose.yml"
    service        = "frontend"
    container_name = "erp-frontend"
    build_context  = "apps/frontend"
    host_port      = tostring(var.frontend_host_port)
    container_port = tostring(var.frontend_container_port)
    talks_only_to  = "backend"
    network        = null_resource.staging_network.id
    backend        = null_resource.staging_backend.id
  }
}
