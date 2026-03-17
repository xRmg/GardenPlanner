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

## What Was Done

- 2026-03-17: Added a custom planning agent at `.github/agents/garden-planner-planning.agent.md` that enforces bounded scope, end-to-end planning, ask-questions usage, expert delegation through `runSubagent`, documentation updates, and mandatory `todo.md` update steps.
- 2026-03-17: Hardened backend API access with fail-closed proxy token auth (`X-Garden-Proxy-Auth`), auto-generated shared secret bootstrap in Docker, and same-origin CORS restrictions.
- 2026-03-17: Enforced gateway user identity on all API calls by requiring `X-Garden-User` (forwarded from gateway `X-Forwarded-User`) in addition to proxy token auth.

---

## Completed

- [x] **Phase 1 — Foundation + Smart Suggestions** — Local-first repository, JSON import/export, backend AI proxy, dual-mode rules/weather/AI suggestions, plant care enrichment, calendar view, and async error handling. See `docs/ai-integration-design.md` and `docs/suggestion-engine-architecture.md`.
- [x] **Phase 1B — Plant Intelligence & Garden UX** — Metaplant grouping, plant lifecycle and health, persisted view mode, prompt hardening, and calendar day detail workflow.
- [x] **Phase 2 — Internationalization** — i18n infrastructure, English + Dutch translations, plant name localization, and locale persistence. See `docs/i18n-and-plant-library-architecture.md` and `docs/adding-a-new-language.md`.
- [x] **AI hardening** — Backend-only AI routing, no silent model fallback, visible Ask AI affordance when configured, and 25-second frontend AI timeout.
- [x] **Measurement Units & Customizable Grid Sizing** — Unit-system settings, planter cell dimensions, pot/container layouts, localized dimension formatting, and migration/backfill support shipped.
- [x] **Scoped Garden Actions** — Scoped plant, planter, and area actions now flow through suggestions, journal history, calendar detail, and quick actions with backward-compatible event context.
- [x] **Locale-Aware AI Suggestion Lifecycle** — Scoped suggestion metadata, locale-partitioned AI cache keys, aggregation rules, completion consistency, and lifecycle test coverage shipped.

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

## Scratchpad

- Cleared after shipping the units, scoped-actions, and locale-aware suggestion lifecycle work.

## Backlog Candidates

> No active detailed backlog candidates are being tracked here right now. Recently delivered candidates were moved into Completed so this file stays focused on upcoming work.