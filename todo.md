# Garden Planner — TODO

> **Created**: 2026-02-25
> **Status**: Phase 1 complete — 1.1–1.14 ✅ · Phase 1B complete ✅ · Phase 2 complete ✅
> **Current sprint**: Phase 3 — Backend, intelligence proxy & multi-user auth
> **Purpose**: Active implementation roadmap. Architecture decisions → `docs/architecture-decisions.md`. Product vision → `docs/product-vision.md`.

---

## Roadmap

| Phase  | Focus                                           | Status         |
| ------ | ----------------------------------------------- | -------------- |
| **1**  | Foundation + smart suggestions (local-first)    | ✅ Complete    |
| **1B** | Plant intelligence & garden UX polish           | ✅ Complete    |
| **2**  | Internationalization (i18next, en + nl)         | ✅ Complete    |
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

### ✅ Phase 1B Complete

- [x] **1B.1 — Metaplant grouping** — Flood-fill BFS (8-connected) finds same-name cell groups; left-click highlights group with green ring + propagates pest events to all members; right-click selects single cell with amber ring; pre-click group indicator dot on multi-cell groups.

- [x] **1B.2 — Plant growth stage** — `growthStage` / `growthStageOverride` / `daysToFlower` / `daysToFruit` added to schema; `plantGrowthStage.ts` auto-derives stage from planting date + plant timeline; manual override picker in `PlantDetailsDialog`; rules engine skips dormant/dead plants for watering/fertilising.

- [x] **1B.3 — Plant health state** — `healthState` added to schema; auto-creates `observation` GardenEvent on change; health picker in `PlantDetailsDialog`; coloured dot indicator on grid cells; dead cells desaturated; rules engine escalates damaged/diseased to `high` priority, suppresses suggestions for dead plants.

- [x] **1B.4 — View mode persistence** — `isEditMode`, `lastSelectedAreaId`, `lastSelectedPlanterId` added to Settings schema; persisted to Dexie automatically; `isEditMode` defaults to View (false); scroll-to-last-selected-area on page reload; area divs get `id="area-{id}"` for scroll targeting.

- [x] **1B.5 — Prompt injection hardening** — Three-layer defence: Zod `.max()` on all user-input fields (name 80, variety 80, notes 500, location 200); `truncate()` helper in `prompts.ts`; `buildAISuggestionContext` truncates before sending to AI; backend `SettingsPatchRequestSchema` adds `.max(20)` to `growthZone`.

- [x] **1B.6 — Calendar day detail panel** — Clicking any day opens a Sheet with full log (events, suggestions, harvests), friendly empty state, and quick-add buttons for common event types (watered, harvested, pest, note).

- [x] **AI-8 fix** — Silent multi-model fallback removed from `aiSuggestions.ts`; single model attempt only; error propagated via `result.aiError` to `useSuggestions`; surfaced to user via toast notification.

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

- [x] **AI-8** *(resolved)* `aiSuggestions.ts` silent multi-model fallback removed; single model attempt only; errors surfaced via `result.aiError` and toast notification.

- [x] **AI-9** *(resolved)* The AI design docs now describe the proxy-only flow and the dedicated backend settings endpoints.

- [x] **AI-10** *(resolved)* `PlantDefinitionDialog.tsx` now keeps the AI autofill bar visible whenever server-side AI is configured; the action remains disabled until the plant name is long enough, instead of disappearing entirely.

- [x] **AI-11** *(resolved)* `openrouter.ts` now supports per-request proxy timeouts and defaults all frontend AI calls to a 25s timeout so plant lookup, treatment options, and AI suggestions do not fail prematurely on slower models.

> **Product decision — AI-8**: Do **not** fall back to alternative models on AI failure. Present the error clearly and stop. No silent fallbacks.
---

## Phase 2 — Internationalization

**Goal**: Full i18n infrastructure, English + Dutch translations, locale-aware formatting.

> Design spec: `docs/i18n-and-plant-library-architecture.md`  
> How to add a new language: `docs/adding-a-new-language.md`

- [x] **2.1** — Install `i18next`, `react-i18next`; configure TypeScript namespace augmentation (`app/i18n/config.ts`, `app/i18n/i18next.d.ts`); `detectBrowserLocale()` helper for manual locale detection
- [x] **2.2** — Extract ~373 hardcoded strings from `App.tsx`, `EventsBar`, `ToolBar`, and all dialogs into `app/i18n/locales/en/{ui,plants,calendar,errors}.json`; all components updated to use `useTranslation()`
- [x] **2.3** — Replace hardcoded `["J","F","M","A","M","J","J","A","S","O","N","D"]` month array with `Intl.DateTimeFormat` via `formatMonthNarrow()` in `app/i18n/utils/formatting.ts`
- [x] **2.4** — Dutch (nl) translations: `ui.json`, `plants.json`, `calendar.json`, `errors.json`
- [x] **2.5** — Plant name translations: en + nl entries for all 10 bundled plants + 55 additional common plants in `app/i18n/locales/{en,nl}/plants.json`; `getPlantName()` helper in `app/i18n/utils/plantTranslation.ts`
- [x] **2.6** — Language switcher in Settings tab; browser locale auto-detected on first visit via `detectBrowserLocale()` in `useGardenData.ts`; choice persisted to `settings.locale` in Dexie + `gp_locale` in localStorage; `<html lang>` updated

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
| ~~`i18next@^24`~~                     | ~~2~~ | ✅ installed (`^25`)           |
| ~~`react-i18next@^15`~~               | ~~2~~ | ✅ installed (`^16`)           |
| ~~`i18next-browser-languagedetector@^8`~~ | ~~2~~ | Not used — detection handled manually in `useGardenData.ts` |
| `hono@^4.7`                           | 3     | Backend framework (Workers)    |
| `@hono/zod-validator@^0.5`            | 3     | Request validation             |
| `wrangler@^4`                         | 3     | Cloudflare Workers CLI         |
| `@supabase/supabase-js@^2.49`         | 3     | Supabase client                |

---

## Scratchpad.

### Locale-Aware AI Suggestion Lifecycle

**Status**: Investigated, not yet scheduled into a phase.

**Why this belongs in the roadmap**: AI suggestions already combine garden state, weather, and user settings, but they remain vulnerable to two quality failures: mixed-language cache leakage and overly coarse cache freshness. Locale-specific suggestions must never show stale text from another language, and expensive AI inference should be reused deliberately instead of re-run on every refresh.

**Product shape**: Suggestions should feel local to the active gardener context. When the locale changes, all user-visible AI copy should switch cleanly without English fallback leakage. Cached AI suggestions should carry lifecycle metadata so the UI and rules engine know when to reuse, refresh, or drop them. The experience should stay fast, predictable, and transparent without introducing a separate cache management UI.

### Requirements

- [ ] **LAS.1 — Locale-partitioned cache keys** — Every AI suggestion cache key must include `locale` together with the existing garden/weather context hash so English and Dutch batches cannot collide.
- [ ] **LAS.2 — Suggestion lifecycle metadata** — Persist `spawnedAt`, `expiresAt`, `locale`, `model`, and cache-version metadata for each AI suggestion batch so freshness and invalidation decisions are explicit.
- [ ] **LAS.3 — Per-type TTL policy** — Introduce policy-based cache durations by suggestion type. Fast-changing suggestions such as weather risk or pest alerts should expire in hours; slower strategic suggestions such as succession sowing or mulch can persist for days.
- [ ] **LAS.4 — Locale switch invalidation** — Changing `settings.locale` must never reuse previously cached AI copy from another locale. The app should either fetch a matching locale batch or fall back to localized rules and weather suggestions only.
- [ ] **LAS.5 — No mixed-language suggestion bodies** — AI suggestion titles, descriptions, and rationale shown in the UI must always be generated in the active locale. Canonical IDs such as plant refs and planter IDs remain locale-independent.
- [ ] **LAS.6 — Spawn-aware refresh behavior** — The suggestion engine should be able to keep a still-valid cached batch, serve it immediately, and decide whether a background refresh is needed based on `spawnedAt`, freshness window, and relevant context changes.
- [ ] **LAS.7 — Deterministic invalidation triggers** — Cache entries must be invalidated when relevant context changes materially, including locale, selected AI model, growth zone, coordinates, planted areas, or recent events that affect due work.
- [ ] **LAS.8 — Explainability in debug paths** — Development logs and any future diagnostics should show whether a suggestion batch came from cache or fresh inference, which locale it belongs to, and when it expires.
- [ ] **LAS.9 — Migration safety** — Existing `aiSuggestionsCache` rows without locale or lifecycle metadata should be treated as stale and rebuilt safely after migration.
- [ ] **LAS.10 — Test coverage** — Add unit tests covering locale cache separation, TTL expiry, stale invalidation, and fallback behavior when a requested locale batch does not exist.

### Non-goals for the first phase of this feature

- [ ] No machine-translation fallback layer for AI copy.
- [ ] No user-facing cache controls or manual refresh history.
- [ ] No sharing of AI suggestion cache rows across different locales, even when the underlying semantic content is similar.



## Backlog Candidates

> Items investigated and scoped but not yet scheduled into a phase. These represent strategic opportunities to enhance the planner based on user research and architecture findings.

## Backlog Candidate — Scoped Garden Actions

**Status**: Investigated, not yet scheduled into a phase.

**Why this belongs in the roadmap**: The rules engine already thinks in planter-wide tasks for watering, weeding, fertilising, no-watering, and frost protection, but the persisted event model and manual logging flow are still mostly plant-centric or unscoped. A future phase should unify this into one scoped action model instead of adding a separate maintenance feature.

**Product shape**: Scoped actions should feel like a natural extension of the current planner flow. Users should complete them from existing surfaces such as suggestion cards, planter headers, area headers, and the calendar detail sheet, rather than switching into a different mode or dashboard.

### Requirements

- [ ] **SGA.1 — Scoped action model** — Garden actions must support `plant`, `planter`, and `area` scopes. Persist explicit scope metadata plus location references so the journal, calendar, suggestion engine, and future analytics can distinguish plant care from planter-wide work and area-wide work.
- [ ] **SGA.2 — Reuse existing entry points** — Scoped actions should enter through the current flow: suggestion completion, planter-level actions, area-level actions, and calendar quick-add. Do not introduce a separate maintenance module or duplicate planner surface.
- [ ] **SGA.3 — Planter quick actions** — Add contextual quick actions for work that is commonly done per planter: watered, fertilised or composted, weeded, mulched, frost protection, and observation. Each action should create one scoped journal entry with optional notes.
- [ ] **SGA.4 — Area action aggregation** — Allow the same action to be logged once for an area when it genuinely applies across multiple planters. Area actions should roll up repeated work, satisfy cooldown logic for the included planters, and prevent duplicate follow-up suggestions immediately after completion.
- [ ] **SGA.5 — Suggestion integration** — Existing planter-global rules should surface as explicit scoped tasks with clear location labels. Area-level suggestions should only appear when multiple sibling planters share the same due action; otherwise keep the more precise planter suggestion.
- [ ] **SGA.6 — Journal and calendar clarity** — Event history and calendar detail views must show scope clearly with area and planter context, and location-dependent quick-add actions must require a target instead of creating ambiguous unscoped entries.
- [ ] **SGA.7 — Treatment safeguards** — Planter-level or area-level treatments may be logged as maintenance actions, but they must not automatically clear plant-instance pest state unless the gardener explicitly confirms which plants were treated. `PlantInstance.pestEvents` remains the canonical unresolved pest and treatment record for individual plants.
- [ ] **SGA.8 — Compatibility with current plant flow** — Plant-specific actions such as planting, harvesting, removal, pest logging, and instance-level treatment suggestions must continue to work without extra friction. Bulk actions should complement plant details, not replace them.
- [ ] **SGA.9 — Backward compatibility** — Existing planter-linked journal entries should migrate cleanly into the scoped model without losing history, and renamed areas or planters should still display meaningful event context.

### Non-goals for the first phase of this feature

- [ ] No separate maintenance dashboard or task center.
- [ ] No bulk planting, bulk harvest, or bulk removal workflow in the first scoped-actions phase.
- [ ] No automatic fan-out of a single area action into synthetic per-plant events unless a later reporting requirement justifies it.

---

## Backlog Candidate — Plant Drag and Drop

**Status**: Delivered.

**Why this belongs in the roadmap**: The current planner supports click-to-place, open-details, and remove or re-add, but not relocation. Rearranging a bed or moving plants between planters currently forces destructive steps and risks losing context. A future phase should support direct movement while preserving plant identity and care history.

**Product shape**: Drag and drop should behave as direct manipulation of already-placed plants inside the existing planner. It should live primarily in edit mode, complement click placement from the toolbar, and avoid interfering with the current view-mode interaction model.

### Requirements

- [x] **PDD.1 — Direct relocation flow** — Users can move an existing placed plant within the same planter, to a different planter, and across areas without deleting and re-adding it. Occupied targets use swap semantics.
- [x] **PDD.2 — Edit-mode only interaction** — Drag and drop should be active only in layout edit mode so current view-mode behaviours such as opening plant details and metaplant inspection remain unchanged.
- [x] **PDD.3 — Preserve plant identity** — A move must retain the same `PlantInstance.instanceId`, planting date, harvest date, variety, pest events, growth stage state, health state, and any future plant-local history. Moving is relocation, not replanting.
- [x] **PDD.4 — Clear target rules** — Empty squares should accept a drop immediately. Occupied squares need a deterministic outcome with explicit UX, such as swap, replace-with-confirmation, or reject, so users never lose a plant silently.
- [x] **PDD.5 — Cross-planter persistence** — Moving across planters or areas updates source and destination planter grids in one atomic state change, and persists cleanly across refresh.
- [x] **PDD.6 — Metaplant safety** — Dragging one square in a same-name metaplant cluster must move only that specific `PlantInstance` by default. This move may split, shrink, or fully break an existing metaplant grouping, and that is intended behaviour. Group adjacency alone must not imply bulk movement unless a later explicit group-move flow is added.
- [x] **PDD.7 — Suggestion and journal continuity** — Plant-specific journal entries now carry `instanceId`, rules-engine cooldowns resolve instance-first, calendar location labels follow the plant’s current planter and area, and treatment follow-up remains instance-targeted after moves.
- [x] **PDD.8 — Accessible alternatives** — The feature includes a keyboard-friendly move dialog, a touch-friendly long-press move sheet, clear focus states on grid interactions, and reduced-motion-safe feedback. Drag and drop is no longer mouse-only.
- [x] **PDD.9 — Feedback and control** — During a move, the UI should show what is being moved, which targets are valid, and when a drop is invalid. Accidental moves should be cancellable before drop, and the interaction should stay compatible with a future undo or redo system.
- [x] **PDD.10 — Complement, do not replace** — Click-to-place from the selected toolbar plant remains a supported placement method. The first phase of drag and drop is about moving placed plants, not replacing the full planting workflow.

### Non-goals for the first phase of this feature

- [ ] No drag-from-toolbar or drag-from-catalogue planting flow in the first phase.
- [ ] No bulk multi-select, lasso, or whole-planter movement workflow.
- [ ] No automatic move journal event unless a later reporting or analytics requirement makes relocation history necessary.

---

## Backlog Candidate — Measurement Units & Customizable Grid Sizing

**Status**: Investigated, not yet scheduled into a phase.

**Why this belongs in the roadmap**: Garden planning operates in real-world dimensions—cell sizes, planter widths, and spacing—but Garden Planner currently has no concept of measurement units or customizable grid resolution. Users work around this by inferring cell meanings from context. A future phase should introduce explicit metric/imperial support, sane defaults aligned with gardening conventions (1 ft² for imperial, 30 cm² or 25 cm² for metric), and per-planter customization so planters match users' actual physical layouts.

**Product shape**: Measurement units should be a user-level setting with sensible regional defaults (imperial for US, metric elsewhere). Grid cell sizes should default based on that unit choice and gardening standards (square-foot gardens, metric square-meter grids), and users should customize each planter independently if their physical setup differs. The grid visualization and dialogs should render dimensions in the user's chosen unit system throughout the app.

### Requirements

- [ ] **MUG.1 — Unit system setting** — Add `unitSystem` (`'imperial' | 'metric'`) to `Settings` schema. Default to user's locale region (US/imperial, others/metric). Persist to Dexie. Update `useLocationSettings` hook to expose current unit system.
- [ ] **MUG.2 — Cell size unit semantics** — Model cell dimensions as an explicit quantity with unit (e.g., `{ value: 1, unit: 'feet' }` or `{ value: 30, unit: 'cm' }`). Add `cellDimensions` object to `Planter` schema with `width`, `depth`, and `unit` properties. This semantics enables future display in locale-aware formats.
- [ ] **MUG.3 — Sensible grid defaults** — When creating a new planter, offer presets aligned with standard gardening layouts: **imperial** → 1 ft × 1 ft (square-foot garden); **metric** → 30 cm × 30 cm (metric standard) with option to select 25 cm × 25 cm alternative. Allow custom dimensions as a third option.
- [ ] **MUG.4 — Per-planter customization** — The `PlanterDialog` (create/edit) must allow users to customize cell width and depth independently, with input validation and visual preview of resulting grid. Store explicit dimensions on each planter so different planters can use different grids if the user's physical setup varies.
- [ ] **MUG.5 — Display formatting** — Render planter dimensions in UI using the user's chosen unit system and locale-aware formatting (e.g., "1 ft × 1 ft" or "30 cm × 30 cm"). A `formatDimensions()` utility in `app/i18n/utils/formatting.ts` should handle this consistently across the app.
- [ ] **MUG.6 — Container and pot layouts** — Extend `Planter` schema to support `layout: 'grid' | 'pot-container'` (or similar discriminated union). When `layout` is `'pot-container'`, the grid cell rendering should show round pot icons instead of squares, and `cellDimensions` should represent the pot diameter or footprint. Keep the data model and cell logic unified so suggestions and plant placement work identically regardless of layout type.
- [ ] **MUG.7 — Seed data and bundled plant updates** — Bundled companion data, spacing requirements, and care suggestions may reference standard grid sizes or spacing conventions. Document assumptions and ensure seed data is consistent with the metric/imperial choice (e.g., spacing in both systems for all plants).
- [ ] **MUG.8 — Settings migration and backward compatibility** — On first load after this feature ships, users without an explicit `unitSystem` choice should be assigned a sensible default based on their locale. Existing planters without explicit `cellDimensions` should be assigned the default for their region. Migration must be idempotent.
- [ ] **MUG.9 — Dimension inputs validation** — Cell width and depth must be positive finite numbers and validated with Zod. Display validation errors clearly in the `PlanterDialog` so users cannot save invalid dimensions.
- [ ] **MUG.10 — Locale-aware i18n** — All dimension labels, unit symbols, and defaults must be translatable. Ensure dimension formatting is handled by `Intl` APIs where applicable and falls back to explicit locale data for gardening-specific units.

### Non-goals for the first phase of this feature

- [ ] No automatic unit conversion of historical planter data or existing events. If a user changes their unit system, legacy planters retain their originally configured dimensions.
- [ ] No volume or area calculations (e.g., soil depth, compost needed). Dimensions capture horizontal footprint only.
- [ ] No integration with spacing suggestions or plant recommendations based on cell size in the first phase. Plant care rules remain unchanged; spacing is documented but not enforced.
- [ ] No visualization of planter labels or dimension callouts on the grid itself (reserved for a future UI polish phase).

---

## Backlog Candidate — Community Plant Library with Search, Contribution & Moderation

**Status**: Investigated, scoped, blocked on design decisions (see open questions below). Not yet scheduled into a phase.

**Relationship to existing roadmap**: This is a concrete specification and early-phase version of Phase 3 items 3.5 (Shared plant library schema), 3.6 (Plant library API), 3.7 (Client-side sync), and 3.13 (Plant contribution + moderation). It can be built partially against the current Express/SQLite backend before migrating to D1.

**Why this belongs in the roadmap**: The AI lookup ("Ask AI ✨") is the only path for adding a new plant with pre-filled data today. Users who add a common plant like "Strawberry" should not need an AI call to get watering schedules, harvest months, or companion data — this information is static and should be served from a curated library. The feature also creates a feedback loop where user contributions enrich the shared library over time.

**Product shape**: When the user types in the plant name field of `PlantDefinitionDialog`, results from the backend plant library (filtered by locale) appear inline as suggestions — no dialog swap, no AI call. Selecting a suggestion pre-fills the form. If nothing matches or the user deliberately ignores suggestions, the current workflow (manual entry or AI) continues unchanged. Plants the user saves can optionally flow back to the shared library via a simple contribution pipeline with admin review.

---

### Design Decisions

> Decisions recorded after initial design review. Open points and risks noted below.

**D1 — Scope: local-first, global as upgrade path** ✅
Build against the current Express/SQLite backend first. The schema and API must be designed so that the local backend can later be replaced with a hosted cloud DB (Cloudflare D1) without a frontend change. Plant search is a local SQL query in phase 1; in a future global phase it becomes an HTTP call. The search hook must abstract this difference behind a single interface.

**D2 — Locale-aware storage: `plant_translations` join table** ✅ *(pending full field mapping — see open points)*
All user-visible text fields must be locale-aware: `name`, `variety`, `description`, `watering`, `growingTips`, `companions`, `antagonists`. The `plant_translations` table covers text fields per locale. However, some fields (`companions`, `antagonists`) are currently arrays of plant-name strings — in locale-aware form, each name in the array would itself need to be localized. **This is unresolved complexity; see RISK-1 below.** Decision: use a `plant_translations` join table for `name`, `variety`, `description`, `watering`, `growingTips`. Array-type companion/antagonist fields are deferred to a separate open point.

**D3 — Cross-locale deduplication: latinName as soft canonical key** ✅
`latinName` is the canonical key for deduplication across locales. A library can have locale-specific discrepancies and duplicate common names — that is acceptable. A plant *without* `latinName` can be stored, but cannot be promoted to `published`. The AI lookup already encourages `latinName` to be filled in — the "Ask AI ✨" flow is the natural path to populate it.

**D4 — Display model: flat records shown as "Plant (Variety)"** ✅
Each variety is its own flat record. Autocomplete shows results as `"Strawberry (Elsanta)"`, `"Strawberry (Honeoye)"` etc. — no hierarchy in the schema. The UI groups visually by name when multiple varieties match the same prefix, but the data model stays flat and matches the existing `Plant` schema.

**D5 — Admin auth: static `ADMIN_TOKEN` env var** ✅
All `/admin/*` routes enforced with `Authorization: Bearer $ADMIN_TOKEN` checked against `process.env.ADMIN_TOKEN`. Must be set at deploy time; backend refuses to start (or logs a loud warning) if the env var is absent. Not deferred.

**D6 — User identity: `profileId` for now, prepared for real user IDs** ✅
`submittedBy` stores `profileId` (currently always `'default'`). Schema column typed as `TEXT` so a UUID user ID from Phase 3.9 auth can be stored without migration. A foreign key constraint is not added yet; referential integrity is enforced in application logic at Phase 3.9.

**D7 — Autocomplete: local Dexie catalogue first, then backend library** ✅
`useLibraryPlantSearch` scans the user's existing Dexie plant catalogue before hitting the backend. Local matches appear at the top labelled "In your garden". Prevents accidental re-adds.

---

### Open Points — Discuss Before Implementation

> These are not blockers for the schema or API design, but must be resolved before building the affected components.

**OP-1 — Companions and antagonists locale-aware storage**
`companions` and `antagonists` are arrays of plant *names* (strings), not plant IDs. In a locale-aware library a Dutch user's antagonist list would need to say "Venkel" not "Fennel". Options:
- (a) Store as arrays of `latinName` strings (language-neutral), and resolve to display names at query time via `plant_translations`. Requires all referenced plants to have `latinName`.
- (b) Store as arrays of `plant_id` references and resolve display names via join. Cleaner but requires all companion/antagonist plants to also exist in the library.
- (c) Keep as free-text arrays per locale in `plant_translations` (duplicated, inconsistent across locales).

Option (a) is cleanest but creates a hard dependency on `latinName` coverage. Option (b) is most correct but high implementation cost. **Unresolved: pick (a) or (b) before implementing CPL.2.**

**OP-2 — How does the bundled plant data (en + nl) migrate into the library?**
The app ships with `app/data/bundledPlants.ts` and `app/i18n/locales/{en,nl}/plants.json`. Should the first pass of the library be seeded from the bundled data? If so, do the bundled plants get `publishStatus = 'published'` automatically? This would give the search autocomplete immediate value without waiting for any user contributions. **Unresolved: define the seed data strategy.**

**OP-3 — Search result locale fallback**
If a user's locale is `nl` but a plant only has an `en` translation in `plant_translations`, should it appear in Dutch search results as a fallback, or be excluded? Showing `en` results to a `nl` user may be better than showing nothing but creates mixed-language suggestions. **Unresolved: define fallback policy.**

**OP-4 — AI auto-approval vs. pending**
The current state machine says AI-generated plants auto-approve to `pending` (not directly to `published`). This means every AI lookup still requires admin review before the result feeds back into the library. At scale this creates admin bottleneck. Options: auto-approve AI results to `published` immediately (trust the AI), or keep the pending review queue. **Unresolved: decide trust model for AI contributions.**

**OP-5 — Merge behaviour for conflicts**
CPL.11 lists `{ action: 'keep-existing' | 'promote-new' | 'merge' }` for conflict resolution. The `'merge'` action implies a field-level merge UI (choose which fields to keep from each record). This is significantly more complex than approve/reject. Assess whether merge is actually needed in phase 1, or whether "keep existing" and "promote new" (replace) are sufficient to start.

---

### Risks

**RISK-1 — Locale-aware companions/antagonists are deeply complex**
Companions and antagonists stored as plant name strings are tightly coupled to locale. Cross-locale resolution requires either a complete `latinName` coverage across all referenced plants or a separate plant-ID reference model. If companions/antagonists reference plants that are in `bundledPlants.ts` but *not yet in the backend library*, resolution fails silently. This is the highest-complexity part of the locale model and could significantly expand scope. Containment: defer companions/antagonist locale-awareness to a later sub-phase; store them as `latinName` arrays and note this limitation in the admin UI.

**RISK-2 — `latinName` quality depends on AI output**
The AI lookup does not guarantee a botanically correct `latinName`. If OpenRouter returns a wrong or approximate botanical name (e.g., "Solanum lycopersicum var. cerasiforme" vs "Solanum lycopersicum"), deduplication will fail and create duplicates in the library. Containment: admin review queue sees `latinName` prominently; admin can correct before approving. No automated dedup without manual validation.

**RISK-3 — FTS5 tokenizer quality for Dutch / other languages**
SQLite's `unicode61` tokenizer handles diacritics but does not do stemming. A Dutch user searching "aardbeien" will not find a record stored as "aardbei" (singular). This is a known limitation of FTS5 without a custom tokenizer. Workaround: populate both singular and plural forms in the translations table, or accept this limitation with a note in docs.

**RISK-4 — Admin UI at `/admin` is a client-side route, not a server-side guard**
A client-side React route to `/admin` does not prevent a determined user from discovering and visiting the URL. The actual protection is CPL.12 (server-side token check on API routes). The admin UI itself only shows data that is already protected by the API, so data exposure is limited. But the admin UI's existence (HTML, JS bundle) is visible to anyone who inspects the app. Containment: serve the admin bundle only if `ADMIN_TOKEN` env var is set; otherwise exclude the admin route from the build.

**RISK-5 — No rate limiting on contribute endpoint**
`POST /api/library/plants/contribute` can be called by any browser that can reach the backend. Without rate limiting, a malicious or buggy client could flood the review queue with garbage. CPL.12 (admin token) protects review/approve but not the contribution endpoint. Containment: add per-IP rate limiting (e.g., max 10 contributions per hour) before the contribute endpoint goes live. Track in CPL.7 as a hard requirement.

---

### Publish State Machine

A library plant record has one of four states:

| State | Description |
|---|---|
| `private` | Added manually by the user; no `latinName` required. Never shown to other users. |
| `pending` | Submitted for review; `latinName` required. Has no conflict with existing `published` record. |
| `conflict` | Submitted but a `published` record with the same `latinName` already exists. Held for admin comparison. |
| `published` | Admin-approved or AI-generated (auto-approved). Visible to all users as library suggestions. |
| `rejected` | Admin explicitly rejected. Stored for audit trail, never shown as suggestion. |

Transitions:
- User saves manual plant → `private`
- User saves AI-generated plant (not in library) → `pending` (if `latinName` present) or `private` (if no `latinName`)
- Admin reviews `pending` → `published` or `rejected`
- New submission with same `latinName` as `published` → `conflict` (existing `published` unchanged)
- Admin resolves `conflict` → merges and keeps `published`, or promotes conflict to `published` and demotes old to `superseded`

---

### Requirements

**Backend schema**
- [ ] **CPL.1 — Extended plants table** — Add `publishStatus TEXT DEFAULT 'private'` (`private | pending | conflict | published | rejected`), `latinName TEXT` (required for non-private), `submittedBy TEXT`, `submittedAt TEXT`, `reviewedAt TEXT`, `reviewedBy TEXT`, `conflictOfId TEXT` (FK to `plants.id`), `publishedAt TEXT`, `locale TEXT NOT NULL DEFAULT 'en'`. Add `CHECK` constraint enforcing `latinName IS NOT NULL` when `publishStatus != 'private'`.
- [ ] **CPL.2 — plant_translations table** — `plant_id TEXT REFERENCES plants(id)`, `locale TEXT NOT NULL`, `name TEXT NOT NULL`, `variety TEXT`, `description TEXT`, PRIMARY KEY `(plant_id, locale)`. Migrate existing `plants.name` into this table.
- [ ] **CPL.3 — FTS5 index** — Create `plant_search_fts` virtual table on `plant_translations(name, variety, description)` tokenized by locale. Used for prefix search in autocomplete.
- [ ] **CPL.4 — Conflict detection** — On INSERT into `plants`, if a `published` record already has the same `latinName`, automatically assign `publishStatus = 'conflict'` and set `conflictOfId` to the existing record's ID.

**Backend API**
- [ ] **CPL.5 — Plant search endpoint** — `GET /api/library/plants/search?q=strawb&locale=en&limit=10` searches `plant_search_fts` returning only `published` records in the requested locale. Returns array of `{ id, name, variety, latinName, icon, color, ... }`. Min 2 chars, max 100 chars for `q`.
- [ ] **CPL.6 — Plant detail endpoint** — `GET /api/library/plants/:id` returns full plant record by ID. Only `published` records are reachable via this endpoint.
- [ ] **CPL.7 — Plant contribute endpoint** — `POST /api/library/plants/contribute` accepts a full `Plant` payload plus `submittedBy`. Validates with Zod. Runs conflict detection. Returns `{ status: 'accepted' | 'conflict', id }`. **Must include per-IP rate limiting (max 10 contributions/hour) before going live — see RISK-5.**
- [ ] **CPL.8 — Admin: list review queue** — `GET /admin/plants/review?status=pending&status=conflict` returns paginated list. Requires `Authorization: Bearer $ADMIN_TOKEN`.
- [ ] **CPL.9 — Admin: approve** — `POST /admin/plants/:id/approve` sets `publishStatus = 'published'`, records `reviewedAt` and `reviewedBy`. Requires auth.
- [ ] **CPL.10 — Admin: reject** — `POST /admin/plants/:id/reject` with optional `{ reason }` body. Requires auth.
- [ ] **CPL.11 — Admin: resolve conflict** — `POST /admin/plants/:id/resolve-conflict` with `{ action: 'keep-existing' | 'promote-new' | 'merge' }`. Requires auth.
- [ ] **CPL.12 — Admin static token guard** — All `/admin/*` routes must check `Authorization: Bearer` against `process.env.ADMIN_TOKEN`. Return 401 if missing or invalid. Token must be read from env, never hardcoded.

**Frontend autocomplete**
- [ ] **CPL.13 — useLibraryPlantSearch hook** — Debounced (≥300ms) search hook that calls `GET /api/library/plants/search`. Returns `{ results, isLoading, error }`. Sends the current i18n `locale` as query param. Falls back silently if backend is unreachable (no-op, not error toast).
- [ ] **CPL.14 — Autocomplete in PlantDefinitionDialog** — As the user types ≥2 characters in the plant name field, show a dropdown of library suggestions below the field. Each row shows name, variety (if set), and a small locale tag. Selecting a row pre-fills all form fields from the library record and dismisses the dropdown. Pressing Escape or clicking away closes it without selecting.
- [ ] **CPL.15 — Local catalogue search first** — Before querying the backend library, `useLibraryPlantSearch` first scans the user's local Dexie catalogue for matches. Local results appear at the top of the dropdown with a "In your garden" label; library results follow. This prevents accidental re-adds.
- [ ] **CPL.16 — No-match state** — If typing produces no results from either local or backend, the dropdown is hidden. The form continues as-is; the existing manual / AI path remains fully functional.
- [ ] **CPL.17 — Contribution on save** — When the user saves a plant in `PlantDefinitionDialog`, if the plant originated from an AI lookup (not a library suggestion or manual entry), silently call `POST /api/library/plants/contribute` in the background after saving to Dexie. Failures must not block the save; errors logged only, no user-facing toast.

**Admin UI**
- [ ] **CPL.18 — Admin route at `/admin`** — A separate React route (not linked from any user navigation, no `<Link>` in the app). Renders a standalone review queue page. Protected by checking for a query param or localStorage flag; full server-side protection is in CPL.12.
- [ ] **CPL.19 — Review queue list** — Table of `pending` and `conflict` records with: name, variety, locale, `latinName`, submittedBy, submittedAt, publishStatus badge. Sortable by status and date.
- [ ] **CPL.20 — Record detail panel** — Side panel showing full plant data with all fields. For `conflict` records shows a side-by-side diff of the existing `published` record vs the incoming record.
- [ ] **CPL.21 — Approve / Reject / Resolve actions** — Inline action buttons in the list row and in the detail panel. Approve/Reject are single confirmable actions. Resolve-conflict shows a three-way choice.

---

### Storage Recommendation

**Self-hosted (current Express/SQLite backend)**

SQLite with FTS5 virtual tables. Already in use via `better-sqlite3`. FTS5 is compiled into SQLite's default distribution — no additional dependencies. Add a `plant_search_fts` virtual table on `plant_translations(name, variety, description)` using the built-in `unicode61` tokenizer (handles diacritics and multi-language text). SQLite scales comfortably to millions of plant records for read-heavy name lookups.

**Cloud / shared library (Phase 3)**

Two viable paths consistent with the existing roadmap:

1. **Cloudflare D1 (recommended, already in 3.5)** — SQLite-compatible. The same FTS5 schema migrates without changes. D1 is globally replicated for reads, has a generous free tier, and runs in the same Cloudflare Workers runtime targeted by task 3.1. Zero vendor risk — D1 is escape-hatchable back to SQLite.

2. **Turso (libSQL)** — SQLite-compatible with embedded replica support. Allows the backend to keep a local in-memory replica of the plant library for sub-millisecond autocomplete, syncing from the cloud lazily. Better fit than D1 if self-hosted installs need offline plant search without a live network call. Turso's free tier covers ~8 GB and 1 billion row reads/month. Worth considering if offline-first plant search becomes a requirement.

3. **Supabase Postgres** — Already planned for auth (3.9). Could consolidate the plant library there using `pg_trgm` for full-text search. Simplifies vendor count. Higher operational complexity than D1/Turso for what is ultimately a read-heavy lookup table. Viable if a single vendor (Supabase) for everything is the priority.

**Recommendation**: Build the full schema and workflow against the current SQLite backend. When Phase 3 Cloudflare Workers are targeted, migrate the plant library to D1 — the schema is identical, migration is a file copy + `wrangler d1 execute`. If offline autocomplete without a live backend call becomes a requirement, revisit Turso embedded replicas at that time.

---

### Non-goals for the first phase of this feature

- [ ] No crowd voting, star ratings, or community quality scoring on plants.
- [ ] No per-user plant library (all contributions are anonymous at single-user scope until Phase 3.9 user IDs exist).
- [ ] No bulk import of plant data from external databases (GBIF, USDA PLANTS, Trefle API) — library grows through AI contributions and manual approval only.
- [ ] No automatic translation of plant descriptions into additional locales — record is stored in its original submission locale only.
- [ ] No plant image uploads in this phase (deferred to Phase 3+ "Image uploads" stretch item).
- [ ] No version history or rollback of plant records — admin decisions final for now.z