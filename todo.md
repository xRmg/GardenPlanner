# Garden Planner — TODO

> **Created**: 2026-02-25
> **Status**: Foundation ✅ · Plant intelligence ✅ · Internationalization ✅
> **Current sprint**: Commercialization planning
> **Purpose**: Running backlog and phase priorities. Deep planning docs live in `docs/` so this file stays actionable.

---

## Roadmap

| Phase  | Focus                                           | Status         |
| ------ | ----------------------------------------------- | -------------- |
| **1**  | Foundation + smart suggestions (local-first)    | ✅ Complete    |
| **1B** | Plant intelligence & garden UX polish           | ✅ Complete    |
| **2**  | Internationalization (i18next, en + nl)         | ✅ Complete    |
| **3**  | Commercialization                               | ⬜ Planned     |

---

## Completed

- [x] **Phase 1 — Foundation + Smart Suggestions** — Local-first repository, JSON import/export, backend AI proxy, dual-mode rules/weather/AI suggestions, plant care enrichment, calendar view, and async error handling. See `docs/ai-integration-design.md` and `docs/suggestion-engine-architecture.md`.
- [x] **Phase 1B — Plant Intelligence & Garden UX** — Metaplant grouping, plant lifecycle and health, persisted view mode, prompt hardening, and calendar day detail workflow.
- [x] **Phase 2 — Internationalization** — i18n infrastructure, English + Dutch translations, plant name localization, and locale persistence. See `docs/i18n-and-plant-library-architecture.md` and `docs/adding-a-new-language.md`.
- [x] **AI hardening** — Backend-only AI routing, no silent model fallback, visible Ask AI affordance when configured, and 25-second frontend AI timeout.

## Phase 3 — Commercialization

**Goal**: Turn the local-first product into a commercial-ready platform without losing the offline-first core.

> Product and tier context: `docs/product-vision.md`  
> Architecture decisions: `docs/architecture-decisions.md`

### Platform & Intelligence

> Detailed plan: `docs/commercialization-backend-and-intelligence.md`

- [ ] **C.1** — Hono v4 backend on Cloudflare Workers
- [ ] **C.2** — Weather proxy endpoint
- [ ] **C.3** — AI-enhanced suggestion engine via proxy
- [ ] **C.4** — Rate limiting + per-user usage tracking

**Note**: The core AI proxy pattern is already live from Phase 1 via `POST /api/ai/chat` on the Express backend.

### Shared Plant Library

> Detailed plan: `docs/commercialization-plant-library.md`

- [ ] **C.5** — Shared plant library schema + seed data (en + nl)
- [ ] **C.6** — Plant library API (search, detail, and delta sync)
- [ ] **C.7** — Client-side plant library sync with silent fallback to bundled plants
- [ ] **C.8** — Plant contribution + moderation workflow

### Auth & Sync

> Detailed plan: `docs/commercialization-auth-and-sync.md`

- [ ] **C.9** — Supabase Auth (email/password + optional OAuth)
- [ ] **C.10** — Per-user data schema in Postgres (`workspace_id`, `user_id`, RLS policies)
- [ ] **C.11** — Row-Level Security enforcement + data isolation tests
- [ ] **C.12** — Dexie ↔ Supabase bi-directional sync adapter

---

## Running Backlog

- [x] **Grid/pot sizing UI polish** — Reorder planter header to lead with grid spec (not name width), shorten plant abbreviations for pot-container cells (6-7 chars vs 10 for grid)
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
| `hono@^4.7`                           | Commercialization | Backend framework (Workers)    |
| `@hono/zod-validator@^0.5`            | Commercialization | Request validation             |
| `wrangler@^4`                         | Commercialization | Cloudflare Workers CLI         |
| `@supabase/supabase-js@^2.49`         | Commercialization | Supabase client                |

---

## Scratchpad.

### Agreed Planning Order

1. **Measurement Units & Customizable Grid Sizing** — establishes the physical planter model, unit semantics, and layout flexibility that later features depend on.
2. **Scoped Garden Actions** — builds on the clearer planter and area model so maintenance work can be logged and reasoned about at the right scope.
3. **Locale-Aware AI Suggestion Lifecycle** — comes after the planter model and scoped-action model are stable, so AI suggestions can use richer context and better cache semantics.

**Planning note**: Units comes first because planter dimensions and layout type affect how scoped actions should behave. Both of those features then improve the quality and usefulness of locale-aware AI suggestions.

### Locale-Aware AI Suggestion Lifecycle

**Status**: ✅ Delivered — LAS.1–LAS.15 implemented.

**Why this belongs in the roadmap**: The current suggestion system mixes two concerns that now need to be handled together: whole-app suggestion flow and AI-specific lifecycle quality. Suggestions already combine rules, weather, AI, calendar visibility, and completion flows, but they still lack a consistent model for scope, freshness, and locale. The next phase should make suggestions behave predictably across the full app for **Area**, **Planter**, and **Plant** targets while also fixing the AI-specific quality failures of mixed-language cache leakage and overly coarse cache freshness.

**Critical product note**: Despite the title, this feature can no longer be treated as only an AI cache improvement. It must define the lifecycle for the full suggestion pipeline, with AI-specific caching and locale behavior layered on top. If we leave the scope narrow, the app will still produce inconsistent suggestion behavior between EventsBar, calendar, quick-add, and future scoped completion flows.

**Product shape**: Suggestions should feel native to the gardener's current context and should use one coherent flow across the app. The system should support three explicit suggestion scopes:

- **Area** — broad work or risk affecting multiple sibling planters, such as frost protection, heavy-rain preparation, or heat stress.
- **Planter** — focused maintenance affecting one planter, such as watering, weeding, fertilising, mulching, or planter-level observation.
- **Plant** — instance-specific work, such as harvest, treatment, pruning, disease risk, or pest follow-up.

The same scoped suggestion model should drive EventsBar, calendar detail, suggestion completion, and future quick-add flows. Area-wide suggestions may call out especially sensitive plants when that improves actionability, but the primary target scope must remain explicit. For example, a frost warning should target the whole area while still being allowed to mention especially vulnerable plants within that area. When the locale changes, all user-visible AI copy should switch cleanly without English fallback leakage. Cached AI suggestion batches should carry lifecycle metadata so the UI and engine know when to reuse, refresh, aggregate, or drop them. The experience should stay fast, predictable, and transparent without introducing a separate cache management UI.

### Requirements

- [x] **LAS.1 — Scoped suggestion model** — Suggestions must support explicit **Area**, **Planter**, and **Plant** scopes across the full suggestion pipeline, not only AI output. Each suggestion must persist or derive clear target metadata so the UI, completion flow, and future analytics can distinguish broad area work from planter maintenance and plant-specific care.
- [x] **LAS.2 — Scope-aware presentation across the app** — EventsBar, calendar detail, and any quick-add or completion flow must show suggestion scope clearly with human-readable location context. Area suggestions must identify the area first. Planter suggestions must identify the planter. Plant suggestions must identify the plant and its location.
- [x] **LAS.3 — Area suggestions may name sensitive plants** — Area-scoped suggestions such as frost warnings, heat protection, or storm preparation may mention especially sensitive plants when relevant, but the suggestion must remain area-targeted rather than degrading into a list of separate plant suggestions unless the action itself is truly plant-specific.
- [x] **LAS.4 — Locale-partitioned AI cache keys** — Every AI suggestion cache key must include `locale` together with the existing garden, weather, and scope context hash so English and Dutch batches cannot collide.
- [x] **LAS.5 — Suggestion lifecycle metadata** — Persist `spawnedAt`, `expiresAt`, `locale`, `model`, `cacheVersion`, and scope metadata for each AI suggestion batch so freshness, invalidation, and UI behavior are explicit.
- [x] **LAS.6 — Per-type and per-scope TTL policy** — Introduce policy-based cache durations by suggestion type and scope. Fast-changing suggestions such as weather risk, frost alerts, or pest alerts should expire in hours. Slower strategic suggestions such as succession sowing or mulch can persist for days. TTL policy must be explicit rather than one global cache duration.
- [x] **LAS.7 — Locale switch invalidation** — Changing `settings.locale` must never reuse cached AI copy from another locale. The app should either load a matching locale batch or immediately fall back to localized rules and weather suggestions while AI refreshes in the background.
- [x] **LAS.8 — No mixed-language suggestion bodies** — AI suggestion titles, descriptions, and rationale shown in the UI must always be generated in the active locale. Canonical identifiers such as plant refs, planter IDs, and area IDs remain locale-independent.
- [x] **LAS.9 — Spawn-aware refresh behavior** — The suggestion engine should be able to serve a still-valid cached batch immediately, then decide whether background refresh is needed based on `spawnedAt`, freshness window, scope, and relevant context changes. This should apply consistently to suggestion visibility in EventsBar and calendar surfaces.
- [x] **LAS.10 — Deterministic invalidation triggers** — Cache entries must be invalidated when relevant context changes materially, including locale, selected AI model, growth zone, coordinates, area and planter structure, planted instances, and recent events that affect due work or scope aggregation.
- [x] **LAS.11 — Scope-aware suggestion aggregation** — The engine should promote suggestions to **Area** scope only when multiple sibling planters genuinely share the same due action. Otherwise it should keep the more precise **Planter** or **Plant** suggestion. Area aggregation should not erase important plant-specific risk detail.
- [x] **LAS.12 — Completion flow consistency** — Completing a suggestion anywhere in the app must respect its scope. Area completion should resolve the area-targeted work without forcing synthetic plant suggestions. Planter completion should only affect that planter. Plant completion should preserve instance-specific continuity.
- [x] **LAS.13 — Explainability in debug paths** — Development logs and future diagnostics should show whether a suggestion came from rules, weather, AI, or cache, which locale it belongs to, which scope it targets, why it was aggregated or not aggregated, and when it expires.
- [x] **LAS.14 — Migration safety** — Existing `aiSuggestionsCache` rows without locale, lifecycle, or scope metadata should be treated as stale and rebuilt safely after migration.
- [x] **LAS.15 — Test coverage** — Add unit tests covering locale cache separation, TTL expiry, stale invalidation, scope-aware aggregation, fallback behavior when a requested locale batch does not exist, and area-level suggestion copy that includes sensitive plant detail without losing primary scope.

### Non-goals for the first phase of this feature

- [ ] No machine-translation fallback layer for AI copy.
- [ ] No user-facing cache controls or manual refresh history.
- [ ] No sharing of AI suggestion cache rows across different locales, even when the underlying semantic content is similar.
- [ ] No separate suggestion center or task dashboard outside the existing app surfaces.
- [ ] No forced breakup of every **Area** suggestion into synthetic **Planter** or **Plant** suggestions unless later reporting needs justify it.



## Backlog Candidates

> Items investigated and scoped but not yet scheduled into a phase. Delivered items and commercialization specs were moved out of this section so it stays focused on active backlog candidates.

## Backlog Candidate — Measurement Units & Customizable Grid Sizing

**Status**: ✅ Delivered — MUG.1–MUG.10 implemented.

**Why this belongs in the roadmap**: Garden planning operates in real-world dimensions—cell sizes, planter widths, and spacing—but Garden Planner currently has no concept of measurement units or customizable grid resolution. Users work around this by inferring cell meanings from context. A future phase should introduce explicit metric/imperial support, sane defaults aligned with gardening conventions (1 ft² for imperial, 30 cm² or 25 cm² for metric), and per-planter customization so planters match users' actual physical layouts.

**Product shape**: Measurement units should be a user-level setting with sensible regional defaults (imperial for US, metric elsewhere). Grid cell sizes should default based on that unit choice and gardening standards (square-foot gardens, metric square-meter grids), and users should customize each planter independently if their physical setup differs. The grid visualization and dialogs should render dimensions in the user's chosen unit system throughout the app. This feature should also remove the current hard visual minimum that makes planters effectively render at least 4 cells wide: standard narrow beds should support 2-cell-wide layouts, and future pot/container planters may be as small as 1 cell.

### Requirements

- [x] **MUG.1 — Unit system setting** — Add `unitSystem` (`'imperial' | 'metric'`) to `Settings` schema. Default to user's locale region (US/imperial, others/metric). Persist to Dexie. Update `useLocationSettings` hook to expose current unit system.
- [x] **MUG.2 — Cell size unit semantics** — Model cell dimensions as an explicit quantity with unit (e.g., `{ value: 1, unit: 'feet' }` or `{ value: 30, unit: 'cm' }`). Add `cellDimensions` object to `Planter` schema with `width`, `depth`, and `unit` properties. This semantics enables future display in locale-aware formats.
- [x] **MUG.3 — Sensible grid defaults** — When creating a new planter, offer presets aligned with standard gardening layouts: **imperial** → 1 ft × 1 ft (square-foot garden); **metric** → 30 cm × 30 cm (metric standard) with option to select 25 cm × 25 cm alternative. Allow custom dimensions as a third option.
- [x] **MUG.4 — Per-planter customization** — The `PlanterDialog` (create/edit) must allow users to customize cell width and depth independently, with input validation and visual preview of resulting grid. Store explicit dimensions on each planter so different planters can use different grids if the user's physical setup varies. Remove the current hard 4-cell visual minimum so narrow beds can render at 2 cells wide, and allow 1-cell layouts for pot/container planters.
- [x] **MUG.5 — Display formatting** — Render planter dimensions in UI using the user's chosen unit system and locale-aware formatting (e.g., "1 ft × 1 ft" or "30 cm × 30 cm"). A `formatDimensions()` utility in `app/i18n/utils/formatting.ts` should handle this consistently across the app.
- [x] **MUG.6 — Container and pot layouts** — Extend `Planter` schema to support `layout: 'grid' | 'pot-container'` (or similar discriminated union). When `layout` is `'pot-container'`, the grid cell rendering should show round pot icons instead of squares, and `cellDimensions` should represent the pot diameter or footprint. Keep the data model and cell logic unified so suggestions and plant placement work identically regardless of layout type.
- [x] **MUG.7 — Seed data and bundled plant updates** — Bundled companion data, spacing requirements, and care suggestions may reference standard grid sizes or spacing conventions. Document assumptions and ensure seed data is consistent with the metric/imperial choice (e.g., spacing in both systems for all plants).
- [x] **MUG.8 — Settings migration and backward compatibility** — On first load after this feature ships, users without an explicit `unitSystem` choice should be assigned a sensible default based on their locale. Existing planters without explicit `cellDimensions` should be assigned the default for their region. Migration must be idempotent.
- [x] **MUG.9 — Dimension inputs validation** — Cell width and depth must be positive finite numbers and validated with Zod. Display validation errors clearly in the `PlanterDialog` so users cannot save invalid dimensions.
- [x] **MUG.10 — Locale-aware i18n** — All dimension labels, unit symbols, and defaults must be translatable. Ensure dimension formatting is handled by `Intl` APIs where applicable and falls back to explicit locale data for gardening-specific units.

### Non-goals for the first phase of this feature

- [ ] No automatic unit conversion of historical planter data or existing events. If a user changes their unit system, legacy planters retain their originally configured dimensions.
- [ ] No volume or area calculations (e.g., soil depth, compost needed). Dimensions capture horizontal footprint only.
- [ ] No integration with spacing suggestions or plant recommendations based on cell size in the first phase. Plant care rules remain unchanged; spacing is documented but not enforced.
- [ ] No visualization of planter labels or dimension callouts on the grid itself (reserved for a future UI polish phase).

## Backlog Candidate — Scoped Garden Actions

**Status**: ✅ Delivered — SGA.1–SGA.9 implemented.

**Why this belongs in the roadmap**: The rules engine already thinks in planter-wide tasks for watering, weeding, fertilising, no-watering, and frost protection, but the persisted event model and manual logging flow are still mostly plant-centric or unscoped. A future phase should unify this into one scoped action model instead of adding a separate maintenance feature.

**Product shape**: Scoped actions should feel like a natural extension of the current planner flow. Users should complete them from existing surfaces such as suggestion cards, planter headers, area headers, and the calendar detail sheet, rather than switching into a different mode or dashboard.

### Requirements

- [x] **SGA.1 — Scoped action model** — Garden actions must support `plant`, `planter`, and `area` scopes. Persist explicit scope metadata plus location references so the journal, calendar, suggestion engine, and future analytics can distinguish plant care from planter-wide work and area-wide work.
- [x] **SGA.2 — Reuse existing entry points** — Scoped actions should enter through the current flow: suggestion completion, planter-level actions, area-level actions, and calendar quick-add. Do not introduce a separate maintenance module or duplicate planner surface.
- [x] **SGA.3 — Planter quick actions** — Add contextual quick actions for work that is commonly done per planter: watered, fertilised or composted, weeded, mulched, frost protection, and observation. Each action should create one scoped journal entry with optional notes.
- [x] **SGA.4 — Area action aggregation** — Allow the same action to be logged once for an area when it genuinely applies across multiple planters. Area actions should roll up repeated work, satisfy cooldown logic for the included planters, and prevent duplicate follow-up suggestions immediately after completion.
- [x] **SGA.5 — Suggestion integration** — Existing planter-global rules should surface as explicit scoped tasks with clear location labels. Area-level suggestions should only appear when multiple sibling planters share the same due action; otherwise keep the more precise planter suggestion.
- [x] **SGA.6 — Journal and calendar clarity** — Event history and calendar detail views must show scope clearly with area and planter context, and location-dependent quick-add actions must require a target instead of creating ambiguous unscoped entries.
- [x] **SGA.7 — Treatment safeguards** — Planter-level or area-level treatments may be logged as maintenance actions, but they must not automatically clear plant-instance pest state unless the gardener explicitly confirms which plants were treated. `PlantInstance.pestEvents` remains the canonical unresolved pest and treatment record for individual plants.
- [x] **SGA.8 — Compatibility with current plant flow** — Plant-specific actions such as planting, harvesting, removal, pest logging, and instance-level treatment suggestions must continue to work without extra friction. Bulk actions should complement plant details, not replace them.
- [x] **SGA.9 — Backward compatibility** — Existing planter-linked journal entries should migrate cleanly into the scoped model without losing history, and renamed areas or planters should still display meaningful event context.

### Non-goals for the first phase of this feature

- [ ] No separate maintenance dashboard or task center.
- [ ] No bulk planting, bulk harvest, or bulk removal workflow in the first scoped-actions phase.
- [ ] No automatic fan-out of a single area action into synthetic per-plant events unless a later reporting requirement justifies it.