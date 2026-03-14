# Commercialization — Backend & Intelligence

> Purpose: detailed planning for the Commercialization phase stream covering backend platform work, proxy-backed intelligence, and operational controls.
> The active checklist remains in `todo.md`.

## Scope

This stream covers the commercial-ready backend runtime and the hosted intelligence capabilities that extend the local-first foundation already shipped in Phase 1.

### Included work

- Hono v4 backend on Cloudflare Workers
- Weather proxy endpoint
- AI-enhanced suggestion engine via proxy
- Rate limiting and per-user usage tracking

### Foundation already complete

- `POST /api/ai/chat` exists in the Express backend
- Frontend AI calls already route through the backend-only proxy path
- Frontend AI timeout and error surfacing are already hardened for slower models

## Commercialization Milestones

- **C.1 — Workers runtime migration**
  Move the current backend responsibilities onto Hono v4 running on Cloudflare Workers without breaking the frontend API contract.

- **C.2 — Weather proxy**
  Introduce a backend weather proxy layer where it adds operational or quota value, while keeping Open-Meteo's current no-key path in mind.

- **C.3 — AI-enhanced suggestion engine via proxy**
  Extend the existing proxy-backed suggestion flow into a commercialization-ready service with clearer hosting assumptions and operational controls.

- **C.4 — Rate limiting + usage tracking**
  Add backend-side rate limiting, quota accounting, and user/workspace attribution so paid intelligence features have enforceable limits.

## Notes

- Do not reintroduce silent model fallback. The existing product decision still applies: surface the error and stop.
- Maintain the local-first escape hatch. Hosted intelligence must remain an added capability, not a hard dependency for the base planner.
- Preserve the current sanitized frontend settings shape. Secrets stay server-side.

## Open Questions

- Should weather remain direct-to-provider in local/self-hosted mode and only move behind a proxy for hosted/commercial tiers?
- Should usage tracking attach to `user_id`, `workspace_id`, or both from the first implementation?
- Is the first hosted backend target Cloudflare-only, or should interfaces stay portable enough for alternative deployments?

## Dependencies

- `hono`
- `@hono/zod-validator`
- `wrangler`
