# Garden Planner — TODO

> **Created**: 2026-02-25
> **Status**: Phase 1 in progress — 1.1–1.9, 1.13 ✅ · remaining: 1.10–1.12, 1.14, then Phase 2
> **Current sprint**: Tasks 1.10–1.12, 1.14 — Plant enrichment, pest events, calendar view, error handling
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

**Goal**: Clean local-first architecture, IndexedDB persistence, backend AI proxy, rules + AI suggestion engine.

### ✅ Completed

- **1.1–1.5** — Zod schemas, `GardenRepository` interface, Dexie v4, auto-migration from localStorage, JSON export/import
- **1.6** — Decomposed `App.tsx` into 8 custom hooks (`useGardenData`, `usePlantCatalog`, `useSeedlingManager`, `useAreaManager`, `useGardenEvents`, `useOpenRouterSettings`, `useLocationSettings`, `usePlantAILookup`)
- **1.7–1.8b** — Backend AI proxy settings + "Ask AI ✨" plant lookup with 30-day cache; all AI calls routed via `POST /api/ai/chat` (key server-side) → see [`docs/ai-integration-design.md`](docs/ai-integration-design.md)
- **1.9** — Dual-mode suggestion engine: weather service (Open-Meteo), rules engine (7 rules + frost), AI suggestions (10 types, 24h cache), merger, `useSuggestions` hook, wired into `EventsBar`, Dexie v7 (`weatherCache` + `aiSuggestionsCache`), full test suite → see [`docs/suggestion-engine-architecture.md`](docs/suggestion-engine-architecture.md)
- **1.12** — Vitest + schema/repository/rules-engine tests
- **1.13** — Auto-derive `koeppenZone` from lat/lng via Open-Meteo 30-year climate normals; pure `classifyKoppen(T, P, lat)` function; written to `settings.growthZone` when user picks a city in Settings
- **Bug fixes** — Events + plant placements persisted to Dexie (previously lost on refresh)

### ⬜ Remaining — Tasks 1.10–1.14

- [ ] **1.10** — Plant schema enrichment: add `sunlight`, `watering`, `spacingCm`, `daysToHarvest`, `growingTips` to `PlantSchema`; populate these fields on all built-in plants seeded into Dexie; display in `PlantDetailsDialog`
- [ ] **1.11** — Pest + treatment events: extend `GardenEventTypeSchema` with `pest` + `treatment` types; capture in event journal
- [ ] **1.12** — Calendar view: month-navigable component showing events, suggestions, and harvest periods for planted crops
- [ ] **1.14** — Error boundaries + Sonner toast notifications for all async failures

---

## AI Integration Technical Debt

> Findings from code review of AI plumbing (plant lookup + suggestion engine + backend proxy). Fix before adding new AI features.

- [x] **AI-1** *(resolved)* `app/hooks/usePlantAILookup.ts` now routes through the backend-only client path; missing proxy configuration fails closed instead of falling back to a direct browser→OpenRouter call.

- [x] **AI-2** *(resolved)* `app/hooks/usePlantAILookup.ts` passes an empty `apiKey` when using the backend proxy; the browser no longer carries the user key for inference calls.

- [x] **AI-3** *(resolved)* `app/hooks/useOpenRouterSettings.ts` now documents and uses backend validation/storage; the browser no longer calls OpenRouter directly.

- [x] **AI-4** *(resolved)* `backend/src/routes.ts` validates `/api/ai/chat` requests with Zod before forwarding them upstream.

- [x] **AI-5** *(resolved)* Backend comments and settings transport now distinguish stored `byok` state from frontend-safe `server` state.

- [x] **AI-6** *(resolved)* The unused frontend `"proxy"` variant was removed from the active settings schema; future hosted proxy tiers remain documented separately in product-planning docs.

- [x] **AI-7** *(resolved)* AI-enabled guards now use the sanitized frontend settings state consistently.

- [ ] **AI-8** *(LOW — inconsistency)* `app/hooks/usePlantAILookup.ts` uses `chatCompletionWithFallback` which does **not** implement the multi-model retry loop, while `aiSuggestions.ts` has an explicit fallback chain (`mistral-small` → `llama-3.3-70b`). Both surfaces should share the same resilience strategy; consider unifying on the explicit fallback loop.

- [x] **AI-9** *(resolved)* The AI design docs now describe the proxy-only flow and the dedicated backend settings endpoints.

---

## Phase 2 — Internationalization

**Goal**: Full i18n infrastructure, English + Dutch translations, locale-aware formatting.

> Design spec: `docs/i18n-and-plant-library-architecture.md`

- [ ] **2.1** — Install `i18next`, `react-i18next`, `i18next-browser-languagedetector`; configure TypeScript namespace augmentation
- [ ] **2.2** — Extract ~140 hardcoded strings from `App.tsx`, `EventsBar`, `ToolBar`, and all dialogs into `app/i18n/locales/en/{ui,plants,calendar,errors}.json`
- [ ] **2.3** — Replace `MONTH_ABBR` array with `Intl.DateTimeFormat`; use `Intl.NumberFormat` for cm/mm values throughout
- [ ] **2.4** — Dutch (nl) translations: `ui.json`, `plants.json`, `errors.json`
- [ ] **2.5** — Plant name translations: en + nl entries for all built-in plants
- [ ] **2.6** — Language switcher in Settings (detect browser language on first visit; persist choice in Dexie)

---

## Phase 3 — Backend, Intelligence & Multi-User

**Goal**: Secure AI + weather proxies, shared plant library, Supabase auth, per-user data sync.

> Design: [`docs/product-vision.md`](docs/product-vision.md) (tiers, auth, role model) · API key security & proxy: [`docs/architecture-decisions.md`](docs/architecture-decisions.md) · Plant library schema: [`docs/i18n-and-plant-library-architecture.md`](docs/i18n-and-plant-library-architecture.md)

### Backend & Intelligence (3.1–3.8)

- [ ] **3.1** — Hono v4 backend on Cloudflare Workers
- [x] **3.2** — AI proxy endpoint (hides OpenRouter key server-side; removes BYOK requirement) — **done in Phase 1** via `POST /api/ai/chat` on the Express backend
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
