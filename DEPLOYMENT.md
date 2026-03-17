# Garden Planner Docker Deployment Guide

Garden Planner is deployed as a containerized React app using Docker and nginx. This document covers the complete deployment process on `alienlabs.eu`.

## Architecture

```
┌─────────────────────────────────────────┐
│         Docker Container (nginx)        │
│  ┌─────────────────────────────────────┐│
│  │  Garden Planner (React + Vite SPA)  ││
│  │         Served on port 80           ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### What's in the Container
- **Base image**: `nginx:alpine` (lightweight, ~40MB)
- **Build stage**: Node.js 20 Alpine → compiles React to static assets
- **Production stage**: Nginx serving the built files with proper SPA routing (all routes → index.html)
- **Health check**: HTTP check every 30s to ensure availability
- **Port**: 80 (HTTP)

## Files

- **`Dockerfile`** — Multi-stage build (Node.js → compiled assets → nginx)
- **`docker-compose.yml`** — Simple single-service setup for easy deployment
- **`nginx.conf`** — Nginx configuration with:
  - Proper SPA routing (unknown routes resolve to `/index.html`)
  - Gzip compression for CSS/JS/JSON
  - Cache headers: static assets cached 1 year, HTML not cached
  - 20MB client max body size (for potential future uploads)

## Prerequisites

On the server (`alienlabs.eu`):
- Docker installed and running
- Docker Compose v2+
- SSH access as `rmg` user
- Sufficient disk space (~500MB for image + runtime data)

## Deployment Steps

### 1. Clone or Pull Latest Code

```bash
ssh rmg@alienlabs.eu
cd /home/rmg/apps  # or wherever you want to host it

# If first time
git clone https://github.com/xRmg/GardenPlanner.git
cd GardenPlanner

# If updating existing deployment
git pull origin main
```

### 2. Build and Start the Container

```bash
docker-compose up -d --build
```

This will:
- Build the Docker image locally
- Start the `garden-planner` container in the background
- Automatically restart if it crashes
- Expose port 80

### 3. Verify Deployment

```bash
# Check container status
docker-compose ps

# View logs (last 50 lines)
docker-compose logs -n 50

# Test the app
curl http://localhost/
# or from your local machine:
curl http://alienlabs.eu/
```

### 4. Monitor Health

```bash
# Watch logs in real-time
docker-compose logs -f

# Check health status
docker inspect garden-planner --format='{{.State.Health.Status}}'
```

## Common Operations

### Stop the Container
```bash
docker-compose down
```

### Stop and Remove All Data (clean slate)
```bash
docker-compose down -v
```

### Rebuild Without Restarting
```bash
docker-compose build --no-cache
```

### View Full Logs
```bash
docker-compose logs  # entire history (up to docker's log rotation)
```

### SSH Into the Container
```bash
docker exec -it garden-planner sh
```

### Restart After Server Reboot
Docker containers are configured with `restart: unless-stopped`, so they'll auto-start on system reboot. To manually restart:
```bash
docker-compose up -d
```

## Reverse Proxy Setup (Optional)

If you want Garden Planner behind Apache/Nginx reverse proxy on the host:

```nginx
# /etc/nginx/sites-available/garden-planner
server {
    listen 443 ssl http2;
    server_name garden.alienlabs.eu;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then restart the host's nginx:
```bash
sudo systemctl restart nginx
```

## Troubleshooting

### Container fails to start
```bash
docker-compose logs garden-planner
# Look for errors in build or nginx startup
```

### Port 80 is in use
If port 80 is occupied by another service, edit `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # host:container
```
Then access via `http://alienlabs.eu:8080`

### High memory usage
Check which processes are consuming memory:
```bash
docker stats garden-planner
```
Nginx is typically lightweight; if high, check for runaway processes or increase available host RAM.

### Data persistence
This deployment stores data in two places:

- Browser IndexedDB (Dexie) for local-first UX
- Backend SQLite at `/app/data/garden.db` via the `garden-data` Docker volume

Back up both the Docker volume and user browser data export when available.

## Image Size and Performance

```
Dockerfile stages:
  Build: ~500MB (node_modules, source)
  Final: ~50MB (nginx + assets)
```

Build time: ~2-3 minutes (first time, longer on slow networks)
Container startup: ~2 seconds
Memory usage: ~10-20MB idle

## Security Notes

1. **Backend API auth (auto-configured)**: On first boot, backend generates a strong proxy auth token at `/auth/proxy-auth-token` and reuses it on subsequent boots.
2. **Shared token injection**: The `garden-planner` nginx container reads the same token file and injects it as `X-Garden-Proxy-Auth` on `/api/*` proxy requests.
3. **Gateway identity required**: Backend also requires a non-empty `X-Garden-User` identity header on all `/api/*` requests (returned as `401` with `reason: missing_gateway_identity` when absent).
4. **Gateway forwarding contract**: Configure your upstream gateway to authenticate users, overwrite `X-Forwarded-User`, and never trust client-supplied identity headers.
5. **Fail-closed backend**: Backend rejects all `/api/*` calls without valid proxy token and gateway identity.
6. **HTTPS**: Terminate TLS at host/proxy edge rather than inside the container.
7. **Open-Meteo API**: Location resolve runs through backend proxy endpoints; monitor external API usage and apply rate limiting.

## Updates

To deploy a new version:
```bash
cd /home/rmg/apps/GardenPlanner
git pull origin main
docker-compose up -d --build
```

The `--build` flag ensures the latest source is compiled into the image.

## Rollback

If a deployment breaks:
```bash
git log --oneline
git revert <commit-hash>
docker-compose up -d --build
```

Or revert to a specific tag:
```bash
git checkout v1.0.0
docker-compose up -d --build
```

## Logs and Monitoring

Nginx access and error logs are inside the container. To view them:
```bash
docker exec garden-planner tail -f /var/log/nginx/access.log
docker exec garden-planner tail -f /var/log/nginx/error.log
```

For persistent logging on the host, mount a volume in `docker-compose.yml`:
```yaml
volumes:
  - ./logs:/var/log/nginx
```

---

**Last Updated**: March 2026  
**Maintainer**: Garden Planner Team  
**Repository**: https://github.com/xRmg/GardenPlanner
