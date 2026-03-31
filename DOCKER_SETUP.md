# CorpMeet Docker Setup

## Overview
This project containerizes a full-stack application with PostgreSQL, FastAPI backend, React frontend, and a Telegram bot using Docker Compose.

## Architecture

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| **db** | PostgreSQL 16 Alpine | 5432 | Database |
| **backend** | FastAPI + Uvicorn | 8001 | REST API |
| **frontend** | React + Nginx | 80 | Web UI |
| **tg-bot** | Python + aiogram | 8080 | Telegram Bot |

## Quick Start

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Development Mode

For hot reload during development, bind mount your source:

```bash
# Backend (already configured in compose for development)
docker compose up -d

# Frontend hot reload
docker compose -f docker-compose.yml up frontend

# Edit files in ./web/frontend/src and changes appear live
```

## Production Deployment

### Optimizations Applied
- **Multi-stage builds** for backend/bot (smaller images, reduced attack surface)
- **Alpine base images** (minimal bloat)
- **Non-root users** for container security
- **Resource limits** (CPU and memory constraints per service)
- **Health checks** for all services
- **Optimized .dockerignore** (faster builds, smaller contexts)
- **JSON file logging** with rotation (prevents disk bloat)
- **No new privileges** security option enabled

### Before Production Deployment

1. **Update environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Use stronger secrets:**
   ```bash
   # Generate secure tokens
   openssl rand -base64 32  # JWT_SECRET
   openssl rand -base64 16  # BOT_SECRET
   ```

3. **Configure persistence:**
   ```bash
   # Update pgdata mount path for your production storage
   PGDATA_PATH=/var/lib/corpmeet/pgdata
   ```

4. **Enable HTTPS:**
   - Use a reverse proxy (Traefik, Nginx)
   - Add SSL certificates to frontend nginx.conf

5. **Scale resources** (if needed):
   Edit `deploy.resources.limits` in `docker-compose.yml`

## Image Sizes

- **corpmeet-backend**: ~93MB (Python 3.12 slim + FastAPI)
- **corpmeet-frontend**: ~21MB (Nginx alpine + React build)
- **corpmeet-tg-bot**: ~62MB (Python 3.12 slim + aiogram)
- **postgres:16-alpine**: ~43MB

## Useful Commands

```bash
# View service logs
docker compose logs backend
docker compose logs -f --tail=100

# Database access
docker compose exec db psql -U corpmeet -d corpmeet

# Backend API docs
# Visit: http://localhost:8001/docs

# Resource monitoring
docker stats

# Clean up volumes
docker compose down -v

# Rebuild specific service
docker compose build --no-cache backend
```

## Networking

Services communicate via the `corpmeet` bridge network:
- Backend URL from frontend: `http://backend:8001`
- Backend URL from bot: `http://backend:8001`
- Frontend nginx proxies API: `location /api/ → http://backend:8001`

## Troubleshooting

### Container won't start
```bash
docker compose logs <service-name>
```

### Database connection failed
```bash
docker compose exec backend psql -U corpmeet -h db -d corpmeet
```

### Port conflicts
```bash
# Check port bindings
docker ps

# Change ports in .env
BACKEND_PORT=8002
FRONTEND_PORT=8080
```

### Out of disk space
```bash
docker system prune -a --volumes
```

## Best Practices Applied

✓ Multi-stage builds (reduce image size, dependencies, attack surface)  
✓ Alpine base images (minimal, fast)  
✓ Non-root user execution (security)  
✓ Health checks (automatic restart on failure)  
✓ Resource limits (prevent runaway containers)  
✓ Optimized .dockerignore (faster builds)  
✓ Environment variable management (.env files)  
✓ Logging configuration (JSON format, rotation)  
✓ Security options (no-new-privileges)  
✓ Proper dependency ordering (depends_on with health checks)  
