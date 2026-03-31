# Docker Build Optimization & CI/CD

## Build Performance Tips

### 1. Leverage Build Cache
```bash
# Use BuildKit for better caching
export DOCKER_BUILDKIT=1

# Build with cache from previous images
docker build -t corpmeet-backend:latest ./web/backend
```

### 2. Parallel Builds
```bash
# Build all images in parallel
docker compose build

# Or use buildx for multi-platform builds
docker buildx build --platform linux/amd64,linux/arm64 \
  -t corpmeet-backend:latest ./web/backend
```

### 3. Reduce Image Size
```bash
# Check image sizes
docker images | grep corpmeet

# Analyze layers
docker history corpmeet-backend:latest
```

### 4. CI/CD Pipeline Example (GitHub Actions)

Create `.github/workflows/docker.yml`:
```yaml
name: Build and Push Docker Images

on:
  push:
    branches: [main, develop]
    paths:
      - 'web/backend/**'
      - 'web/frontend/**'
      - 'tg/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push backend
        uses: docker/build-push-action@v4
        with:
          context: ./web/backend
          push: true
          tags: |
            yourusername/corpmeet-backend:latest
            yourusername/corpmeet-backend:${{ github.sha }}
          cache-from: type=registry,ref=yourusername/corpmeet-backend:buildcache
          cache-to: type=registry,ref=yourusername/corpmeet-backend:buildcache,mode=max
      
      - name: Build and push frontend
        uses: docker/build-push-action@v4
        with:
          context: ./web/frontend
          push: true
          tags: |
            yourusername/corpmeet-frontend:latest
            yourusername/corpmeet-frontend:${{ github.sha }}
          build-args: |
            VITE_API_URL=https://api.example.com
          cache-from: type=registry,ref=yourusername/corpmeet-frontend:buildcache
          cache-to: type=registry,ref=yourusername/corpmeet-frontend:buildcache,mode=max
      
      - name: Build and push bot
        uses: docker/build-push-action@v4
        with:
          context: ./tg
          push: true
          tags: |
            yourusername/corpmeet-tg-bot:latest
            yourusername/corpmeet-tg-bot:${{ github.sha }}
          cache-from: type=registry,ref=yourusername/corpmeet-tg-bot:buildcache
          cache-to: type=registry,ref=yourusername/corpmeet-tg-bot:buildcache,mode=max
```

### 5. Local Testing Before Push
```bash
# Test image locally
docker run -it corpmeet-backend:test python app/main.py

# Validate compose
docker compose config  # Check for syntax errors

# Dry-run compose
docker compose up --dry-run
```

### 6. Security Scanning
```bash
# Scan images for vulnerabilities (requires Docker Scout)
docker scout cves corpmeet-backend:latest

# Or use Trivy
trivy image corpmeet-backend:latest
```

### 7. Registry Cleanup
```bash
# Remove unused images and build cache
docker image prune -a --force
docker builder prune --all --force

# Remove dangling volumes
docker volume prune --force
```

## Build Arguments for Different Environments

### Development
```bash
docker build \
  --build-arg VITE_API_URL=http://localhost:8001/api/v1 \
  -t corpmeet-frontend:dev ./web/frontend
```

### Staging
```bash
docker build \
  --build-arg VITE_API_URL=https://staging.example.com/api/v1 \
  -t corpmeet-frontend:staging ./web/frontend
```

### Production
```bash
docker build \
  --build-arg VITE_API_URL=https://api.example.com/api/v1 \
  -t corpmeet-frontend:1.0.0 ./web/frontend
```

## Performance Benchmarks

Build times (cold cache):
- Backend: ~100-120s (includes pip install all dependencies)
- Frontend: ~15-20s (npm ci + vite build)
- Bot: ~40-50s (pip install dependencies)

Rebuild times (warm cache):
- Backend: ~2-3s (code copy only)
- Frontend: ~1-2s (npm already cached)
- Bot: ~1-2s (code copy only)

## Multi-Platform Builds

Build for ARM64 (Apple Silicon, Raspberry Pi):
```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yourusername/corpmeet-backend:latest \
  --push ./web/backend
```

Note: Requires buildx setup and registry push.
