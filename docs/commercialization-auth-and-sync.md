# Commercialization — Auth & Sync

> Purpose: detailed planning and shipped decisions for Commercialization auth, per-user data ownership, and cloud sync.
> The active checklist remains in `todo.md`.

## Scope

This stream turns the current single-user/local-first application into a hosted product with clear ownership boundaries while preserving local mode.
In `todo.md`, this work is split across **P3A** (hosted single-user foundation + onboarding) and **P3D** (team/family collaboration + sync).

## Shipped in P3A

- Hosted auth on the existing Express backend with server-managed sessions
- Minimal `users`, `workspaces`, and `workspace_memberships` schema for one owner per workspace
- Email verification and password recovery via preview tokens suitable for the current runtime
- Workspace-scoped backend persistence for settings, areas, plants, seedlings, and events
- First-run onboarding for workspace creation, location, and AI mode intent
- Config-gated hosted mode with local/self-hosted mode preserved as the default path

## Implementation Notes

### Auth provider decision

Phase 3A deliberately does **not** begin with a runtime migration to Supabase/Auth-as-a-service.
The hosted foundation ships on the current Express + SQLite backend so the product can add account ownership, onboarding, and hosted persistence without breaking the existing API contract or local mode.

### Session model

- Hosted sessions use opaque cookies whose token hashes are stored server-side
- Passwords are hashed server-side
- Public hosted auth routes are limited to sign-up, sign-in, verification, and recovery
- Verification and recovery currently return preview tokens instead of sending real email so the flow is functional before mail infrastructure lands

### Ownership model

- `users` own one hosted workspace in Phase 3A
- `workspace_memberships` exists now so collaboration can extend the same ownership model later
- Backend queries are scoped by `workspaceId` and `userId` from the authenticated session context
- This delivers single-user isolation now; invitation flows, shared roles, and formal data-isolation test matrices remain part of P3D

### Onboarding

On first hosted sign-in, the user completes onboarding to:

- create their workspace
- set location / coordinates / growth zone
- choose AI intent: `none`, `own key`, or `managed`

`preferredAiMode` is stored separately from the existing sanitized `aiProvider` runtime state so Phase 3A can capture subscription intent without prematurely enabling managed AI.

## Deferred to P3D

- Invites and multi-member workspaces
- Role management UI
- Dexie ↔ hosted bi-directional sync for authenticated users
- Conflict policy implementation and collaboration diagnostics
- Provider/runtime portability beyond the current Express-hosted foundation

## Notes

- Keep permission logic centralized. Avoid scattering future role checks through UI components.
- Local mode remains the safety net and default deployment experience. Hosted auth must stay config-driven.
- Offline editing remains important. Hosted sync should reconcile state rather than replacing the local-first model.

## Dependencies

No new hosted auth SDK is required for Phase 3A. If the product later moves to a third-party identity provider or a different hosted runtime, that portability work belongs to a later slice after API parity is preserved.
