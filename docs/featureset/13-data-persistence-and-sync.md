# Feature 13: Data Persistence & Sync

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

Data Persistence & Sync is the storage backbone of the application. The primary store is IndexedDB via Dexie v4 (local-first, works offline). An optional ServerRepository wraps Dexie with backend sync for multi-device access. The system includes automatic migration from a legacy localStorage format, Zod schema validation on all reads, and specialized cache tables for weather, AI plant data, and AI suggestions.

---

## Components

| Component | File | Role |
|-----------|------|------|
| Repository Interface | `app/data/repository.ts` | Abstract data access contract |
| Dexie Repository | `app/data/dexieRepository.ts` | Primary IndexedDB implementation |
| Server Repository | `app/data/serverRepository.ts` | Dexie + backend sync wrapper |
| LocalStorage Repository | `app/data/localStorageRepository.ts` | Legacy bridge (fallback/testing) |
| Migration | `app/data/migration.ts` | One-time localStorage → Dexie migration |
| Schema | `app/data/schema.ts` | Zod schemas, validation helpers |

---

## Sub-Features

### 13.1 Repository Interface (GardenRepository)
All data access goes through this interface — no direct database calls:

| Method | Description |
|--------|-------------|
| `ready()` | Initialize storage; called once on startup |
| `getAreas()` / `saveArea()` / `deleteArea()` | Area CRUD (upsert by ID) |
| `getCustomPlants()` / `savePlant()` / `deletePlant()` | Custom plant CRUD |
| `getSeedlings()` / `saveSeedling()` / `deleteSeedling()` | Seedling CRUD |
| `getSettings()` / `saveSettings()` | Settings read/write (always returns valid settings via parseWithDefaults) |
| `storeAiKey()` / `clearAiKey()` | AI API key management (server-side only) |
| `resolveLocation()` | Geocode location string to lat/lng + zone |
| `getEvents()` / `saveEvent()` / `deleteEvent()` | Event CRUD (newest-first sort) |
| `clearAll()` | Wipe all data (testing/migration only) |

### 13.2 Dexie Repository (Primary — IndexedDB)
Database: `GardenPlannerDB`, current schema version: v12

**Tables**:
| Table | Key | Purpose |
|-------|-----|---------|
| `areas` | id | Areas with nested planters |
| `customPlants` | id | User-created plants |
| `seedlings` | id | Seedling batches |
| `settings` | key | Singleton settings row |
| `events` | id | Garden event log |
| `aiPlantCache` | key | Cached AI plant lookup responses (30-day TTL) |
| `weatherCache` | id | Cached weather data (3-hour TTL) |
| `aiSuggestionsCache` | id | Cached AI suggestions (6h–72h TTL) |
| `plantNameOverrides` | id | Per-locale plant name fallbacks |

**All reads validated**: Zod `safeParse()` for collections (drops corrupt items), `parseWithDefaults()` for settings (never returns null).

### 13.3 Schema Migration History
| Version | Change |
|---------|--------|
| v1 | Initial schema (areas, customPlants, seedlings, settings, events) |
| v2 | No-op (test) |
| v3 | Fix VirtualSection: 0-based half-open → 1-based closed ranges |
| v4 | Add missing planter IDs |
| v5 | Fix planters with `id: undefined` (spread-order bug) |
| v6 | Add `aiPlantCache` table |
| v7 | Add `weatherCache` and `aiSuggestionsCache` tables |
| v8 | Add `plantNameOverrides` table |
| v9 | Normalize custom plant companion/antagonist refs to canonical slug form |
| v10 | Add `settings.unitSystem`; backfill planter `cellDimensions` and `layout` |
| v11 | Backfill `event.scope` based on presence of plant/gardenId |
| v12 | Upgrade `aiSuggestionsCache` indexes; clear legacy rows |

### 13.4 Server Repository (Optional Backend Sync)
Wraps DexieRepository with server synchronization:
- **Read**: Local Dexie first (fast, offline-capable)
- **Write**: Dexie locally + sync to backend
- **Sync endpoint**: `POST /api/garden/sync` with full state payload:
  ```json
  { "areas": [], "plants": [], "seedlings": [], "events": [] }
  ```
- **Full-state sync**: Not incremental — entire garden state sent on each sync
- **Mutation batching**: If sync already in progress, follow-up syncs queued
- **Startup sync**: Attempts `GET /api/garden` and `GET /api/settings` to pull server state
- **Graceful degradation**: If server unavailable, local Dexie remains authoritative; error toast shown
- **Settings endpoints**: Dedicated routes for sensitive operations:
  - `PATCH /api/settings` — save growthZone, aiModel, locale
  - `POST /api/settings/ai-key` — validate and store API key
  - `DELETE /api/settings/ai-key` — remove key
  - `POST /api/settings/location/resolve` — geocode location

### 13.5 Legacy LocalStorage Migration
One-time automatic migration (`migration.ts`), called on every app startup (idempotent):
1. Check for flag `"gp_migrated_to_dexie"` in localStorage
2. If set: skip (already migrated)
3. Otherwise:
   - Read legacy keys: `gp_areas`, `gp_customPlants`, `gp_seedlings`, `gp_settings`, `gp_events`
   - Validate each item via Zod `safeParse()` — drop corrupt entries with logging
   - Convert `StoredSettings` → `Settings` (AI key handling)
   - Write all data to Dexie via repo methods
   - If settings contained BYOK key, store server-side via `repo.storeAiKey()`
   - Set migration flag, remove legacy localStorage keys
4. Corrupt records logged but don't block migration

### 13.6 Legacy LocalStorage Repository
Kept for fallback and testing:
- Storage keys: `gp_areas`, `gp_customPlants`, `gp_seedlings`, `gp_events`, `gp_settings`
- Simple read-modify-write (no transactions)
- All reads validated via Zod `safeParse()`
- Singleton factory pattern (one instance shared)

### 13.7 Data Validation
Two helper functions in `schema.ts`:
- **`safeParse(schema, data, label)`**: Returns parsed data or null; logs issues with context label. Used for areas, plants, seedlings, events.
- **`parseWithDefaults(schema, data)`**: Returns parsed data or schema defaults; never null. Used for settings.

### 13.8 Cache Tables
| Cache | TTL | Key Format | Purpose |
|-------|-----|------------|---------|
| `aiPlantCache` | 30 days | `name\|latinName\|zone\|locale` | Avoid re-querying same plant definitions |
| `weatherCache` | 3 hours | `lat\|lng` (rounded 2dp) | Avoid excessive Open-Meteo API calls |
| `aiSuggestionsCache` | 6h–72h per type | `ai-sug-v${ver}-${hash}` | Avoid redundant AI suggestion requests |
| `plantNameOverrides` | Permanent | locale + ref | Localized plant name storage |
