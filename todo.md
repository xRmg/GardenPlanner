# Garden Planner — TODO

> **Created**: 2026-02-25
> **Status**: Phase 1 complete — 1.1–1.14 ✅ · Phase 1B queued
> **Current sprint**: Phase 1B — metaplants, plant state, view persistence, prompt hardening
> **Purpose**: Active implementation roadmap. Architecture decisions → `docs/architecture-decisions.md`. Product vision → `docs/product-vision.md`.

---

## Roadmap

| Phase  | Focus                                           | Status         |
| ------ | ----------------------------------------------- | -------------- |
| **1**  | Foundation + smart suggestions (local-first)    | ✅ Complete    |
| **1B** | Plant intelligence & garden UX polish           | ⬜ Next        |
| **2**  | Internationalization (i18next, en + nl)         | ⬜ Queued      |
| **3**  | Backend, intelligence proxy & multi-user auth   | ⬜ Future      |

---

## Phase 1 — Foundation & Smart Suggestions

**Goal**: Clean local-first architecture, IndexedDB persistence, backend AI proxy, rules + AI suggestion engine.

### ✅ Completed

- **1.1–1.5** — Zod schemas, `GardenRepository` interface, Dexie v4, auto-migration from localStorage, JSON export/import
- **1.6** — Decomposed `App.tsx` into 8 custom hooks (`useGardenData`, `usePlantCatalog`, `useSeedlingManager`, `useAreaManager`, `useGardenEvents`, `useOpenRouterSettings`, `useLocationSettings`, `usePlantAILookup`)
- **1.7–1.8b** — Backend AI proxy settings + "Ask AI ✨" plant lookup with 30-day cache; all AI calls routed via `POST /api/ai/chat` (key server-side) → see [`docs/ai-integration-design.md`](docs/ai-integration-design.md)
- **1.9** — Dual-mode suggestion engine: weather service (Open-Meteo), rules engine (7 rules + frost), AI suggestions (10 types, 24h cache), merger, `useSuggestions` hook, wired into `EventsBar`, Dexie v7 (`weatherCache` + `aiSuggestionsCache`), full test suite → see [`docs/suggestion-engine-architecture.md`](docs/suggestion-engine-architecture.md)
- **1.10** — Plant schema enrichment: added richer care fields (`watering`, `growingTips`, spacing/harvest metadata), bundled plant seeding, and `PlantDetailsDialog` care rendering
- **1.11** — Pest + treatment events: added `pest` + `treatment` event types, plant-local pest history, journal mirroring, instance-aware treatment suggestions, and AI-backed treatment options with a custom fallback
- **Testing** — Vitest + schema/repository/rules-engine tests
- **1.13** — Auto-derive `koeppenZone` from lat/lng via Open-Meteo 30-year climate normals; pure `classifyKoppen(T, P, lat)` function; written to `settings.growthZone` when user picks a city in Settings
- **1.12** — Calendar view: month-navigable component showing events, suggestions, and harvest periods for planted crops
- **1.14** — Error boundaries + Sonner toast notifications for async failures, with root crash recovery and surfaced sync/settings/AI failures
- **Bug fixes** — Events + plant placements persisted to Dexie (previously lost on refresh)

### ✅ Phase 1 Complete

- [x] **1.12** — Calendar view: month-navigable component showing events, suggestions, and harvest periods for planted crops
- [x] **1.14** — Error boundaries + Sonner toast notifications for all async failures

---

## Phase 1B — Plant Intelligence & Garden UX

**Goal**: Metaplant grouping for smart multi-cell suggestions, plant lifecycle and health states, persistent view modes, and prompt injection hardening.

- [ ] **1B.1 — Metaplant grouping**  
  Adjacent cells sharing the same **plant name** (8-connected, diagonal included) are treated as a single metaplant at runtime — no schema storage needed. Metaplant identity is computed via flood-fill on the grid each time it is needed. When a pest, treatment, or care event is logged on any cell in a metaplant group, it is automatically propagated to all cells in that group. Variety differences do not break grouping (a named variety is a distinct plant entry in the catalogue, so will naturally not group with the base species). Display: highlight all grouped cells when one is selected.  
  **Selection model**: left-click (or tap) selects the entire metaplant group — all cells highlight and any logged event applies to all. Right-click (or long-press on touch, via `onContextMenu`) selects a single cell only, bypassing the group — useful for recording an event or health state on one individual plant within a larger patch. A subtle visual distinction (e.g. single-cell highlight vs. full-group highlight) makes the two modes obvious.

- [ ] **1B.2 — Plant growth stage (auto-derive + manual override)**  
  Add `growthStage: 'sprouting' | 'vegetative' | 'flowering' | 'fruiting' | 'dormant' | null` to `PlantInstance` in `schema.ts`. Auto-derive from planting date + new optional `Plant` schema fields `daysToFlower` and `daysToFruit` (both `number | null`). Store a manual override flag `growthStageOverride: boolean` so the rules engine knows whether the stage was user-set. Manual override via a picker in `PlantDetailsDialog`. Stage feeds the rules engine: `dormant` suppresses watering and fertilising suggestions; `fruiting` triggers harvest-window reminders. Applies per-cell and per-metaplant.

- [ ] **1B.3 — Plant health state**  
  Add `healthState: 'healthy' | 'stressed' | 'damaged' | 'diseased' | 'dead' | null` to `PlantInstance`. Changing health state **auto-creates a `GardenEvent`** journal entry (e.g. event type `observation`, note auto-populated as "Health state changed to: damaged") so there is always a timestamped record. UI: quick-set health picker in `PlantDetailsDialog`; visual indicator on grid cell (coloured dot or desaturated cell). Health state feeds the rules engine: `damaged` or `diseased` escalates pest and treatment suggestion priority; `dead` suppresses all suggestions and marks the cell visually as inactive.

- [ ] **1B.4 — View mode persistence (view vs. edit layout)**  
  Area planner has two explicit modes: **View** (interact with plants — click to log events, see details) and **Edit Layout** (structural changes — add/remove/resize planters, reorder). Mode toggle is a persistent setting in `Settings` (Dexie), defaulting to View. Additionally persist `lastSelectedAreaId` and `lastSelectedPlanterId` to `Settings` so the user returns to exactly where they left off after a page reload.

- [ ] **1B.5 — Prompt injection hardening**  
  Three-layer defence:
  1. **Input layer** — Add `maxlength` HTML attributes and Zod `.max()` refinements in `schema.ts`: plant name ≤ 80 chars, variety ≤ 80 chars, pest name ≤ 120 chars, free-text notes/tips ≤ 500 chars.
  2. **AI call site** (`app/services/ai/`) — Truncate all user-sourced strings to their respective max lengths before inserting into any prompt template. Log a warning if truncation occurs.
  3. **Backend** (`backend/src/routes.ts`) — Add `z.string().max()` to all string fields in the `/api/ai/chat` Zod request schema. Reject oversized payloads with HTTP 400 before they reach OpenRouter. This prevents users who call the API directly from bypassing client-side limits.

- [ ] **1B.6 — Calendar day detail panel**  
  Clicking a day in `CalendarView` opens a detail popover/sheet showing the full log for that day: all `GardenEvent` entries (type, plant, note), active suggestions that were generated for that date, and any harvest-window crops. Empty days show a friendly empty state. The popover is dismissible via Escape or clicking outside and includes a quick-add shortcut to log a new event directly for that day.

- [ ] **AI-8 fix** — Remove the silent multi-model fallback from `app/services/ai/aiSuggestions.ts`. On AI failure, surface a clear error to the user and stop — do not retry with an alternative model. Aligns with the existing `usePlantAILookup` behaviour and the explicit product decision recorded above.

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

- [ ] **AI-8** *(LOW — resolved in 1B.5 fix)* `aiSuggestions.ts` silent multi-model fallback to be removed in task **1B AI-8 fix** — fail clearly, no alternative model retry. See note below.

- [x] **AI-9** *(resolved)* The AI design docs now describe the proxy-only flow and the dedicated backend settings endpoints.

> **Product decision — AI-8**: Do **not** fall back to alternative models on AI failure. Present the error clearly and stop. No silent fallbacks.
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


## Scratchpad.

*All items promoted to Phase 1B (tasks 1B.1–1B.5 + AI-8 fix).*