# 🎯 Docker Reference Card

## Quick Commands

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f backend
docker compose logs -f db
docker compose logs -f frontend
docker compose logs -f tg-bot

# Check status
docker compose ps

# Stop services
docker compose down

# Rebuild image
docker compose build backend --no-cache

# Restart service
docker compose restart backend

# Execute command in container
docker compose exec backend bash
docker compose exec db psql -U corpmeet

# View image info
docker images corpmeet-*
docker inspect corpmeet-backend:latest

# Remove images
docker image rm corpmeet-backend:test
```

## File Structure

```
.
├── docker-compose.yml           ← Main orchestration file
├── .env.example                 ← Environment template
├── .dockerignore                ← Root .dockerignore (if needed)
│
├── web/
│   ├── backend/
│   │   ├── Dockerfile           ← Multi-stage Python build
│   │   ├── .dockerignore        ← Build context exclusions
│   │   ├── requirements.txt     ← Python dependencies
│   │   ├── .env                 ← Backend secrets (git-ignored)
│   │   └── app/
│   │       └── main.py
│   │
│   └── frontend/
│       ├── Dockerfile           ← Multi-stage Node build
│       ├── .dockerignore        ← Build context exclusions
│       ├── nginx.conf           ← Nginx config (mounted in container)
│       ├── package.json         ← npm dependencies
│       └── src/
│           └── ...
│
├── tg/
│   ├── Dockerfile               ← Multi-stage Python build
│   ├── .dockerignore            ← Build context exclusions
│   ├── requirements.txt         ← Python dependencies
│   ├── .env                     ← Bot secrets (git-ignored)
│   └── bot.py
│
└── Docs/
    ├── CONTAINERIZATION_COMPLETE.md  ← This summary
    ├── DOCKER_QUICK_START.md         ← Getting started
    ├── DOCKER_BEST_PRACTICES.md      ← Production guide
    └── DOCKER_CI_CD.md               ← CI/CD & optimization
```

## Environment Variables

### Database
```bash
POSTGRES_DB=corpmeet
POSTGRES_USER=corpmeet
POSTGRES_PASSWORD=eW3lA7lU1j
DB_PORT=5432
```

### Backend
```bash
BACKEND_PORT=8001
DATABASE_URL=postgresql+asyncpg://corpmeet:eW3lA7lU1j@db:5432/corpmeet
INTERNAL_API_URL=http://backend:8001
```

### Frontend
```bash
FRONTEND_PORT=80
VITE_API_URL=http://localhost:8001/api/v1
```

### Bot
```bash
BOT_PORT=8080
TELEGRAM_BOT_TOKEN=<your_token>
BOT_SECRET=<your_secret>
TG_GROUP_CHAT_ID=<your_chat_id>
```

## Port Mappings

| Service | Port | Purpose |
|---------|------|---------|
| Frontend (Nginx) | 80 | Web UI |
| Backend (FastAPI) | 8001 | API |
| Bot | 8080 | Health check |
| Database (PostgreSQL) | 5432 | Database |

## Health Check Endpoints

| Service | Endpoint | Command |
|---------|----------|---------|
| Backend | GET /docs | `curl http://localhost:8001/docs` |
| Frontend | GET / | `curl http://localhost/` |
| Database | psql check | `docker compose exec db pg_isready -U corpmeet` |
| Bot | GET /health | `curl http://localhost:8080/health` |

## Troubleshooting Checklist

```bash
# 1. Check service status
docker compose ps

# 2. View service logs (shows errors)
docker compose logs db
docker compose logs backend
docker compose logs frontend
docker compose logs tg-bot

# 3. Verify connectivity
docker compose exec backend curl http://db:5432  # Should fail (not HTTP)
docker compose exec backend curl http://db -v    # Better diagnostic

# 4. Check resource usage
docker stats

# 5. Inspect container config
docker inspect corpmeet-backend

# 6. Verify environment variables
docker compose exec backend env | grep DATABASE_URL

# 7. Test database connection
docker compose exec backend python -c "import asyncpg; print('OK')"

# 8. Hard reset (careful!)
docker compose down -v  # Removes all volumes
```

## Performance Tuning

### Increase resource limits
```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
```

### Enable BuildKit for faster builds
```bash
export DOCKER_BUILDKIT=1
docker compose build
```

### Prune unused resources
```bash
docker system prune -a --volumes
```

## Security Checklist

- [ ] Secrets stored in `.env` (never committed)
- [ ] `.env` added to `.gitignore`
- [ ] Non-root users in all containers (verified: `appuser:1000`)
- [ ] Health checks enabled
- [ ] Log rotation configured (10MB max, 3 files)
- [ ] Resource limits set
- [ ] Regular backups of `/var/lib/postgresql/data`

## Development Workflow

### Option 1: Watch Mode (Recommended)
```bash
docker compose up -d
docker compose watch  # Auto-reloads on file changes
```

### Option 2: Manual Rebuild
```bash
# Edit code
# Rebuild image
docker compose build backend
# Restart service
docker compose restart backend
# View logs
docker compose logs -f backend
```

### Option 3: Direct Container Access
```bash
# Shell into container
docker compose exec backend bash

# View live logs
docker compose exec backend tail -f app.log

# Run commands directly
docker compose exec backend python -m pytest
```

## Useful Links

- Docker Compose docs: https://docs.docker.com/compose/
- Dockerfile reference: https://docs.docker.com/reference/dockerfile/
- Docker CLI reference: https://docs.docker.com/reference/cli/docker/
- Best practices: https://docs.docker.com/develop/dev-best-practices/

---

**Last Updated**: 2026-03-30
**Status**: ✅ All services containerized and tested
**Images Built**: 3 (backend, frontend, bot)
**Compose Validation**: ✅ Passed
