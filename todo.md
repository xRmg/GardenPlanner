# Garden Planner — Planning & TODO Document

> **Created**: 2026-02-25
> **Status**: Phase 1 in progress — 1.1 ✅ schemas · 1.2 ✅ repository interface + LocalStorageRepository · 1.3 ✅ DexieRepository · 1.4 ✅ localStorage→Dexie migration · 1.12 ✅ Vitest + test suite
> **Purpose**: Roadmap for evolving Garden Planner from a local-only "dumb" tool into a smart, AI-assisted, multi-language, multi-user platform.

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Product Deployment Tiers & Vision](#2-product-deployment-tiers--vision)
3. [Tech Stack & Persistence](#3-tech-stack--persistence)
4. [Dumb vs Smart Mode — AI Integration](#4-dumb-vs-smart-mode--ai-integration)
5. [Shared Plant Library](#5-shared-plant-library)
6. [Internationalization (i18n)](#6-internationalization-i18n)
7. [Identified Gaps & Missed Items](#7-identified-gaps--missed-items)
8. [Phased Roadmap](#8-phased-roadmap)
9. [TODO Checklist](#9-todo-checklist)

---

## 1. Current State Assessment

### Tech Stack

| Layer       | Technology                                                                            |
| ----------- | ------------------------------------------------------------------------------------- |
| Framework   | React 19.1 + TypeScript 5.7                                                           |
| Build       | Vite 6.3                                                                              |
| Styling     | Tailwind CSS 4 + shadcn/ui (Radix primitives)                                         |
| Validation  | Zod v4.3 (installed but barely used)                                                  |
| Persistence | `localStorage` (4 keys: `gp_areas`, `gp_customPlants`, `gp_seedlings`, `gp_settings`) |
| Backend     | **None**                                                                              |
| Auth        | **None**                                                                              |
| i18n        | **None**                                                                              |

### Architecture Issues

- **Monolithic `App.tsx`** (~1,548 lines) — all state, persistence, and business logic in one file
- **No data access layer** — `localStorage.getItem/setItem` inline in `useState` initializers
- **Hardcoded plant data** — 12 `DEFAULT_PLANTS` defined as a const array in `App.tsx`
- **Static suggestions** — 3 hardcoded water/weed/compost suggestions, never updated
- **No state management** — everything is `useState` + prop drilling
- **5-10 MB localStorage limit** — will break with images or large gardens

### Data Model (Current)

```
Area { id, name, tagline, backgroundColor, planters[] }
  └─ Planter { id, name, rows, cols, virtualSections[], backgroundColor, tagline }
       └─ PlanterSquare { plantInstance }
            └─ PlantInstance { instanceId, plant, plantingDate, harvestDate, variety, pestEvents[] }

Plant { id, name, color, icon, description, variety, daysToHarvest, spacingCm,
        frostHardy, sunRequirement, sowIndoorMonths[], sowDirectMonths[],
        harvestMonths[], companions[], antagonists[], isSeed, amount }

Seedling { id, plant, plantedDate, seedCount, location, method, status }

Settings { location, growthZone, weatherProvider }

Events: planted | watered | composted | weeded | harvested | sown | sprouted
Suggestions: water | harvest | repot | compost | weed  (with priority)
```

---

## 2. Product Deployment Tiers & Vision

> This vision defines **how the app will be packaged and distributed** at each stage. All architectural decisions in later sections should be made with future tiers in mind, so that upgrading from one tier to the next requires evolution, not rewrites.

### Tier Overview

```
Tier 1  ──▶  Tier 2  ──▶  Tier 3  ──▶  Tier 4
Local         Local +       Local +       Hosted
(free)        Plant DB      Central AI    (paid $$)
              (free/opt)    Engine (paid $)

Auth modes per tier:

Tier 1–3 (local):          Tier 4 (hosted):
  1a. No auth (open)          4a. Single user
  1b. Single-user protected   4b. Team / Family (3–5)
  1c. Multi-user (3–5)        4c. Community (stretch goal)
```

---

### User & Auth Models

Auth requirements differ sharply between the local and hosted worlds. Because both ends of the spectrum share the same codebase, the `GardenRepository` interface and data schema must carry a **profile/user context from day one**, even when auth is disabled.

#### Local Deployment (Tiers 1–3)

| Mode                            | Description                                                                                                                                                                       | Who it's for                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **1a — Open (no auth)**         | App opens directly, no login. Single implicit profile. Data lives in the browser only.                                                                                            | Solo user on a personal device                      |
| **1b — Single-user protected**  | A password/PIN gate at app load. No accounts — just a hashed password stored locally. One garden owner.                                                                           | Private install on a shared household device        |
| **1c — Multi-user local (3–5)** | Multiple named profiles selectable at app load. Each profile has isolated garden data. Per-area roles: **Owner / Editor / Viewer**. No server required — all stored in IndexedDB. | Small household, allotment partners, school project |

**Key rules for local auth:**

- No JWTs, no sessions, no server. Profile selection is a local UI gate.
- Multi-user local (1c) uses namespaced IndexedDB data (`areas:{profileId}`, `plants:{profileId}`).
- Passwords are hashed (bcrypt/argon2) and stored locally — never sent anywhere.
- An area owner can set other profiles as Editor or Viewer on a per-area basis.
- Profile management (add/remove/rename) is available in Settings but only to the Owner profile.

#### Hosted Deployment (Tier 4)

| Mode                              | Description                                                                                                                                                                                                     | Who it's for                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **4a — Single user**              | One account, all gardens belong to that user. Optional free tier with limits (e.g. 1 garden, no AI).                                                                                                            | Individual                                                    |
| **4b — Team / Family (3–5)**      | Shared workspace. Members collaborate on gardens. Per-area roles: **Owner / Editor / Viewer**. Invite by email.                                                                                                 | Family, small urban farm, micro-allotment group               |
| **4c — Community (stretch goal)** | A community workspace with 10–100 members. The community owns gardens and grants members access to individual gardens (not all gardens). Fine-grained: a user can be Viewer of Garden A and Editor of Garden B. | Allotment societies, community gardens, schools, maker spaces |

**Key rules for hosted auth:**

- Supabase Auth handles identity (email/password + optional OAuth).
- All DB tables carry a `workspace_id` + `user_id`; RLS enforces boundaries.
- **Area-level roles** (`area_members` join table: `area_id`, `user_id`, `role`) — same model used for both Team and Community tiers, just different scale limits.
- Community workspaces have a `workspace_members` table (workspace-level role) AND `area_members` (garden-level role). A community admin manages workspace membership; garden owners manage area membership independently.
- Max user limits are enforced at the backend (not in the client) and are plan-dependent.

#### Role Model (shared across all auth modes)

```
Owner   — full control: edit garden, manage members, delete
Editor  — can add/move/remove plants, log events, update seedlings
Viewer  — read-only: can see the garden but not change anything
```

Using the same three roles locally and in the cloud means the UI permission checks (`canEdit(area, currentUser)`) work identically in every tier.

---

### Tier 1 — Local Deploy, Optional AI (First Version)

**Tagline**: _Your garden, on your machine. AI is a bonus._

| Dimension         | Detail                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Deployment**    | **Self-hosted Docker container** — `docker compose up`. Nginx serves the React bundle. No cloud account required.                |
| **Persistence**   | `localStorage` (now) → IndexedDB/Dexie (Phase 1 upgrade)                                                                         |
| **Auth**          | Choose one: **1a** open (no auth) · **1b** single-user PIN/password · **1c** multi-profile (3–5 users, per-area roles)           |
| **AI**            | Optional BYOK — set via `.env` at deploy time (Docker) or pasted in Settings (bare browser). If absent, app runs in "Dumb Mode". |
| **Plant library** | Bundled defaults (12 plants) + manual user additions                                                                             |
| **Cost to user**  | Free. AI costs are whatever the user pays OpenRouter directly.                                                                   |
| **Who is it for** | Self-hosters, hobbyists, privacy-first users, early adopters                                                                     |

**Architecture implications** (build for this from day one):

- The `GardenRepository` interface must work 100% offline with no external calls
- All AI calls must be optional — every feature must have a non-AI fallback
- Settings must have a clean `aiProvider: { type: 'byok' | 'proxy' | 'none', key?: string }` field
- The app must be deployable as a static site (no SSR requirement) — served by nginx inside the Docker container, not opened as a raw file
- **Start with mode 1a** (no auth) but structure data with a `profileId` field in the DB schema so 1b/1c is a config flip, not a migration
- Permission checks (`canEdit`, `canView`) must be centralised from day one — even when they always return `true` in open mode

---

### Tier 2 — Local Deploy + Central Plant Database (Future)

**Tagline**: _Your garden, local. Plant knowledge, shared._

| Dimension         | Detail                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| **Deployment**    | Same Docker host as Tier 1. Plant library API is an additional container or opt-in remote endpoint.     |
| **Persistence**   | IndexedDB/Dexie locally. Plant library pulled from central API + cached locally.                        |
| **AI**            | Still BYOK (same as Tier 1) — optional, user-supplied key                                               |
| **Plant library** | Pulls from central REST API (`GET /api/plants`). Delta sync. Falls back to bundled defaults if offline. |
| **Cost to user**  | Free. Central plant API is free to use (community-funded or low-cost hosted).                           |
| **Who is it for** | Same users as Tier 1, who want better/richer plant data without manual entry                            |

**Architecture implications**:

- `plantLibrary.ts` service must have a configurable `baseUrl` (defaults to bundled data, overridable in Settings)
- Plant data must have `source: 'bundled' | 'synced' | 'custom'` so the app knows what to overwrite on sync
- The central plant API must be **read-only** from the client's perspective at this tier (no auth needed)
- Sync failures must be silent — never block the user from using the app

---

### Tier 3 — Local Deploy + Central AI Engine (Far Future · Paid $)

**Tagline**: _Your garden, local. Intelligence, centrally powered._

| Dimension         | Detail                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Deployment**    | Same Docker host as Tier 1/2. AI calls route to a hosted proxy instead of OpenRouter directly.                            |
| **Persistence**   | IndexedDB/Dexie locally. May sync anonymised garden events to backend for AI context.                                     |
| **AI**            | Centrally managed — no user API key needed. User subscribes to a plan. AI proxy handles routing, rate limiting, and cost. |
| **Plant library** | Same as Tier 2, now AI-powered contributions (users submit, AI validates)                                                 |
| **Cost to user**  | Paid subscription or credits. E.g. €2–5/month for AI-enhanced suggestions.                                                |
| **Who is it for** | Serious gardeners who want the full smart experience without managing API keys                                            |

**Architecture implications**:

- `aiProvider` in Settings must support `type: 'proxy'` with a `proxyUrl` and an auth `token`
- The backend proxy (Hono/Cloudflare Workers) must support JWT auth and per-user rate limiting
- Garden context sent to the AI must be **anonymised** — no PII, configurable opt-out
- Subscription/billing integration (Stripe or LemonSqueezy) — only the backend touches payment details, never the client
- The app should work identically in Tier 1 BYOK mode if the user cancels their subscription

---

### Tier 4 — Hosted Version (Far Far Future · Paid $$)

**Tagline**: _Sign up and grow. No install needed._

| Dimension         | Detail                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| **Deployment**    | SaaS — hosted at `gardenplanner.app` (or similar). User signs in, data lives in cloud.                        |
| **Persistence**   | Postgres (Supabase) per user. Dexie as local cache with bi-directional sync. Works offline.                   |
| **Auth**          | **4a** single user · **4b** team/family (3–5, per-area roles) · **4c** community (10–100, stretch goal)       |
| **AI**            | Central AI engine (Tier 3 backend), included in subscription.                                                 |
| **Plant library** | Shared, community-curated, fully translated.                                                                  |
| **Cost to user**  | Paid subscription. Free tier with limits (e.g. 1 garden, 1 user, no AI).                                      |
| **Who is it for** | **4a/4b**: mainstream users wanting zero-setup + cross-device. **4c**: societies, schools, community gardens. |

**Architecture implications**:

- Supabase Auth handles identity; all DB tables carry `workspace_id` + `user_id` with RLS from day one
- The `GardenRepository` interface (designed in Tier 1) becomes the sync boundary — local Dexie ↔ remote Postgres
- **`area_members` table** (`area_id`, `user_id`, `role`) is the single permission source for both Team and Community modes
- Community (4c) adds a `workspace_members` table for workspace-level roles; garden-level `area_members` is a separate, independent layer
- Scale limits (max 5 for Team, max 100 for Community) are enforced at the API layer, not in client code
- The hosted version is the **same codebase** as the local version, just with different runtime config

---

### Cross-Tier Architecture Principles

These principles must be respected at every tier to avoid rewrites:

| Principle                    | Meaning                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Config-driven capability** | Features are enabled/disabled via a `capabilities` config object, not `if (tier === 3)` checks           |
| **Repository pattern**       | All data access goes through `GardenRepository`. Swap implementation without touching UI.                |
| **Service abstraction**      | `aiService`, `weatherService`, `plantLibraryService` are interfaces. Each tier swaps the implementation. |
| **Offline first**            | Every feature must function without internet. External calls are enhancements, never requirements.       |
| **No PII in AI calls**       | Garden context sent to AI is stripped of identifying info at the service layer                           |
| **Feature flags**            | A `features.ts` config file controls which capabilities are active — makes tier upgrades a config change |

#### Example `features.ts` (drives UI + service selection)

```typescript
// app/config/features.ts
export interface AppCapabilities {
  ai: {
    enabled: boolean;
    provider: "none" | "byok" | "proxy";
    proxyUrl?: string;
  };
  plantLibrary: {
    syncEnabled: boolean;
    apiUrl?: string;
  };
  auth: {
    // Local modes: no server required
    // 'none'         → open, no login (Tier 1a)
    // 'local-single' → PIN/password gate, one owner (Tier 1b)
    // 'local-multi'  → multi-profile selector, per-area roles (Tier 1c)
    // 'supabase'     → full cloud auth, used for Tier 4
    mode: "none" | "local-single" | "local-multi" | "supabase";
  };
  userModel: {
    // 'solo'      → single user / single profile
    // 'team'      → up to maxUsers collaborators, per-area roles
    // 'community' → workspace-level membership + per-garden access grants
    type: "solo" | "team" | "community";
    maxUsers?: number; // 3–5 for team, 10–100 for community
  };
  sync: {
    enabled: boolean;
  };
}

// Tier 1a defaults — open, single user, no auth, no sync (ships with the app)
export const DEFAULT_CAPABILITIES: AppCapabilities = {
  ai: { enabled: false, provider: "none" },
  plantLibrary: { syncEnabled: false },
  auth: { mode: "none" },
  userModel: { type: "solo" },
  sync: { enabled: false },
};
```

---

## 3. Tech Stack & Persistence

### 2.1 Persistence Options Comparison

| Feature        | localStorage | Dexie (IndexedDB)  | SQLite WASM           | Supabase | PocketBase       | Firebase           |
| -------------- | ------------ | ------------------ | --------------------- | -------- | ---------------- | ------------------ |
| Offline        | ✅           | ✅                 | ✅                    | ❌       | ❌               | ✅                 |
| Sync           | ❌           | ⚠️ (paid Cloud)    | ✅ (cr-sqlite)        | ✅       | ⚠️               | ✅                 |
| Scale          | ❌ (5MB)     | ✅ (100s MB)       | ✅ (millions of rows) | ✅       | ⚠️ (single node) | ✅                 |
| Shared library | ❌           | ⚠️ (needs backend) | ✅                    | ✅       | ✅               | ⚠️ (NoSQL awkward) |
| Auth built-in  | ❌           | ⚠️                 | ❌                    | ✅       | ✅               | ✅                 |
| Bundle cost    | 0 KB         | ~15 KB             | ~800 KB               | ~30 KB   | ~20 KB           | ~80 KB             |
| Vendor lock-in | None         | Low                | None                  | Medium   | None             | High               |

### 2.2 Recommendation: Dexie.js v4 (Phase 1) → Supabase (Phase 3)

#### Why not SQLite WASM?

SQLite WASM might seem appealing ("same SQL as Postgres = easier migration"), but it's a false economy here:

- **Dexie stays in Tier 4** — it becomes the local cache that syncs to Postgres. The client never migrates _away_ from Dexie; Postgres is added alongside it.
- **No raw SQL to reuse** — the `GardenRepository` interface abstracts all data access. Business logic never writes queries, so the "SQL portability" argument doesn't apply.
- **Postgres schema is written fresh anyway** — it needs `workspace_id`, RLS policies, and different column names. No SQLite schema carries over.
- **Serious setup cost** — ~800 KB bundle (vs Dexie's ~15 KB), requires `SharedArrayBuffer` → mandatory `COOP`/`COEP` HTTP headers, OPFS for persistence. All avoidable complexity for a Tier 1 local app.
- **The one real SQLite WASM win** — `cr-sqlite` for peer-to-peer CRDT sync without a server — is not in this roadmap.

**Conclusion**: Dexie is the right call. SQLite WASM would be 50× the bundle size for no practical benefit.

---

**Phase 1** — Migrate from localStorage to **Dexie.js v4** (IndexedDB wrapper):

- Clean async API with React hook `useLiveQuery()`
- Structured tables with indexes instead of JSON blobs
- ~15 KB bundle, wide browser support
- One-time auto-migration from existing localStorage data
- Export/import JSON for data portability

**Phase 2** — Add **Hono v4 on Cloudflare Workers** as lightweight backend:

- AI proxy (hides OpenRouter API key)
- Weather API proxy
- Shared plant library via Cloudflare D1 (managed SQLite)
- Free tier: 100K requests/day

**Phase 3** — Add **Supabase** for auth + multi-user sync:

- Supabase Auth (email, OAuth)
- Postgres for per-user gardens
- Dexie remains as local cache with a sync adapter
- RLS (Row-Level Security) for data isolation

### 2.3 API Key Security

OpenRouter API keys **cannot** be exposed in the frontend bundle.

| Approach                         | When     | Pros                                         | Cons                      |
| -------------------------------- | -------- | -------------------------------------------- | ------------------------- |
| **BYOK** (user provides own key) | Phase 1  | Zero backend, user controls spend            | Bad UX for non-tech users |
| **Cloudflare Worker proxy**      | Phase 2+ | Free tier (100K req/day), key in env secrets | Need to deploy a worker   |
| **Supabase Edge Function**       | Phase 3  | All-in-one if using Supabase already         | Tied to Supabase          |

**Plan**: Start with BYOK in Settings, migrate to Worker proxy when backend lands.

#### BYOK Key Storage (Phase 1)

There are two deployment contexts with different UX for the API key:

**Docker self-hosted (primary case)**
The person deploying the container is also the user (or manages it for their household). The key goes in `.env` at deploy time and is injected into the app via a `config.json` endpoint served by nginx:

```bash
# .env (gitignored)
OPENROUTER_KEY=sk-or-...
```

```nginx
# nginx serves /config.json dynamically from env at container start
# entrypoint.sh writes: {"openrouterKey": "$OPENROUTER_KEY"} → /usr/share/nginx/html/config.json
```

The app fetches `/config.json` on load and uses the key silently — no Settings UI needed. The Settings field is hidden when a key is already injected via environment.

**Bare browser (no Docker, dev / demo)**
User pastes the key manually in the Settings tab. Stored in Dexie `settings` table. Never in exported garden JSON.

**Rules for both paths**:

- Never bake the key into the Vite bundle (`import.meta.env.VITE_OPENROUTER_KEY` would expose it in the compiled JS)
- Never include the key in AI call logs, error reports, or JSON exports
- Validate on entry/load: test call to `GET /api/v1/models`, show green ✓ or red ✗ in Settings
- Clear and warn if the key is rejected by OpenRouter

#### Backend / Docker Deployment (Phase 2+)

Once the Cloudflare Worker proxy or a self-hosted Docker backend exists, secrets move fully server-side:

```bash
# .env  (gitignored — never committed)
OPENROUTER_KEY=sk-or-...
SUPABASE_SERVICE_KEY=eyJ...
WEATHER_API_KEY=...          # only if not using Open-Meteo
```

```yaml
# docker-compose.yml
services:
  api:
    image: gardenplanner-api
    env_file: .env # inject at runtime, not baked into image
```

**Rules**:

- Never use `ENV` in a `Dockerfile` for secrets — they are baked into the image layers and visible via `docker history`
- For Cloudflare Workers: `wrangler secret put OPENROUTER_KEY` — stored encrypted in Workers KV, not in `wrangler.toml`
- For CI/CD (GitHub Actions): use repository secrets, never hardcode in workflow YAML
- The frontend client **never** sees backend secrets at any tier — it only ever calls your own proxy endpoint

### 2.4 Required Architecture Refactoring

Before any new features, `App.tsx` must be decomposed:

```
app/
  data/
    schema.ts           # Zod schemas for Plant, Area, Seedling, Settings
    repository.ts       # GardenRepository interface
    localStorage.ts     # Current behavior (Phase 0)
    dexie.ts            # Dexie implementation (Phase 1)
  hooks/
    useGarden.ts        # React hook wrapping the repository
    usePlants.ts        # Plant library CRUD
    useSeedlings.ts     # Seedling management
    useSettings.ts      # Settings access
    useWeather.ts       # Weather data hook
    useSuggestions.ts   # Smart suggestions engine
  services/
    ai.ts               # OpenRouter client (BYOK or proxy)
    weather.ts          # Weather API client
    plantLibrary.ts     # Shared plant library client
  i18n/
    index.ts            # i18next setup
    locales/
      en/
        ui.json
        plants.json
        calendar.json
      nl/
        ui.json
        plants.json
        calendar.json
```

---

## 4. Dumb vs Smart Mode — AI Integration

### 3.1 Current "Dumb" Mode

- Manual plant entry: user fills every field by hand
- Static suggestions: 3 hardcoded items (water, weed, compost)
- Rigid timelines: harvest = `plantingDate + daysToHarvest`, no weather adjustment
- No weather awareness, no pest tracking, no growth stage intelligence

### 3.2 AI-Assisted Plant Library Entry

**Goal**: User types "Basil" → AI fills the entire `Plant` template.

#### OpenRouter Integration Design

| Decision            | Choice                                       | Rationale                                                       |
| ------------------- | -------------------------------------------- | --------------------------------------------------------------- | ----- | --------------------- |
| **Primary model**   | `google/gemini-2.0-flash`                    | Best cost/quality for structured JSON ($0.10/M in, $0.40/M out) |
| **Fallback chain**  | Gemini Flash → Mistral Small → Llama 3.3 70B | Redundancy across providers                                     |
| **Response format** | Non-streaming JSON                           | Must parse complete Plant schema                                |
| **Caching**         | 30-day cache keyed by `name                  | variety                                                         | zone` | Avoid repeat AI calls |
| **Pre-seeded**      | 12 DEFAULT_PLANTS cached at build time       | Zero AI calls for known plants                                  |

#### Example Prompt (Plant Data Extraction)

```
You are a horticultural expert. Given a plant name and optional variety,
return a JSON object matching this exact schema:

{
  "name": string,
  "variety": string,
  "icon": string (single emoji),
  "daysToHarvest": number,
  "spacingCm": number,
  "frostHardy": boolean,
  "sunRequirement": "full" | "partial" | "shade",
  "sowIndoorMonths": number[] (1-12),
  "sowDirectMonths": number[] (1-12),
  "harvestMonths": number[] (1-12),
  "companions": string[] (plant ids),
  "antagonists": string[] (plant ids),
  "description": string (2 sentences, practical growing tips),
  "confidence": number (0-1)
}

Growth zone: {userZone}. Climate region: {userRegion}.
Plant: {userInput}
```

#### UX Flow

1. User opens "Add Plant" dialog, types plant name (e.g., "Thai Basil")
2. **"Ask AI ✨"** button appears → loading shimmer on all fields
3. AI response populates fields; low-confidence fields get amber ⚠ badge
4. User reviews, adjusts any field, confirms
5. Confidence thresholds: ≥0.85 = auto-fill, 0.7–0.85 = amber warning, <0.5 = left empty
6. Result cached for future lookups

#### Cost Estimate

- ~500 tokens per plant lookup → **~$0.0002 per lookup**
- Typical user adds ~10 plants → **< $0.01 lifetime cost per user**

### 3.3 Smart Event Suggestions Engine

**Goal**: Replace static suggestions with dynamic, context-aware recommendations.

#### Architecture: Hybrid (Rules Engine + AI Enrichment)

```
┌──────────────────────────────────────────────────────┐
│                  SUGGESTION ENGINE                    │
│                                                      │
│  ┌──────────────┐     ┌──────────────┐               │
│  │ Rules Engine  │────▶│  AI Enricher │ (optional)   │
│  │ (instant,     │     │  (every 15m) │               │
│  │  always works)│     │              │               │
│  └──────┬───────┘     └──────┬───────┘               │
│         │                    │                        │
│         ▼                    ▼                        │
│    ┌─────────────────────────┐                       │
│    │   Merged Suggestions    │                       │
│    └─────────────────────────┘                       │
│                                                      │
│  INPUTS:                                             │
│  • Weather API (Open-Meteo, free, no key)            │
│  • Garden state (plants, growth stages, layout)      │
│  • Calendar (sow windows, season)                    │
│  • User events (last watered, last fed)              │
│  • Pest reports (user-logged + regional data)        │
└──────────────────────────────────────────────────────┘
```

#### Built-in Rules (Always Available — Dumb Mode Fallback)

1. **Frost protection** — weather forecast < 2°C + non-frost-hardy plants in ground → urgent alert
2. **Harvest readiness** — `plantingDate + daysToHarvest` approaching → harvest reminder
3. **Watering** — no rain in forecast + high temp → water suggestion
4. **Companion conflicts** — antagonist planted adjacent → warning
5. **Sow window** — current month matches `sowIndoorMonths`/`sowDirectMonths` → sow reminder
6. **Weeding** — warm + wet conditions → weeding reminder
7. **Fertilize** — schedule-based (every N weeks during growing season)

#### AI-Enhanced Suggestions (Smart Mode)

- Pest risk prediction based on weather patterns + region
- Optimal harvest timing adjusted for actual weather (not just days)
- Succession planting recommendations
- Disease prevention based on humidity/temperature patterns
- Personalized tips based on user's garden history

#### Weather Integration

| API                          | Cost               | Auth          | Data Quality          |
| ---------------------------- | ------------------ | ------------- | --------------------- |
| **Open-Meteo** (recommended) | Free               | No key needed | ECMWF data, excellent |
| OpenWeatherMap               | Free tier (1K/day) | API key       | Good                  |
| Visual Crossing              | Free tier (1K/day) | API key       | Good historical data  |

**Decision**: Use **Open-Meteo** — free, no API key, high quality. Refresh every 30 min. Cache in IndexedDB.

#### Graceful Degradation (4 Tiers)

1. **Full**: AI + Weather → richest suggestions
2. **Rules + Weather**: AI unavailable → deterministic rules with weather data
3. **Rules only**: Offline → rules based on calendar + garden state
4. **Static**: No data at all → seasonal gardening tips (current behavior)

#### Cost Estimate

- ~800 tokens per suggestion refresh → **~$0.0003 per refresh**
- 4 refreshes/day × 30 days → **~$0.04/month per user**

---

## 5. Shared Plant Library

### 4.1 Problem

If 1,000 users each add "Basil", we don't want 1,000 AI calls. Plants should be centralized.

### 4.2 Architecture (Future — Phase 2–3)

```
┌─────────────┐       ┌──────────────────────┐
│  Client App  │◀─────▶│  Plant Library API    │
│  (Dexie      │  REST │  (Hono + D1/Postgres) │
│   local      │       │                      │
│   cache)     │       │  GET  /plants         │
│              │       │  GET  /plants/:id     │
│              │       │  POST /plants/suggest  │
│              │       │  GET  /plants?since=   │
└─────────────┘       └──────────────────────┘
```

### 4.3 Database Schema (Multi-Language)

```sql
-- Core plant data (language-independent)
CREATE TABLE plants (
  id            TEXT PRIMARY KEY,
  icon          TEXT NOT NULL,
  color         TEXT NOT NULL,
  days_to_harvest INTEGER,
  spacing_cm    INTEGER,
  frost_hardy   BOOLEAN,
  sun_requirement TEXT CHECK (sun_requirement IN ('full','partial','shade')),
  sow_indoor_months  TEXT, -- JSON array [2,3,4]
  sow_direct_months  TEXT, -- JSON array [4,5,6]
  harvest_months     TEXT, -- JSON array [7,8,9]
  companions    TEXT, -- JSON array of plant ids
  antagonists   TEXT, -- JSON array of plant ids
  status        TEXT DEFAULT 'approved', -- draft|pending|approved
  version       INTEGER DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plant translations (one row per language per plant)
CREATE TABLE plant_translations (
  plant_id      TEXT REFERENCES plants(id),
  locale        TEXT NOT NULL, -- 'en', 'nl', 'de', 'fr'
  name          TEXT NOT NULL,
  variety       TEXT,
  description   TEXT,
  PRIMARY KEY (plant_id, locale)
);

-- Growth zone adjustments (future)
CREATE TABLE plant_zone_adjustments (
  plant_id      TEXT REFERENCES plants(id),
  zone          TEXT NOT NULL, -- '6b', '7a', etc.
  sow_indoor_months  TEXT,
  sow_direct_months  TEXT,
  harvest_months     TEXT,
  notes         TEXT,
  PRIMARY KEY (plant_id, zone)
);
```

### 4.4 Sync Strategy

- **Delta sync**: `GET /plants?since={timestamp}` returns only changed plants
- **Client stores** sync timestamp in IndexedDB
- **Trigger**: on app startup + every 24 hours
- **Local/shared coexistence**: plants have `source: "shared" | "custom" | "forked"`
  - "shared": from central library (read-only locally)
  - "custom": user-created (local only)
  - "forked": user modified a shared plant (local override)

### 4.5 Moderation Workflow (Future)

1. User submits new plant via "Contribute to Library"
2. Entry goes to `status: 'pending'`
3. Moderator reviews, edits, approves
4. Version incremented, clients pull on next sync

---

## 6. Internationalization (i18n)

### 5.1 Framework: react-i18next

| Framework         | TypeScript             | Namespaces          | Lazy Load | Bundle | Verdict                      |
| ----------------- | ---------------------- | ------------------- | --------- | ------ | ---------------------------- |
| **react-i18next** | ✅ Module augmentation | ✅ First-class      | ✅        | ~15 KB | **Winner**                   |
| react-intl        | ✅                     | ⚠️ Single namespace | ✅        | ~12 KB | Good but no namespaces       |
| Lingui            | ✅                     | ✅                  | ✅        | ~5 KB  | Smallest, but less ecosystem |

**Decision**: `i18next` + `react-i18next` + `i18next-browser-languagedetector`

### 5.2 Translation Architecture

#### Namespaces

| Namespace  | Content                              | Example Keys                                      |
| ---------- | ------------------------------------ | ------------------------------------------------- |
| `ui`       | Buttons, labels, menus, dialogs      | `ui:toolbar.addPlant`, `ui:dialog.save`           |
| `plants`   | Plant names, varieties, descriptions | `plants:tomato.name`, `plants:tomato.description` |
| `calendar` | Month names, date formats, seasons   | `calendar:months.jan`, `calendar:seasons.spring`  |
| `errors`   | Error messages, validation           | `errors:required`, `errors:invalidDate`           |

#### File Structure

```
app/i18n/
  index.ts                  # i18next init + config
  locales/
    en/
      ui.json               # ~100 keys (buttons, labels, titles)
      plants.json           # ~50 keys (12 default plants × 4 fields)
      calendar.json         # ~20 keys (months, seasons, formats)
      errors.json           # ~15 keys
    nl/
      ui.json
      plants.json
      calendar.json
      errors.json
```

#### String Extraction Estimate

~140 hardcoded English strings to extract across 9 component files:

- `App.tsx` — ~60 strings (tab labels, area names, button text, month abbreviations)
- `EventsBar.tsx` — ~20 strings (event labels, date formatting)
- `ToolBar.tsx` — ~15 strings
- `PlanterDialog.tsx` — ~10 strings
- `PlantDefinitionDialog.tsx` — ~15 strings
- `AddSeedlingDialog.tsx` — ~10 strings
- `SowSeedsDialog.tsx` — ~5 strings
- `PlantPickerDialog.tsx` — ~3 strings
- `PlanterGrid.tsx` — ~2 strings

### 5.3 Plant Translation Strategy

**Problem**: Plant names are not simple key lookups — some names are regional:

- "Courgette" (UK) vs "Zucchini" (US)
- "Aubergine" (UK) vs "Eggplant" (US)

**Solution**: Use i18next's fallback chain: `en-US → en → key`

For AI-generated / user-custom plants:

- Shared library plants: translations in `plant_translations` table, loaded into i18n namespace
- Custom plants: `t('plants:${plant.id}.name', { defaultValue: plant.name })` — falls back to raw name

### 5.4 Date & Number Formatting

Replace hardcoded `MONTH_ABBR` array with `Intl.DateTimeFormat`:

```typescript
// Instead of MONTH_ABBR[monthIndex]
new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
```

Number formatting (spacing in cm/inches):

```typescript
new Intl.NumberFormat(locale, { style: "unit", unit: "centimeter" }).format(
  spacingCm,
);
```

### 5.5 Language Switcher

- Detect browser language on first visit
- Persist choice in settings (Dexie/localStorage)
- Dropdown in Settings tab with flag + language name
- Ships with: 🇬🇧 English, 🇳🇱 Nederlands

---

## 7. Identified Gaps & Missed Items

These are items NOT in the user's original request but critical for success:

### 6.1 State Management

- **Problem**: `App.tsx` has 15+ `useState` calls, prop-drills everything
- **TODO**: Evaluate Zustand or React Context + custom hooks to replace prop drilling
- **Impact**: Blocks clean AI integration, i18n, and persistence refactoring

### 6.2 Data Validation

- **Problem**: Zod is installed but unused — no runtime validation on localStorage data
- **TODO**: Define Zod schemas for all entities; validate on load/save
- **Impact**: Corrupt data in localStorage can crash the app silently

### 6.3 Error Handling & Offline Indicators

- **Problem**: All `localStorage` errors silently swallowed (`catch { /* ignore */ }`)
- **TODO**: Add error boundaries, toast notifications (Sonner is installed), offline indicator
- **Impact**: Users won't know if data failed to save

### 6.4 Testing

- **Problem**: Zero tests — no unit, integration, or E2E
- **TODO**: Add Vitest for unit tests (Zod schemas, rules engine, hooks), Playwright for E2E
- **Impact**: Risky to refactor `App.tsx` without test coverage

### 6.5 Image/Icon Support

- **Problem**: Plants use emoji for icons — limiting and inconsistent
- **TODO**: Consider an icon library or SVG plant icons; support user-uploaded images (Phase 3)

### 6.6 Data Export/Import

- **Problem**: No way to back up or migrate garden data
- **TODO**: JSON export/import before persistence migration (safety net)
- **Impact**: Users could lose data during migration

### 6.7 Mobile Responsiveness / PWA

- **Problem**: `use-mobile.ts` hook exists but PWA capability unclear
- **TODO**: Evaluate PWA with service worker for offline-first + installability
- **Impact**: Garden app is a natural mobile use case

### 6.8 Weather API — Location Handling

- **Problem**: Settings has `location: string` but no geocoding
- **TODO**: Add geocoding (lat/lng) for weather API calls; allow map-based selection
- **Impact**: Weather integration requires coordinates, not free text

### 6.9 Undo/History

- **Problem**: No undo for destructive actions (removing a plant, deleting a planter)
- **TODO**: Consider undo stack or soft-delete pattern

### 6.10 Accessibility (a11y)

- **Problem**: No audit done; shadcn/Radix provides good baseline but custom components may lack labels
- **TODO**: Run axe/Lighthouse audit, ensure all interactive elements are keyboard-accessible

### 6.11 Events Not Persisted (Bug) ✅ Fixed

- **Problem**: `events` (the garden event log) is stored only in `useState` — it is lost on every page refresh. This is a silent data loss bug.
- **Fix**: Persisted to Dexie `events` table in `DexieRepository` (PR #1, task 1.3)
- **Impact**: Resolved — event history survives page refreshes

### 6.12 Plant Placements Not Persisted (Bug) ✅ Fixed

- **Problem**: `PlanterGrid` manages the `squares` grid (what is planted where) in its own local `useState`. The `Planter` type has no `squares` field and App.tsx never writes placements back to `areas`. All plant positions are silently lost on every page refresh.
- **Fix**: `PlanterSchema` now includes `squares: PlanterSquare[][]`. `DexieRepository` persists this. `PlanterGrid` receives `squares` as a prop via `initialSquares` and writes back via `onSquaresChange` (PR #1, task 1.3).
- **Impact**: Resolved — garden layouts survive page refreshes.

---

### Phase 1 — Foundation (Local-First, AI-Ready)

**Goal**: Clean architecture, better persistence, basic AI via BYOK

| #    | Task                                                     | Effort  | Dependencies |
| ---- | -------------------------------------------------------- | ------- | ------------ |
| 1.1  | Extract Zod schemas for all entities                     | 1 day   | —            |
| 1.2  | Create `GardenRepository` interface + DAL                | 2 days  | 1.1          |
| 1.3  | Migrate from localStorage to Dexie.js v4                 | 1 day   | 1.2          |
| 1.4  | One-time auto-migration from localStorage                | 0.5 day | 1.3          |
| 1.5  | JSON export/import (data portability)                    | 0.5 day | 1.2          |
| 1.6  | Extract state management from `App.tsx` (hooks/context)  | 2 days  | 1.2          |
| 1.7  | Add BYOK OpenRouter field to Settings                    | 0.5 day | —            |
| 1.8  | AI-assisted plant entry ("Ask AI" button)                | 2 days  | 1.7          |
| 1.9  | Rules-based suggestion engine (no AI)                    | 2 days  | 1.6          |
| 1.10 | Weather integration (Open-Meteo, direct)                 | 1 day   | —            |
| 1.11 | Basic error handling + toast notifications               | 1 day   | —            |
| 1.12 | Add Vitest + initial test suite                          | 1 day   | 1.1, 1.2     |
| 1.13 | Set up i18next + react-i18next (infra only, English)     | 0.5 day | —            |
| 1.14 | Extract all hardcoded strings to `en/` translation files | 1 day   | 1.13         |
| 1.15 | Replace `MONTH_ABBR` with `Intl.DateTimeFormat`          | 0.5 day | 1.13         |

> **Why i18n infra in Phase 1?** Every new component written without i18n adds to the extraction debt. Setting up the framework and extracting strings once is far cheaper than retrofitting a growing codebase in Phase 3. Dutch translations (the actual content work) stay in Phase 3 when the text is stable.

**Total Phase 1: ~17 days**

### Phase 2 — Backend & Intelligence

**Goal**: Secure AI proxy, smart suggestions, shared plant library foundation

| #   | Task                                         | Effort  | Dependencies |
| --- | -------------------------------------------- | ------- | ------------ |
| 2.1 | Set up Hono backend on Cloudflare Workers    | 1 day   | —            |
| 2.2 | AI proxy endpoint (POST /api/ai/suggest)     | 1 day   | 2.1          |
| 2.3 | Weather proxy endpoint                       | 0.5 day | 2.1          |
| 2.4 | Smart suggestion engine (AI-enhanced)        | 3 days  | 2.2, 1.9     |
| 2.5 | Shared plant library — D1 schema + seed data | 2 days  | 2.1          |
| 2.6 | Plant library API (GET /plants, delta sync)  | 2 days  | 2.5          |
| 2.7 | Client-side sync for plant library           | 1 day   | 2.6, 1.3     |
| 2.8 | Rate limiting + usage tracking               | 1 day   | 2.1          |

**Total Phase 2: ~12 days**

### Phase 3 — Multi-User & i18n

**Goal**: User accounts, data sync, Dutch translation

> i18n infra + string extraction are done in Phase 1. Phase 3 is only the translation content work and language switcher, which requires stable UI text and ideally a native Dutch speaker.

| #   | Task                                                 | Effort  | Dependencies |
| --- | ---------------------------------------------------- | ------- | ------------ |
| 3.1 | Dutch (nl) translations (`ui`, `calendar`, `errors`) | 2 days  | 1.14         |
| 3.2 | Plant name translations (en + nl for default plants) | 1 day   | 1.14         |
| 3.3 | Language switcher in Settings                        | 0.5 day | 1.13         |
| 3.4 | Supabase Auth integration                            | 2 days  | 2.1          |
| 3.5 | Per-user data schema in Postgres                     | 2 days  | 3.4          |
| 3.6 | Dexie ↔ Supabase sync adapter                        | 3 days  | 3.5, 1.3     |
| 3.7 | Community plant contributions + moderation           | 3 days  | 2.5, 3.4     |

**Total Phase 3: ~14 days**

---

## 9. TODO Checklist

### Immediate (Pre-Phase 1)

- [x] Audit `App.tsx` — list every piece of state and its consumers
- [x] Decide on state management: **Context + custom hooks** (not Zustand)
- [x] Decide BYOK UX: Settings tab, validate via test call to OpenRouter `/api/v1/models`, store in Dexie `settings` table, never in `.env` or exported JSON

#### App.tsx Audit Results

**Persisted state** (4 `localStorage` keys, no DAL — all inline in `useState` initializers):

| State          | Type         | Key                                                     |
| -------------- | ------------ | ------------------------------------------------------- |
| `areas`        | `Area[]`     | `gp_areas` — entire nested garden tree as one JSON blob |
| `customPlants` | `Plant[]`    | `gp_customPlants`                                       |
| `seedlings`    | `Seedling[]` | `gp_seedlings`                                          |
| `settings`     | `Settings`   | `gp_settings`                                           |

**Transient data state** (not persisted — silently lost on page refresh):

| State         | Problem                                                        |
| ------------- | -------------------------------------------------------------- |
| `events`      | Garden event log is lost on every reload — should be persisted |
| `suggestions` | 3 hardcoded items, never updated, never saved                  |

**UI / dialog state** (all local to `App`, should stay local after extraction):
`selectedPlant`, `planterDialogOpen`, `editingPlanter`, `activeTab`, `isEditMode`, `showAddPlantModal`, `showAddSeedlingModal`, `showSowModal`, `selectedSowPlant`, `editingPlant`, `dialogDefaultIsSeed`

#### State Management Decision: Context + hooks (not Zustand)

- Prop drilling is only **one level deep** — `App` → direct child components. No grandchild drilling.
- Only 4–5 pieces of state cross component boundaries.
- The `GardenRepository` interface already encapsulates the data layer. Zustand would be a redundant abstraction on top.
- Zustand pays off when many deeply nested components all subscribe to the same store. That's not this app.

**Hook split after extraction:**

- `useGarden()` — areas CRUD, backed by `GardenRepository`
- `usePlants()` — `DEFAULT_PLANTS` + `customPlants`, `AVAILABLE_PLANTS` derived value
- `useSeedlings()` — seedling CRUD + status transitions
- `useSettings()` — settings read/write
- `useEvents()` — event log (must be persisted — currently a bug)
- UI/dialog state stays local in whichever component owns the dialog

### Phase 1 — Foundation

- [x] Define Zod schemas: `PlantSchema`, `AreaSchema`, `SeedlingSchema`, `SettingsSchema` → `app/data/schema.ts`
- [x] Create `GardenRepository` interface → `app/data/repository.ts`
- [x] `LocalStorageRepository` (bridge impl, validates on every read) → `app/data/localStorageRepository.ts`
- [x] Implement `DexieRepository` → `app/data/dexieRepository.ts` (PR #1)
- [x] Write localStorage → Dexie migration → `app/data/migration.ts` (PR #1)
- [ ] Add JSON export/import
- [ ] Decompose `App.tsx` state into custom hooks
- [ ] BYOK OpenRouter in Settings
- [ ] "Ask AI ✨" button in PlantDefinitionDialog
- [ ] AI prompt template for plant data extraction
- [ ] Caching layer for AI responses (30-day TTL, keyed by plant name+variety+zone)
- [ ] Rules engine: frost alerts, harvest reminders, watering, companion conflicts
- [ ] Open-Meteo weather integration (direct, no API key)
- [ ] Geocoding for Settings.location → lat/lng
- [ ] Error boundaries + Sonner toast for persistence errors
- [x] Vitest setup + schemas test suite → `app/data/__tests__/` (PR #1)
- [ ] `npm install i18next react-i18next i18next-browser-languagedetector`
- [ ] i18next config with namespaces: `ui`, `plants`, `calendar`, `errors`
- [ ] Extract all hardcoded strings from 9 component files into `en/` JSON files
- [ ] Replace `MONTH_ABBR` with `Intl.DateTimeFormat` + `Intl.NumberFormat`
- [ ] All new components written with `t()` calls from day one

### Phase 2 — Backend

- [ ] Hono project setup (Cloudflare Workers)
- [ ] `POST /api/ai/suggest` — OpenRouter proxy
- [ ] `GET /api/weather` — Open-Meteo proxy
- [ ] `GET /api/plants` — shared plant library
- [ ] `GET /api/plants?since=` — delta sync
- [ ] D1 schema: `plants`, `plant_translations`, `plant_zone_adjustments`
- [ ] Seed D1 with DEFAULT_PLANTS + translations
- [ ] Client sync: pull shared plants into Dexie
- [ ] Rate limiting (per IP, then per user in Phase 3)
- [ ] Smart suggestion prompt engineering
- [ ] AI suggestion refresh (every 15 min, with graceful degradation)

### Phase 3 — Multi-User & i18n

> i18n infra is already done in Phase 1. Only translation content remains here.

- [ ] `nl/ui.json`, `nl/plants.json`, `nl/calendar.json`, `nl/errors.json` (Dutch translations)
- [ ] Plant name translations for default plants (en + nl)
- [ ] Language switcher component in Settings
- [ ] Supabase project setup
- [ ] Auth flows: sign up, sign in, password reset
- [ ] Postgres schema for per-user gardens
- [ ] RLS policies (users see only their own data)
- [ ] Dexie ↔ Supabase bi-directional sync
- [ ] Plant contribution form + moderation queue

### Stretch / Future

- [ ] PWA with service worker
- [ ] Plant image uploads (Supabase Storage)
- [ ] Regional plant icon set (SVG)
- [ ] Undo/redo stack
- [ ] Accessibility audit (axe/Lighthouse)
- [ ] More locales beyond en/nl
- [ ] Growth zone-specific plant data adjustments
- [ ] Calendar view for sow/harvest timeline
- [ ] Community features: share garden layouts
- [ ] Push notifications for urgent suggestions (frost, harvest)

---

## Appendix: Key Dependencies to Add

| Package                               | Phase | Purpose                             |
| ------------------------------------- | ----- | ----------------------------------- |
| `dexie@^4`                            | 1     | IndexedDB wrapper                   |
| `i18next@^24`                         | 1     | i18n framework                      |
| `react-i18next@^15`                   | 1     | React bindings for i18next          |
| `i18next-browser-languagedetector@^8` | 1     | Auto-detect user language           |
| `hono@^4.7`                           | 2     | Backend framework (Workers)         |
| `@hono/zod-validator@^0.5`            | 2     | Request validation                  |
| `wrangler@^4`                         | 2     | Cloudflare Workers CLI              |
| `@supabase/supabase-js@^2.49`         | 3     | Supabase client                     |
| `vitest@^3`                           | 1     | Unit testing                        |
| `zustand@^5`                          | —     | Not needed — Context + hooks chosen |

---

> **Next step**: Tasks 1.1–1.4 and 1.12 are complete (PR #1 merged). Begin **Task 1.5** — JSON export/import for data portability, or **Task 1.6** — decompose `App.tsx` state into custom hooks.
