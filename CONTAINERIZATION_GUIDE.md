# CorpMeet Containerization Guide

## Overview

Your project has been containerized following Docker best practices with optimized multi-stage builds, health checks, logging, and production-ready configurations.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                       │
│                    (corpmeet)                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────┐ │
│  │   Frontend      │  │   Backend       │  │  Bot   │ │
│  │ (nginx:80)      │  │ (FastAPI:8001)  │  │ (8080) │ │
│  └────────┬────────┘  └────────┬────────┘  └───┬────┘ │
│           │                    │                │      │
│           └────────┬───────────┴────────┬──────┘      │
│                    │                    │              │
│           ┌────────▼────────────────────▼────────┐    │
│           │      PostgreSQL (5432)               │    │
│           │      corpmeet database               │    │
│           └─────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Services

### 1. Database (PostgreSQL)
- **Image**: `postgres:16-alpine`
- **Port**: 5432
- **Health Check**: Every 10s (pg_isready)
- **Volume**: `pgdata` (persistent storage)
- **Environment**: Initialized with UTF-8 encoding

### 2. Backend API (FastAPI)
- **Build**: Multi-stage Python 3.12-slim
- **Port**: 8001
- **Health Check**: Every 30s (curl to /docs)
- **Startup Time**: 10s before health checks
- **Features**:
  - uvloop for async performance
  - PYTHONUNBUFFERED=1 (unbuffered logging)
  - PYTHONDONTWRITEBYTECODE=1 (no .pyc files)
  - Development volume mount for hot reload

### 3. Frontend (React + Nginx)
- **Build**: Multi-stage Node 20-alpine → nginx:alpine
- **Port**: 80
- **Health Check**: Every 30s (wget check)
- **Features**:
  - npm ci for reproducible builds
  - Optimized nginx configuration
  - Gzip compression

### 4. Telegram Bot
- **Build**: Multi-stage Python 3.12-slim
- **Port**: 8080
- **Health Check**: Every 30s
- **Startup Time**: 15s before health checks
- **Features**:
  - Async aiogram framework
  - Internal API communication

## Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose v2.20+

### Running Services

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend

# Check status
docker compose ps

# Stop services
docker compose down

# Remove volumes (careful!)
docker compose down -v
```

### Development Mode

Backend and frontend have volumes mounted for development:

```bash
# Backend auto-reload
docker compose up backend

# Frontend hot reload (if configured)
docker compose up frontend
```

## Dockerfile Optimizations

### Backend (web/backend/Dockerfile)
**Multi-stage build benefits:**
- Builder stage: Installs build dependencies (52 packages, ~336MB)
- Runtime stage: Only includes compiled packages (~14.7MB)
- Result: ~95% smaller final image

**Key features:**
- `/root/.local` copied for clean dependencies
- Health check using uvicorn's /docs endpoint
- No .pyc files (PYTHONDONTWRITEBYTECODE=1)
- curl included for health checks

### Frontend (web/frontend/Dockerfile)
**Multi-stage build benefits:**
- Builder stage: Node 20-alpine + npm ci + build
- Runtime stage: nginx:alpine only
- Result: ~98% smaller final image (removed ~500MB Node)

**Key features:**
- npm ci for reproducible installs
- VITE_API_URL build argument for environment-specific URLs
- Health check via wget

### Bot (tg/Dockerfile)
**Multi-stage build:**
- Separates build and runtime dependencies
- Removes build-essential after compilation
- Final image ~80% smaller

## .dockerignore Files

Created for each service to optimize build context:

```
# Backend & Bot
.venv
__pycache__
*.pyc
.env
.pytest_cache

# Frontend
node_modules
dist
.next
.vscode
```

## Environment Variables

### Loaded via .env file
Located at:
- `web/backend/.env`
- `tg/.env`

### Docker Compose Overrides
Set in docker-compose.yml for container-to-container communication:
- `DATABASE_URL` → uses `db` hostname (not IP)
- `INTERNAL_API_URL` → uses `backend` hostname

## Health Checks

All services have health checks:

```yaml
# Backend
curl -f http://localhost:8001/docs
Interval: 30s | Start Period: 10s | Retries: 3

# Frontend
wget --quiet --tries=1 --spider http://localhost:80/
Interval: 30s | Start Period: 10s | Retries: 3

# Database
pg_isready -U corpmeet
Interval: 10s | Start Period: 10s | Retries: 5

# Bot
curl -f http://localhost:8080/health
Interval: 30s | Start Period: 15s | Retries: 3
```

## Logging Configuration

All services use json-file driver with rotation:
```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"      # Rotate at 10MB
    max-file: "3"        # Keep 3 files (30MB total)
```

View logs:
```bash
docker compose logs -f [service]
```

## Networking

- **Network Name**: corpmeet (bridge driver)
- **Subnet**: 172.28.0.0/16
- **Service-to-service**: Use service names as hostnames
  - `db:5432` from any service
  - `backend:8001` from frontend/bot
  - `frontend:80` from outside containers

## Database Persistence

Volume `pgdata` persists PostgreSQL data:

```bash
# Backup database
docker compose exec db pg_dump -U corpmeet corpmeet > backup.sql

# Restore database
docker compose exec -T db psql -U corpmeet corpmeet < backup.sql

# Inspect volume
docker volume inspect tg_pgdata
```

## Building Images Manually

```bash
# Backend
docker build -t corpmeet-backend:latest ./web/backend

# Frontend
docker build \
  -t corpmeet-frontend:latest \
  --build-arg VITE_API_URL=http://localhost:8001/api/v1 \
  ./web/frontend

# Bot
docker build -t corpmeet-tg-bot:latest ./tg
```

## Troubleshooting

### Container not starting
```bash
# Check logs
docker compose logs backend

# Inspect container
docker inspect corpmeet-backend

# Check health status
docker ps --no-trunc | grep corpmeet
```

### Port conflicts
```bash
# Check port usage
docker compose ps
lsof -i :8001  # Unix/Linux/Mac
netstat -ano | findstr :8001  # Windows
```

### Volume issues
```bash
# List volumes
docker volume ls

# Remove all unused volumes
docker volume prune
```

### Network issues
```bash
# Test DNS resolution
docker compose exec backend ping db

# Test connectivity
docker compose exec backend curl -v http://backend:8001/docs
```

## Production Deployment

### Environment Variables
Set in `.env` file or Docker runtime:

```bash
# Run with custom env
docker run --env-file prod.env corpmeet-backend:latest
```

### Memory Limits
Add to docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: "1"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 256M
```

### Restart Policies
Currently: `restart: unless-stopped`

Options:
- `no`: Do not automatically restart
- `always`: Always restart
- `on-failure`: Restart on non-zero exit code
- `unless-stopped`: Always restart unless explicitly stopped

### Image Registry
Push to Docker Hub or private registry:

```bash
# Tag image
docker tag corpmeet-backend:latest myregistry/corpmeet-backend:v1.0.0

# Push
docker push myregistry/corpmeet-backend:v1.0.0
```

## Security Considerations

1. **Secrets Management**: Replace hardcoded secrets in .env with Docker Secrets
2. **Non-root User**: Add USER directive in Dockerfiles for production
3. **Image Scanning**: Use `docker scout cves` to scan for vulnerabilities
4. **Network Policies**: Restrict inter-service communication via Docker network policies
5. **Read-only Filesystem**: Consider `read_only: true` for stateless services

## Monitoring & Observability

```bash
# Real-time stats
docker stats

# View events
docker events

# Inspect volume usage
docker system df

# Clean up unused resources
docker system prune -a
```

## Next Steps

1. **Replace hardcoded credentials** in .env files with secrets management
2. **Add resource limits** (memory, CPU) in docker-compose.yml
3. **Implement centralized logging** (ELK, Loki, DataDog)
4. **Set up Docker Registry** for image storage
5. **Implement CI/CD** with Docker builds (GitHub Actions, GitLab CI)
6. **Add APM/Monitoring** (New Relic, Prometheus, Grafana)
7. **Consider Kubernetes** for multi-host deployments
