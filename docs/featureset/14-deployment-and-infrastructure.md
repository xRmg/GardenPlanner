# Feature 14: Deployment & Infrastructure

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

The deployment infrastructure enables self-hosted operation via Docker Compose. A two-container architecture serves the React SPA through nginx (with static asset caching and SPA routing) and runs the Express.js backend for API operations (settings, AI proxy, garden sync, geocoding). SQLite provides server-side persistence with automatic schema initialization.

---

## Components

| Component | File | Role |
|-----------|------|------|
| Frontend Dockerfile | `Dockerfile` | Multi-stage build: Vite → nginx:alpine |
| Backend Dockerfile | `Dockerfile.backend` | Multi-stage build: TypeScript → Node 20 Alpine |
| Docker Compose | `docker-compose.yml` | Service orchestration |
| Nginx Config | `nginx.conf` | Reverse proxy, SPA routing, caching |
| Backend Server | `backend/src/server.ts` | Express.js API server |
| Backend Routes | `backend/src/routes.ts` | API endpoint handlers |
| Backend Database | `backend/src/db.ts` | SQLite schema initialization |
| Vite Config | `vite.config.ts` | Dev server, build config, API proxy |

---

## Sub-Features

### 14.1 Backend API Server
Express.js running on Node 20, port 3000.

**Middleware**:
- Request logging with color-coded status codes
- Body parsing: JSON + URL-encoded (50MB limit)
- CORS: Open `Access-Control-Allow-Origin: *`
- Automatic OPTIONS preflight handling

**API Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check (`{ status: "ok" }`) |
| `GET` | `/api/settings` | Retrieve user settings (AI key redacted) |
| `PATCH` | `/api/settings` | Update growthZone, aiModel, locale |
| `POST` | `/api/settings/ai-key` | Validate and store OpenRouter key |
| `DELETE` | `/api/settings/ai-key` | Remove stored API key |
| `POST` | `/api/settings/location/resolve` | Geocode location → lat/lng + Köppen zone |
| `GET` | `/api/garden` | Fetch full garden state from SQLite |
| `POST` | `/api/garden/sync` | Replace garden state in SQLite (full sync) |
| `POST` | `/api/ai/chat` | OpenRouter chat completion proxy |

**Graceful shutdown**: Catches SIGTERM and SIGINT, closes database connection before exit.

### 14.2 SQLite Database
File: `backend/data/garden.db` (via `better-sqlite3` v9.2.2)

**Tables**:
| Table | Key Fields | Notes |
|-------|-----------|-------|
| `plants` | id, name, color, icon, + all plant fields | JSON columns for arrays (companions, sowMonths) |
| `areas` | id, name, profileId | Planters linked via FK |
| `planters` | id, areaId (FK → areas), name, rows, cols | squares stored as JSON blob |
| `seedlings` | id, plant (JSON), status | plant stored as full JSON object |
| `events` | id, type, date, plant (JSON) | plant optional (JSON blob) |
| `settings` | id ("default"), all settings fields | Singleton row, aiProvider stored as JSON |

**Schema initialization**: Idempotent — safe on every startup. Uses `ALTER TABLE ... ADD COLUMN` for backwards-compatible column additions. Creates default settings row if missing.

**Foreign keys**: Enforced (`ON DELETE CASCADE` for planters → areas).

### 14.3 Location Geocoding & Climate Classification
`POST /api/settings/location/resolve`:
1. **Geocoding**: Open-Meteo Geocoding API (`https://geocoding-api.open-meteo.com/v1/search`)
2. **Climate data**: 10-year historical daily temp + precipitation from Open-Meteo Archive API
3. **Köppen-Geiger classification**: Computes monthly means, runs full classification algorithm
4. Returns resolved location, lat/lng, and derived zone code (e.g., "Cfb")
5. **Fallback**: If classification fails, location saved with default zone "Cfb"

### 14.4 AI Chat Proxy
`POST /api/ai/chat`:
- Validates request against `AiChatRequestSchema`
- Retrieves stored API key from SQLite (server-only access)
- Forwards to OpenRouter with `response_format: { type: "json_object" }`
- Returns OpenRouter response unchanged
- **Logging**: Full request/response logging (message previews, token counts, finish reason)
- **Error handling**: Invalid request → 400, no key → 400, OpenRouter error → proxied status

### 14.5 Docker Deployment

**Frontend Container** (nginx:alpine):
- Multi-stage build: Node 20 Alpine → Vite build → nginx runtime
- Serves static assets from `/usr/share/nginx/html`
- Nginx handles: SPA routing, static caching (1yr, immutable), gzip, API proxy to backend

**Backend Container** (Node 20 Alpine):
- Multi-stage build: TypeScript compilation → Node runtime
- Creates `/app/data` directory for SQLite
- Runs `node dist/server.js` on port 3000

**Docker Compose**:
- Backend service: `garden-planner-backend`, health check every 30s (wget to `/health`)
- Frontend service: `garden-planner`, depends on backend (service_healthy), health check every 30s
- Network: External `pangolin` Docker network
- Volume: Named `garden-data` for SQLite persistence across restarts
- Both containers: `restart: unless-stopped`, `NODE_ENV=production`

### 14.6 Nginx Configuration
| Feature | Setting |
|---------|---------|
| SPA routing | `try_files $uri $uri/ /index.html` |
| API proxy | `/api/` → `http://backend:3000/api/` |
| Static caching | `.js`, `.css`, `.woff2`, etc. → 1 year, immutable |
| HTML caching | No-cache, must-revalidate |
| Gzip | Enabled for text/css, JS, JSON (min 1KB) |
| Max body size | 20MB |
| Keepalive | 65 seconds |
| TCP optimization | sendfile, tcp_nopush, tcp_nodelay |
| Proxy headers | Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto |

### 14.7 Development Configuration
**Vite config** (`vite.config.ts`):
- Dev server: `0.0.0.0:5173`
- API proxy: `/api` → `http://localhost:3000` (via `VITE_API_PROXY_TARGET`)
- Plugins: React, Tailwind CSS v4

**Environment variables**:
| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3000 | Backend server port |
| `NODE_ENV` | (unset) | Set to "production" in Docker |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Frontend dev proxy target |

**Scripts** (`package.json`):
| Script | Command |
|--------|---------|
| `dev` | Start Vite dev server |
| `build` | TypeScript check + Vite production build |
| `preview` | Preview production build locally |
