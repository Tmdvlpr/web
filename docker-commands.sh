#!/usr/bin/env bash
# Quick commands for the CorpMeet Docker setup

# Build all images
build-all() {
    docker compose build --no-cache
}

# Start all services
start() {
    docker compose up -d
}

# Stop all services
stop() {
    docker compose down
}

# View logs
logs() {
    docker compose logs -f "$@"
}

# Rebuild and start fresh
rebuild() {
    docker compose down -v
    docker compose build --no-cache
    docker compose up -d
}

# Clean up all Docker artifacts (images, containers, volumes)
clean() {
    docker compose down -v
    docker system prune -af
}

# Database shell
db-shell() {
    docker compose exec db psql -U ${POSTGRES_USER:-corpmeet} -d ${POSTGRES_DB:-corpmeet}
}

# Backend shell
backend-shell() {
    docker compose exec backend /bin/bash
}

# View resource usage
stats() {
    docker stats corpmeet-db corpmeet-backend corpmeet-frontend corpmeet-tg-bot
}

# Health check all services
health() {
    echo "=== Database ==="
    docker compose exec db pg_isready -U ${POSTGRES_USER:-corpmeet}
    echo "=== Backend ==="
    docker compose exec backend curl -s http://localhost:8001/docs > /dev/null && echo "Backend: OK" || echo "Backend: FAILED"
    echo "=== Frontend ==="
    docker compose exec frontend curl -s http://localhost:80/ > /dev/null && echo "Frontend: OK" || echo "Frontend: FAILED"
    echo "=== Bot ==="
    docker compose exec tg-bot curl -s http://localhost:8080/health > /dev/null && echo "Bot: OK" || echo "Bot: FAILED"
}

# Show usage
usage() {
    cat << EOF
CorpMeet Docker Commands:
  build-all        Build all Docker images
  start            Start all services
  stop             Stop all services
  rebuild          Rebuild from scratch and start
  clean            Remove all Docker artifacts
  logs [service]   View logs (optional: specify service)
  stats            Show resource usage
  health           Check health of all services
  db-shell         Open PostgreSQL shell
  backend-shell    Open backend shell
  usage            Show this message
EOF
}

# Show usage if no command provided
if [[ $# -eq 0 ]]; then
    usage
    exit 0
fi

# Execute command
"$@"
