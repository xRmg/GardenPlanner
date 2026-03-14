# Commercialization — Auth & Sync

> Purpose: detailed planning for Commercialization phase auth, per-user data ownership, and cloud sync.
> The active checklist remains in `todo.md`.

## Scope

This stream turns the current single-user/local-first application into a multi-user, commercially hosted product with clear ownership boundaries and sync.

### Included work

- Supabase Auth
- Per-user data schema in Postgres
- Row-Level Security and data isolation tests
- Dexie ↔ Supabase bi-directional sync adapter

## Commercialization Milestones

- **C.9 — Supabase Auth**
  Add email/password auth with optional OAuth support.

- **C.10 — Per-user data schema**
  Introduce `workspace_id`, `user_id`, and related ownership fields in Postgres so cloud data has explicit tenancy.

- **C.11 — RLS + isolation tests**
  Enforce access boundaries in the database and prove them with automated tests.

- **C.12 — Dexie ↔ Supabase sync adapter**
  Preserve the local-first user experience by treating Dexie as the local cache and sync boundary.

## Notes

- Keep permission logic centralized. Avoid scattering role checks through UI components.
- Align schema and role concepts with `docs/product-vision.md`.
- Offline editing remains important. Sync should reconcile state rather than replacing the local-first model.

## Open Questions

- What is the first conflict-resolution model for concurrent edits: last-write-wins, field-level merge, or server-authoritative conflict queues?
- Which entities must sync first for a usable hosted alpha: settings, areas, planters, events, plants, seedlings?
- Should invitations and workspace management ship with auth first, or come after single-user hosted mode is stable?

## Dependencies

- `@supabase/supabase-js`
