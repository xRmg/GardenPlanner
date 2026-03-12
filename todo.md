# Garden Planner — TODO

> **Created**: 2026-02-25
> **Status**: Phase 1 in progress — 1.1–1.8b ✅ · **1.9 🔄 IN PROGRESS** · 1.12 ✅ · remaining: 1.10–1.14, then Phase 2
> **Current sprint**: Task 1.9 — Dual-mode Suggestion Engine (8 subtasks)
> **Purpose**: Active implementation roadmap. Architecture decisions → `docs/architecture-decisions.md`. Product vision → `docs/product-vision.md`.

---

## Roadmap

| Phase | Focus                                           | Status         |
| ----- | ----------------------------------------------- | -------------- |
| **1** | Foundation + smart suggestions (local-first)    | 🔄 In Progress |
| **2** | Internationalization (i18next, en + nl)         | ⬜ Queued      |
| **3** | Backend, intelligence proxy & multi-user auth   | ⬜ Future      |

---

## Phase 1 — Foundation & Smart Suggestions

**Goal**: Clean local-first architecture, IndexedDB persistence, BYOK AI, rules + AI suggestion engine.

### ✅ Completed

- **1.1–1.5** — Zod schemas, `GardenRepository` interface, Dexie v4, auto-migration from localStorage, JSON export/import
- **1.6** — Decomposed `App.tsx` into 8 custom hooks (`useGardenData`, `usePlantCatalog`, `useSeedlingManager`, `useAreaManager`, `useGardenEvents`, `useOpenRouterSettings`, `useLocationSettings`, `usePlantAILookup`)
- **1.7–1.8b** — BYOK OpenRouter settings + "Ask AI ✨" plant lookup with 30-day cache → see [`docs/ai-integration-design.md`](docs/ai-integration-design.md)
- **1.12** — Vitest + schema/repository tests
- **Bug fixes** — Events + plant placements persisted to Dexie (previously lost on refresh)

### 🔄 In Progress — Task 1.9: Dual-Mode Suggestion Engine

> Architecture: `docs/suggestion-engine-architecture.md` · Plan: `docs/suggestion-engine-plan.md` · Prompts: `docs/ai-suggestion-prompts-spec.md`

- [ ] **1.9a** — Schema: extend `SuggestionTypeSchema` (sow, fertilize, no-water, frost + 10 AI types), add `source`/`expiresAt` to `SuggestionSchema`, Dexie v7 (`weatherCache` + `aiSuggestionsCache`)
- [ ] **1.9b** — `app/services/weather.ts`: Open-Meteo client (current + hourly 48h + daily 7d + past 2d) with 3h Dexie cache → [`docs/suggestion-engine-architecture.md#weather`](docs/suggestion-engine-architecture.md)
- [ ] **1.9c** — `app/services/suggestions/rulesEngine.ts`: 7 rules (weeding, sowing-indoor, sowing-direct, harvesting, fertilization, watering, no-watering, frost) with cooldowns + mutual exclusion
- [ ] **1.9d** — `app/hooks/useSuggestions.ts`: orchestrates weather → rules → AI; mount + 15min refresh; 4-tier degradation mode
- [ ] **1.9e** — Wire `useSuggestions` into `EventsBar` + `App.tsx`; replace hardcoded suggestions; mode badge
- [ ] **1.9f** — `app/services/suggestions/aiSuggestions.ts`: context builder, prompt, response validator, 10 AI types, 24h cache → [`docs/ai-suggestion-prompts-spec.md`](docs/ai-suggestion-prompts-spec.md)
- [ ] **1.9g** — `app/services/suggestions/merger.ts`: dedup, sort by priority, cap AI suggestions at 8
- [ ] **1.9h** — Unit tests for rules engine + weather cache

### ⬜ Remaining

- [ ] **1.10** — Plant schema enrichment: add `sunlight`, `watering`, `spacingCm`, `daysToHarvest`, `growingTips` to `PlantSchema`; populate all default plants; display in `PlantDetailsDialog`
- [ ] **1.10a** — Migrate hardcoded `DEFAULT_PLANTS` out of `App.tsx` into `app/data/defaultPlants.ts`; update `usePlantCatalog`
- [ ] **1.11** — Pest + treatment events: extend `GardenEventTypeSchema` with `pest` + `treatment` types; capture in event journal
- [ ] **1.12** — Calendar view: month-navigable component showing events, suggestions, and harvest periods for planted crops
- [ ] **1.13** — Auto-derive `koeppenZone` from stored lat/lng (offline 0.5° grid lookup table, no API call)
- [ ] **1.14** — Error boundaries + Sonner toast notifications for all async failures

---

## Phase 2 — Internationalization

**Goal**: Full i18n infrastructure, English + Dutch translations, locale-aware formatting.

> Design spec: `docs/i18n-and-plant-library-architecture.md`

- [ ] **2.1** — Install `i18next`, `react-i18next`, `i18next-browser-languagedetector`; configure TypeScript namespace augmentation
- [ ] **2.2** — Extract ~140 hardcoded strings from `App.tsx`, `EventsBar`, `ToolBar`, and all dialogs into `app/i18n/locales/en/{ui,plants,calendar,errors}.json`
- [ ] **2.3** — Replace `MONTH_ABBR` array with `Intl.DateTimeFormat`; use `Intl.NumberFormat` for cm/mm values throughout
- [ ] **2.4** — Dutch (nl) translations: `ui.json`, `plants.json`, `errors.json`
- [ ] **2.5** — Plant name translations: en + nl entries for all default plants
- [ ] **2.6** — Language switcher in Settings (detect browser language on first visit; persist choice in Dexie)

---

## Phase 3 — Backend, Intelligence & Multi-User

**Goal**: Secure AI + weather proxies, shared plant library, Supabase auth, per-user data sync.

> Design: [`docs/product-vision.md`](docs/product-vision.md) (tiers, auth, role model) · API key security & proxy: [`docs/architecture-decisions.md`](docs/architecture-decisions.md) · Plant library schema: [`docs/i18n-and-plant-library-architecture.md`](docs/i18n-and-plant-library-architecture.md)

### Backend & Intelligence (3.1–3.8)

- [ ] **3.1** — Hono v4 backend on Cloudflare Workers
- [ ] **3.2** — AI proxy endpoint (hides OpenRouter key server-side; removes BYOK requirement)
- [ ] **3.3** — Weather proxy endpoint (optional — Open-Meteo is already free/keyless)
- [ ] **3.4** — AI-enhanced suggestion engine via proxy
- [ ] **3.5** — Shared plant library: Cloudflare D1 schema + seed data (en + nl)
- [ ] **3.6** — Plant library API (`GET /plants`, `GET /plants?since=` delta sync)
- [ ] **3.7** — Client-side plant library sync (background, silent fallback to bundled)
- [ ] **3.8** — Rate limiting + per-user usage tracking

### Multi-User & Auth (3.9–3.13)

- [ ] **3.9** — Supabase Auth (email/password + optional OAuth)
- [ ] **3.10** — Per-user data schema in Postgres (`workspace_id`, `user_id`, RLS policies)
- [ ] **3.11** — Row-Level Security enforcement + data isolation tests
- [ ] **3.12** — Dexie ↔ Supabase bi-directional sync adapter
- [ ] **3.13** — Plant contribution form + community moderation workflow

---

## Stretch / Future

- [ ] PWA + service worker (offline-first, installable on mobile)
- [ ] Image uploads + storage (Phase 3+)
- [ ] Additional locales: de, fr (after Phase 2)
- [ ] Undo/redo stack for destructive actions
- [ ] Community features (share garden layouts)
- [ ] Accessibility audit (axe/Lighthouse) + keyboard navigation pass

---

## Key Dependencies Not Yet Installed

| Package                               | Phase | Purpose                        |
| ------------------------------------- | ----- | ------------------------------ |
| `i18next@^24`                         | 2     | i18n framework                 |
| `react-i18next@^15`                   | 2     | React bindings for i18next     |
| `i18next-browser-languagedetector@^8` | 2     | Auto-detect user language      |
| `hono@^4.7`                           | 3     | Backend framework (Workers)    |
| `@hono/zod-validator@^0.5`            | 3     | Request validation             |
| `wrangler@^4`                         | 3     | Cloudflare Workers CLI         |
| `@supabase/supabase-js@^2.49`         | 3     | Supabase client                |
