# Commercialization — Shared Plant Library

> Purpose: detailed planning for the shared plant library, sync model, contribution flow, and moderation.
> The active checklist remains in `todo.md`.

## Scope

The shared plant library is part of Commercialization, not the general backlog. It supports curated plant search, contribution workflows, and eventually a hosted/shared knowledge layer that reduces unnecessary AI lookups for common plants.
This document maps to **P3C** in `todo.md`. For that first P3C slice, the shared plant library uses the **interim current backend path**: Express + SQLite/FTS5 first, with the contract kept portable for later migration into the longer-term hosted platform.

## Product Shape

When the user types in the plant name field of `PlantDefinitionDialog`, backend plant library results should appear inline as suggestions, filtered by locale. Selecting a result should prefill the form. If nothing matches, the current manual and AI-assisted paths continue unchanged.

## P3C Milestones

- **P3C.1** — Shared plant library schema + seed data (English + Dutch)
- **P3C.2** — Plant library API (search, detail, delta sync)
- **P3C.3** — Client-side sync with silent fallback to bundled plants
- **P3C.4** — Contribution + moderation workflow

## Design Decisions

- **Interim backend first**: Build against the current Express/SQLite backend first, while keeping the frontend contract portable for later migration.
- **Locale-aware text storage**: user-visible text fields belong in locale-specific translation rows rather than a single flat table.
- **Cross-locale deduplication**: `latinName` is the soft canonical key for cross-locale plant identity.
- **Flat display model**: varieties remain flat records, displayed as `Plant (Variety)` when relevant.
- **Static admin auth**: admin-only review routes use a server-side `ADMIN_TOKEN`.
- **Interim attribution**: `submittedBy` can use `profileId` until hosted auth/user identities from P3A are fully wired into the contribution flow.
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
- Use this as the interim P3C implementation while keeping schemas and endpoints portable.
- Migrate into the long-term hosted backend/runtime only after the hosted platform is stable enough to absorb the shared library without breaking the shipped API contract.
- Revisit Turso only if offline replica requirements become more important than platform consolidation.

## Non-goals for the First Phase

- No crowd voting or star ratings.
- No per-user private hosted library model yet.
- No bulk import from external plant databases.
- No automatic translation of plant prose into extra locales.
- No image uploads.
- No version history or rollback UI.
