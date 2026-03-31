# 🚀 Quick Start Guide

## Prerequisites
- Docker Desktop installed and running
- 4GB+ RAM available
- Ports 80, 8001, 8080, 5432 free

## Setup

### 1. Clone & Configure
```bash
# Copy environment variables
cp .env.example .env

# Edit .env with your settings (especially secrets)
# Set VITE_API_URL for frontend API endpoint
```

### 2. Start Containers
```bash
# Start all services in background
docker compose up -d

# Watch logs in real-time
docker compose logs -f

# Check container status
docker compose ps
```

### 3. Verify Health
```bash
# All services should show "healthy" or "Up"
docker compose ps

# Check individual logs
docker compose logs db        # PostgreSQL
docker compose logs backend   # FastAPI backend
docker compose logs frontend  # Nginx frontend
docker compose logs tg-bot    # Telegram bot
```

### 4. Access Services
- **Web UI**: http://localhost:80
- **Backend API Docs**: http://localhost:8001/docs
- **Database**: localhost:5432 (psql client)

## Development Workflow

### Hot Reload (Backend)
```bash
# Terminal 1: Start compose
docker compose up

# Terminal 2: Watch for changes
docker compose watch

# Code changes auto-reload
```

### Rebuild Single Service
```bash
# Rebuild backend image
docker compose build --no-cache backend

# Restart service
docker compose restart backend
```

### View Database
```bash
# Connect with psql
psql postgresql://corpmeet:eW3lA7lU1j@localhost:5432/corpmeet

# Or use Docker
docker compose exec db psql -U corpmeet -d corpmeet
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker compose logs <service>

# Common issue: Port already in use
lsof -i :8001  # Check if port is free
```

### Database Connection Error
```bash
# Wait for DB to be ready
docker compose ps db  # Should show "healthy"

# Force restart database
docker compose restart db
```

### Frontend Shows Blank Page
```bash
# Check VITE_API_URL is correct in .env
# Clear browser cache and hard refresh (Ctrl+Shift+R)

# Check API connectivity
curl http://localhost:8001/docs
```

## Cleanup

```bash
# Stop containers
docker compose down

# Remove containers and volumes
docker compose down -v

# Remove all images
docker image rm corpmeet-backend corpmeet-frontend corpmeet-tg-bot
```

## Production Deployment

See `DOCKER_BEST_PRACTICES.md` for production checklist and recommendations.
