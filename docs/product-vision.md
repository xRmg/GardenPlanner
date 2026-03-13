# Garden Planner — Product Vision & Deployment Tiers

> **Purpose**: Long-range product vision, deployment model, auth design, and cross-tier architecture principles.
> This is reference material. Active implementation tasks live in `todo.md`.

---

## Deployment Tiers

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

### Tier 1 — Local Deploy, Optional BYOK AI (Current)

**Tagline**: _Your garden, on your machine. AI is a bonus._

| Dimension         | Detail                                                                          |
| ----------------- | ------------------------------------------------------------------------------- |
| **Deployment**    | Self-hosted Docker — `docker compose up`. Nginx serves the React SPA.           |
| **Persistence**   | IndexedDB/Dexie (local-only). Auto-migrated from localStorage.                  |
| **Auth**          | **1a** open · **1b** single-user PIN/password · **1c** multi-profile (3–5)     |
| **AI**            | Optional BYOK via OpenRouter. If absent, app runs in "Dumb Mode".               |
| **Plant library** | Bundled defaults + user additions.                                              |
| **Cost**          | Free. AI costs are whatever the user pays OpenRouter directly.                  |
| **Who**           | Self-hosters, hobbyists, privacy-first users, early adopters.                   |

**Architecture requirements**:
- `GardenRepository` must work 100% offline with no external calls
- All AI calls must be optional — non-AI fallback for every feature
- Settings: stored backend settings may hold a BYOK key, while frontend-safe settings expose only sanitized AI state (`none` or `server`) in local UI state
- Start with mode **1a** but include `profileId` in DB schema so 1b/1c is a config flip
- Permission checks (`canEdit`, `canView`) must be centralised even when always returning `true`

---

### Tier 2 — Local Deploy + Shared Plant Library (Future)

**Tagline**: _Your garden, local. Plant knowledge, shared._

| Dimension         | Detail                                                                           |
| ----------------- | -------------------------------------------------------------------------------- |
| **Deployment**    | Same Docker host. Plant library API is an opt-in remote endpoint.                |
| **Plant library** | Pulled from central REST API (`GET /api/plants`). Delta sync. Offline fallback.  |
| **AI**            | Still BYOK (same as Tier 1).                                                     |
| **Cost**          | Free.                                                                            |

**Architecture requirements**:
- `plantLibrary.ts` service needs configurable `baseUrl` (defaults to bundled, overridable in Settings)
- Plants have `source: 'bundled' | 'synced' | 'custom'`
- The central plant API is **read-only** at this tier (no auth needed)
- Sync failures must be silent — never block the user

---

### Tier 3 — Local Deploy + Central AI Engine (Far Future · Paid $)

**Tagline**: _Your garden, local. Intelligence, centrally powered._

| Dimension | Detail                                                                                     |
| --------- | ------------------------------------------------------------------------------------------ |
| **AI**    | Centrally managed — no user API key needed. Subscription model.                            |
| **Cost**  | €2–5/month for AI-enhanced suggestions (estimate).                                         |

**Architecture requirements**:
- `aiProvider` in Settings supports `type: 'proxy'` with `proxyUrl` + auth `token`
- The backend proxy must support JWT auth and per-user rate limiting
- Garden context sent to AI must be **anonymised** — no PII, configurable opt-out
- App must work identically in Tier 1 BYOK mode if user cancels subscription

---

### Tier 4 — Hosted SaaS (Far Far Future · Paid $$)

**Tagline**: _Sign up and grow. No install needed._

| Dimension         | Detail                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| **Deployment**    | SaaS. User signs in, data lives in cloud.                                            |
| **Persistence**   | Postgres (Supabase) + Dexie as local cache with bi-directional sync. Works offline.  |
| **Auth**          | **4a** single · **4b** team/family (3–5) · **4c** community (10–100, stretch)        |
| **AI**            | Central AI engine from Tier 3, included in subscription.                             |
| **Plant library** | Shared, community-curated, fully translated.                                         |
| **Cost**          | Paid subscription. Free tier with limits.                                            |

**Architecture requirements**:
- Supabase Auth; all tables carry `workspace_id` + `user_id` with RLS from day one
- `GardenRepository` becomes the sync boundary — local Dexie ↔ remote Postgres
- `area_members` table (`area_id`, `user_id`, `role`) is the single permission source
- Scale limits enforced at API layer, not in client code
- Same codebase as local tiers — different runtime config only

---

## User & Auth Models

### Local Deployment (Tiers 1–3)

| Mode                           | Description                                                            | Who it's for                           |
| ------------------------------ | ---------------------------------------------------------------------- | -------------------------------------- |
| **1a — Open (no auth)**        | No login. Single implicit profile. Data lives in the browser only.     | Solo user on personal device           |
| **1b — Single-user protected** | Password/PIN gate at app load. One owner.                              | Private install on shared device       |
| **1c — Multi-user (3–5)**      | Named profiles, per-area roles. No server required.                    | Small household / allotment partners   |

**Rules**:
- No JWTs, no sessions, no server. Profile selection is a local UI gate.
- Passwords stored as local hash (bcrypt/argon2) — never transmitted.
- `areas:{profileId}` namespacing in IndexedDB for isolation.
- Profile management available in Settings to the Owner profile only.

### Hosted Deployment (Tier 4)

| Mode                  | Description                                                     | Who it's for                          |
| --------------------- | --------------------------------------------------------------- | ------------------------------------- |
| **4a — Single user**  | One account, one garden.                                        | Individual                            |
| **4b — Team**         | Shared workspace, per-area roles, invite by email. Max 5.       | Family, small urban farm              |
| **4c — Community**    | 10–100 members; workspace + per-garden roles.                   | Allotment societies, schools          |

### Role Model (shared across all tiers)

```
Owner   — full control: edit garden, manage members, delete
Editor  — add/move/remove plants, log events, update seedlings
Viewer  — read-only
```

---

## Cross-Tier Architecture Principles

| Principle                    | Meaning                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| **Config-driven capability** | Features enabled/disabled via `AppCapabilities` object, not `if (tier === 3)` checks               |
| **Repository pattern**       | All data via `GardenRepository` — swap implementation without touching UI                          |
| **Service abstraction**      | `aiService`, `weatherService`, `plantLibraryService` are interfaces; tiers swap implementations    |
| **Offline first**            | Every feature must function without internet                                                        |
| **No PII in AI calls**       | Garden context stripped of identifying info at service layer                                        |
| **Feature flags**            | `app/config/features.ts` controls capabilities — tier upgrades become config changes               |

### `AppCapabilities` Design

```typescript
// app/config/features.ts
export interface AppCapabilities {
  ai: {
    enabled: boolean;
    provider: 'none' | 'byok' | 'proxy';
    proxyUrl?: string;
  };
  plantLibrary: {
    syncEnabled: boolean;
    apiUrl?: string;
  };
  auth: {
    // 'none'         → open, no login (Tier 1a)
    // 'local-single' → PIN/password gate, one owner (Tier 1b)
    // 'local-multi'  → multi-profile selector, per-area roles (Tier 1c)
    // 'supabase'     → full cloud auth (Tier 4)
    mode: 'none' | 'local-single' | 'local-multi' | 'supabase';
  };
  userModel: {
    type: 'solo' | 'team' | 'community';
    maxUsers?: number; // 3–5 for team, 10–100 for community
  };
  sync: {
    enabled: boolean;
  };
}

// Tier 1a defaults — ships with the app
export const DEFAULT_CAPABILITIES: AppCapabilities = {
  ai: { enabled: false, provider: 'none' },
  plantLibrary: { syncEnabled: false },
  auth: { mode: 'none' },
  userModel: { type: 'solo' },
  sync: { enabled: false },
};
```

---

## Shared Plant Library (Phase 3)

Architectural design for the centrally hosted plant database that powers Tiers 2–4.

### REST API

```
GET  /api/v1/plants             — list plants (paginated)
GET  /api/v1/plants/:id         — single plant with translations
GET  /api/v1/plants?since=...   — delta sync (incremental)
POST /api/v1/plants/suggest     — submit community contribution
```

### Database Schema

```sql
-- Language-independent plant data
CREATE TABLE plants (
  id                TEXT PRIMARY KEY,
  icon              TEXT NOT NULL,
  color             TEXT NOT NULL,
  days_to_harvest   INTEGER,
  spacing_cm        INTEGER,
  frost_hardy       BOOLEAN,
  sun_requirement   TEXT CHECK (sun_requirement IN ('full','partial','shade')),
  sow_indoor_months TEXT, -- JSON array e.g. [2,3,4]
  sow_direct_months TEXT,
  harvest_months    TEXT,
  companions        TEXT, -- JSON array of plant ids
  antagonists       TEXT,
  status            TEXT DEFAULT 'approved', -- draft|pending|approved
  version           INTEGER DEFAULT 1,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Per-language names and descriptions
CREATE TABLE plant_translations (
  plant_id    TEXT REFERENCES plants(id),
  locale      TEXT NOT NULL, -- 'en', 'nl', 'de', 'fr'
  name        TEXT NOT NULL,
  variety     TEXT,
  description TEXT,
  PRIMARY KEY (plant_id, locale)
);

-- Climate-zone adjustments
CREATE TABLE plant_zone_adjustments (
  plant_id          TEXT REFERENCES plants(id),
  koppen_zone       TEXT NOT NULL,
  sow_indoor_months TEXT,
  sow_direct_months TEXT,
  harvest_months    TEXT,
  notes             TEXT,
  PRIMARY KEY (plant_id, koppen_zone)
);
```

### Sync Strategy

- **Delta sync**: `GET /plants?since={timestamp}` returns only changed records
- Client stores sync timestamp in Dexie
- Triggers: app startup + every 24 hours
- Plant `source` field: `'bundled' | 'synced' | 'custom' | 'forked'`
  - `synced` — from central library (read-only locally)
  - `custom` — user-created (local only)
  - `forked` — user modified a synced plant (local override)

### Moderation Workflow

1. User submits new plant → `status: 'pending'`
2. Moderator reviews and approves
3. `version` incremented; clients pull on next sync
