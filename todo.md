# Garden Planner — TODO

> **Created**: 2026-02-25
> **Status**: Foundation ✅ · Plant intelligence ✅ · Internationalization ✅
> **Current sprint**: Phase 3 delivery slicing
> **Purpose**: Running backlog and phase priorities. Deep planning docs live in `docs/` so this file stays actionable.

---

## Roadmap

| Phase  | Focus                                           | Status         |
| ------ | ----------------------------------------------- | -------------- |
| **1**  | Foundation + smart suggestions (local-first)    | ✅ Complete    |
| **1B** | Plant intelligence & garden UX polish           | ✅ Complete    |
| **2**  | Internationalization (i18next, en + nl)         | ✅ Complete    |
| **3A** | Hosted single-user foundation + onboarding      | 🟨 In progress |
| **3B** | Managed AI + admin controls                     | ⬜ Planned     |
| **3C** | Shared plant library                            | ⬜ Planned     |
| **3D** | Team / family collaboration + sync              | ⬜ Planned     |

---

## What Was Done

- 2026-03-17: Added a custom planning agent at `.github/agents/garden-planner-planning.agent.md` that enforces bounded scope, end-to-end planning, ask-questions usage, expert delegation through `runSubagent`, documentation updates, and mandatory `todo.md` update steps.
- 2026-03-17: Hardened backend API access with fail-closed proxy token auth (`X-Garden-Proxy-Auth`), auto-generated shared secret bootstrap in Docker, and same-origin CORS restrictions.
- 2026-03-17: Enforced gateway user identity on all API calls by requiring `X-Garden-User` (forwarded from gateway `X-Forwarded-User`) in addition to proxy token auth.
- 2026-03-20: Re-sliced Phase 3 into shippable hosted increments so each release delivers a complete feature, preserves local mode, and avoids half-migrated backend work.
- 2026-03-20: Shipped Phase 3A foundation: hosted sign-up/sign-in/session/recovery, single-user workspace ownership, workspace-scoped backend persistence, config-gated hosted onboarding, and no-regression local mode.

---

## Completed

- [x] **Phase 1 — Foundation + Smart Suggestions** — Local-first repository, JSON import/export, backend AI proxy, dual-mode rules/weather/AI suggestions, plant care enrichment, calendar view, and async error handling. See `docs/ai-integration-design.md` and `docs/suggestion-engine-architecture.md`.
- [x] **Phase 1B — Plant Intelligence & Garden UX** — Metaplant grouping, plant lifecycle and health, persisted view mode, prompt hardening, and calendar day detail workflow.
- [x] **Phase 2 — Internationalization** — i18n infrastructure, English + Dutch translations, plant name localization, and locale persistence. See `docs/i18n-and-plant-library-architecture.md` and `docs/adding-a-new-language.md`.
- [x] **AI hardening** — Backend-only AI routing, no silent model fallback, visible Ask AI affordance when configured, and 25-second frontend AI timeout.
- [x] **Measurement Units & Customizable Grid Sizing** — Unit-system settings, planter cell dimensions, pot/container layouts, localized dimension formatting, and migration/backfill support shipped.
- [x] **Scoped Garden Actions** — Scoped plant, planter, and area actions now flow through suggestions, journal history, calendar detail, and quick actions with backward-compatible event context.
- [x] **Locale-Aware AI Suggestion Lifecycle** — Scoped suggestion metadata, locale-partitioned AI cache keys, aggregation rules, completion consistency, and lifecycle test coverage shipped.

## Phase 3 — Commercialization Delivery Plan

**Goal**: Turn the local-first product into a commercial-ready platform without losing the offline-first core.

> Product and tier context: `docs/product-vision.md`  
> Architecture decisions: `docs/architecture-decisions.md`

### Delivery Rules

- [ ] Each Phase 3 slice must ship as a complete, usable feature with no broken intermediate state.
- [ ] Preserve the current local/self-hosted experience until the hosted replacement for that slice is production-ready.
- [ ] Land migrations, feature flags/config, fallback behavior, and observability in the same slice as the user-facing feature.
- [ ] Do not lead Phase 3 with pure runtime migration work; backend portability must preserve the existing API contract and ride alongside a shipped feature.

### Phase 3A — Hosted Single-User Foundation + Onboarding

**Release outcome**: A new user can sign up, complete onboarding, get a personal hosted workspace, and use Garden Planner end-to-end without collaboration features yet.

- [x] **P3A.1** — Choose the hosted auth foundation and lock the minimal user profile shape (`id`, `email`, verification state, timestamps, locale only when needed) using the current Express/SQLite backend as the Phase 3A runtime
- [x] **P3A.2** — Add hosted sign-up / sign-in / sign-out / session handling with email verification and a simple recovery flow
- [x] **P3A.3** — Introduce hosted `users`, `workspaces`, and `workspace_memberships` schema with single-owner workspace scoping from day one
- [x] **P3A.4** — Build first-run onboarding: create workspace, set location, choose AI mode (`none`, `own key`, `managed`)
- [ ] **P3A.5** — Add a minimal internal admin/support surface for users, workspaces, entitlement flags, and support diagnostics
- [x] **P3A.6** — Keep the current local/self-hosted mode available via config with no regression to existing users

### Phase 3B — Managed AI + Admin Controls

**Release outcome**: Hosted users can choose between no AI, their own AI key, or a centrally managed AI plan, with usage controls and cache behavior that keeps the app fast.

- [ ] **P3B.1** — Support the three AI modes end-to-end: `none`, `own key`, and backend-managed key
- [ ] **P3B.2** — Add backend/admin-managed AI entitlements and policy controls per workspace or subscription tier
- [ ] **P3B.3** — Add per-user and per-workspace usage tracking, quota enforcement, and rate limiting for managed AI
- [ ] **P3B.4** — Build on the pre-Phase-3 client suggestion cache hardening; add a server-side cache for hosted managed-AI requests to reduce cost and duplicate recomputation
- [ ] **P3B.5** — Define the hosted cache key shape: workspace scope plus locale, model, AI mode, and a stable garden-context fingerprint
- [ ] **P3B.6** — Implement visit-triggered stale-while-revalidate: serve cached suggestions immediately on garden visit, then refresh only when stale by age or material garden-context change
- [ ] **P3B.7** — Persist cache lifecycle metadata (`generatedAt`, `checkedAt`, `expiresAt`, cache source, model, locale) so the UI and admin tools can reason about freshness explicitly
- [ ] **P3B.8** — Add cache invalidation rules for material state changes (planting, harvest, pest/treatment changes, settings affecting prompts, locale/model switch)
- [ ] **P3B.9** — Preserve current fallback behavior so `none` and `own key` users never depend on the managed AI path
- [ ] **P3B.10** — Add admin/support visibility for AI cache freshness, last refresh reason, forced refresh, and failure diagnostics
- [ ] **P3B.11** — Make the backend runtime portable (Workers or equivalent) only after API parity is preserved for the shipped AI/admin feature set

### Phase 3C — Shared Plant Library

**Release outcome**: Hosted and local users can search and sync a shared plant library without losing the silent fallback to bundled plants.

- [ ] **P3C.1** — Shared plant library schema + seed data (en + nl)
- [ ] **P3C.2** — Plant library API (search, detail, and delta sync)
- [ ] **P3C.3** — Client-side plant library sync with silent fallback to bundled plants
- [ ] **P3C.4** — Plant contribution + moderation workflow

### Phase 3D — Team / Family Collaboration + Sync

**Release outcome**: A workspace owner can invite a small number of collaborators, assign simple roles, and share a hosted garden with offline-capable sync.

- [ ] **P3D.1** — Email invite flow for workspace members
- [ ] **P3D.2** — Simple role model: `owner`, `editor`, `viewer`
- [ ] **P3D.3** — Workspace-scoped data ownership in Postgres with data isolation tests
- [ ] **P3D.4** — Dexie ↔ hosted sync adapter for authenticated users
- [ ] **P3D.5** — Conflict policy v1: last-write-wins for mutable records plus append-only event history where practical
- [ ] **P3D.6** — Workspace member management UI in settings/admin flows

### Detailed Reference Docs

- `docs/commercialization-backend-and-intelligence.md`
- `docs/commercialization-plant-library.md`
- `docs/commercialization-auth-and-sync.md`

---

## Running Backlog

- [x] **Grid/pot sizing UI polish** — Reorder planter header to lead with grid spec (not name width), shorten plant abbreviations for pot-container cells (6-7 chars vs 10 for grid)
- [ ] **Pre-Phase 3 suggestion cache hardening** — Finish the client-side cache before hosted work: visit-based stale-while-revalidate on garden open, explicit freshness metadata in UI, reduced dependence on fixed interval refresh, and solid invalidation for locale/model/settings and material garden-state changes
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
| `hono@^4.7`                           | 3B+ | Backend portability / Workers target |
| `@hono/zod-validator@^0.5`            | 3B+ | Request validation             |
| `wrangler@^4`                         | 3B+ | Cloudflare Workers CLI         |
| `@supabase/supabase-js@^2.49` or equivalent OIDC SDK | 3D+ | Future provider portability target if hosted auth moves beyond the current backend implementation |

---

## Scratchpad

- Cleared after shipping the units, scoped-actions, and locale-aware suggestion lifecycle work.

## Backlog Candidates

> No active detailed backlog candidates are being tracked here right now. Recently delivered candidates were moved into Completed so this file stays focused on upcoming work.