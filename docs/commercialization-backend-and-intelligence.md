# Commercialization — Backend & Intelligence

> Purpose: detailed planning for the Commercialization phase stream covering backend platform work, proxy-backed intelligence, and operational controls.
> The active checklist remains in `todo.md`.

## Scope

This stream covers the hosted intelligence and backend platform work that follows the local-first foundation already shipped in Phase 1. `todo.md` is the sequencing source of truth: hosted foundation starts in **P3A**, managed AI/admin controls land in **P3B**, and backend portability follows only after feature/API parity is preserved.

### Included work

- Hosted backend evolution from the current Express service
- Weather proxy endpoint
- AI-enhanced suggestion engine via proxy
- Rate limiting and per-user usage tracking
- Runtime portability work after hosted feature parity is stable

### Foundation already complete

- `POST /api/ai/chat` exists in the Express backend
- Frontend AI calls already route through the backend-only proxy path
- Frontend AI timeout and error surfacing are already hardened for slower models

## Phase Alignment

### P3A dependency

- Hosted auth, single-user workspace ownership, workspace-scoped persistence, and onboarding now land on the current Express + SQLite backend.
- The current Express backend remains the active hosted implementation until the managed-AI/admin surface has shipped with API parity.
- Hosted onboarding records AI intent (`none`, `own key`, `managed`) without enabling managed AI yet; that contract carries into P3B.

### P3B scope

- **P3B.1–P3B.3** — Three AI modes (`none`, `own key`, `managed`), entitlements, rate limiting, and usage tracking
- **P3B.4–P3B.10** — Hosted AI caching, freshness metadata, invalidation, and admin/support visibility
- **P3B.11** — Runtime portability (Workers or equivalent) only after the shipped hosted feature set preserves the existing API contract

## Notes

- Do not reintroduce silent model fallback. The existing product decision still applies: surface the error and stop.
- Maintain the local-first escape hatch. Hosted intelligence must remain an added capability, not a hard dependency for the base planner.
- Preserve the current sanitized frontend settings shape. Secrets stay server-side.
- Treat Hono/Workers as a portability target, not the starting point for hosted rollout.

## Open Questions

- Should weather remain direct-to-provider in local/self-hosted mode and only move behind a proxy for hosted/commercial tiers?
- Should usage tracking attach to `user_id`, `workspace_id`, or both from the first implementation?
- When portability work starts, is the first non-Express hosted backend target Cloudflare-only, or should interfaces stay portable enough for alternative deployments?

## Dependencies

- `hono`
- `@hono/zod-validator`
- `wrangler`
