# Commercialization — Shared Plant Library

> Purpose: detailed planning for the shared plant library, sync model, contribution flow, and moderation.
> The active checklist remains in `todo.md`.

## Scope

The shared plant library is part of Commercialization, not the general backlog. It supports curated plant search, contribution workflows, and eventually a hosted/shared knowledge layer that reduces unnecessary AI lookups for common plants.

## Product Shape

When the user types in the plant name field of `PlantDefinitionDialog`, backend plant library results should appear inline as suggestions, filtered by locale. Selecting a result should prefill the form. If nothing matches, the current manual and AI-assisted paths continue unchanged.

## Commercialization Milestones

- **C.5 — Shared plant library schema + seed data**
  Stand up the library schema and ship initial English + Dutch seed data.

- **C.6 — Plant library API**
  Provide search, detail, and delta-sync endpoints.

- **C.7 — Client-side plant library sync**
  Support background sync with silent fallback to bundled plants.

- **C.8 — Contribution + moderation workflow**
  Allow contributed plants to flow into a review queue with clear publish states.

## Design Decisions

- **Local-first first**: Build against the current Express/SQLite backend first, while keeping the frontend contract portable to D1 later.
- **Locale-aware text storage**: user-visible text fields belong in locale-specific translation rows rather than a single flat table.
- **Cross-locale deduplication**: `latinName` is the soft canonical key for cross-locale plant identity.
- **Flat display model**: varieties remain flat records, displayed as `Plant (Variety)` when relevant.
- **Static admin auth**: admin-only review routes use a server-side `ADMIN_TOKEN`.
- **Profile-based attribution for now**: `submittedBy` can use `profileId` until real hosted auth is in place.
- **Local catalogue search first**: local matches should outrank backend library matches in the plant dialog.

## Open Questions

- How should companions and antagonists be modeled across locales: canonical botanical refs or plant IDs?
- How should bundled plant data seed the hosted/shared library?
- Should search results fall back across locales when the requested locale is missing?
- Do AI-originated plant contributions auto-publish, go pending, or depend on trust heuristics?
- Is field-level merge actually needed for conflicts in v1, or are keep/replace actions enough?

## Risks

- Locale-aware companions and antagonists are the deepest unresolved modeling issue.
- `latinName` quality still depends on AI accuracy when AI is used as an input path.
- SQLite FTS5 has language limitations for pluralization and stemming.
- Admin UI visibility is not the same as server-side protection.
- Contribution endpoints need rate limiting before public exposure.

## Recommended Storage Path

- Start with SQLite + FTS5 on the current backend.
- Migrate to Cloudflare D1 when the Workers backend becomes the active commercialization target.
- Revisit Turso only if offline replica requirements become more important than platform consolidation.

## Non-goals for the First Phase

- No crowd voting or star ratings.
- No per-user private hosted library model yet.
- No bulk import from external plant databases.
- No automatic translation of plant prose into extra locales.
- No image uploads.
- No version history or rollback UI.
