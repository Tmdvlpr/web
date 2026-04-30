#!/bin/bash

# CorpMeet Docker Commands Reference
# ==================================

# ========== BUILD ==========

# Build all images
docker compose build --pull

# Build specific service
docker compose build backend

# Build and rebuild from scratch
docker compose build --no-cache backend

# Build with custom args
docker compose build --build-arg VITE_API_URL=http://api.example.com frontend


# ========== RUN & MANAGE ==========

# Start all services in foreground
docker compose up

# Start in background
docker compose up -d

# Start and pull latest images
docker compose up --pull always

# Restart services
docker compose restart

# Restart specific service
docker compose restart backend

# Stop services
docker compose stop

# Stop and remove containers (volumes persist)
docker compose down

# Stop and remove everything including volumes
docker compose down -v

# Remove stopped containers
docker compose rm -f


# ========== LOGS & DEBUG ==========

# View all logs
docker compose logs

# Follow logs in real-time
docker compose logs -f

# Tail last 100 lines
docker compose logs --tail=100

# View logs for specific service
docker compose logs -f backend

# View logs since specific time
docker compose logs --since 2024-01-01


# ========== EXECUTE COMMANDS ==========

# Run command in running container
docker compose exec backend python -m pytest

# Interactive shell in backend
docker compose exec backend /bin/bash

# Interactive PostgreSQL shell
docker compose exec db psql -U corpmeet -d corpmeet

# Execute command without allocating TTY (non-interactive)
docker compose exec -T db pg_dump -U corpmeet corpmeet > backup.sql


# ========== INSPECT & MONITOR ==========

# Show status of all services
docker compose ps

# Show extended status
docker compose ps --all

# View real-time resource usage
docker compose stats

# Inspect specific container
docker inspect corpmeet-backend

# Check service health
docker compose exec backend curl http://localhost:8001/docs

# Validate compose file
docker compose config

# Show image size
docker images | grep corpmeet


# ========== DATABASE ==========

# Backup database
docker compose exec db pg_dump -U corpmeet corpmeet > backup.sql

# Backup with custom options
docker compose exec db pg_dump -U corpmeet -Fc corpmeet > backup.dump

# Restore database
docker compose exec -T db psql -U corpmeet corpmeet < backup.sql

# Restore from custom format
docker compose exec -T db pg_restore -U corpmeet -d corpmeet backup.dump

# Connect to database
docker compose exec db psql -U corpmeet -d corpmeet

# Run SQL query
docker compose exec db psql -U corpmeet -d corpmeet -c "SELECT version();"

# Execute SQL file
docker compose exec -T db psql -U corpmeet -d corpmeet < script.sql


# ========== CLEANUP ==========

# Remove dangling images
docker image prune -f

# Remove dangling volumes
docker volume prune -f

# Remove unused networks
docker network prune -f

# Remove all unused Docker resources
docker system prune -a

# Show disk space usage
docker system df


# ========== ENVIRONMENT ==========

# Create .env from template
cp .env.example .env

# View environment variables for service
docker compose config | grep -A 20 "backend:"

# Update environment variable
# Edit .env file and run:
docker compose up -d


# ========== DEVELOPMENT ==========

# Develop with file watching
docker compose watch

# Run tests
docker compose exec backend python -m pytest -v

# Run linting
docker compose exec backend python -m pylint app

# Install new Python package
docker compose exec backend pip install requests

# Rebuild after dependency changes
docker compose up -d --build


# ========== PRODUCTION TASKS ==========

# Pull latest images and restart
docker compose pull && docker compose up -d

# Scale backend (avoid for frontend/db)
docker compose up -d --scale backend=3

# Tag images for registry
docker tag corpmeet-backend:latest myregistry.azurecr.io/corpmeet-backend:v1.0.0

# Push to registry
docker push myregistry.azurecr.io/corpmeet-backend:v1.0.0

# Save image as tar
docker save corpmeet-backend:latest > corpmeet-backend.tar

# Load image from tar
docker load < corpmeet-backend.tar


# ========== TROUBLESHOOTING ==========

# Check health status
docker compose ps

# View detailed error logs
docker compose logs backend | grep -i error

# Inspect container configuration
docker compose exec backend env

# Check network connectivity
docker compose exec backend ping db

# Test database connection
docker compose exec backend python -c "import psycopg2; print('DB OK')"

# Find port conflicts
netstat -tulpn | grep 8001

# Kill process on port
# Linux/Mac: lsof -ti:8001 | xargs kill -9
# Windows: netstat -ano | findstr :8001

# Verify all services are healthy
docker compose ps --format "table {{.Service}}\t{{.Status}}"

# Check resource limits
docker inspect corpmeet-backend | grep -A 10 "Resources"

# View network details
docker network inspect tg_corpmeet
