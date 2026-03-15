# Garden Planner — Dead Code & Security Audit

> Comprehensive scan of dead, unreachable, and stale code, plus security risk assessment.
> Generated from codebase analysis on 2026-03-15. Codebase is the source of truth.
> Cross-referenced against [Feature Set Documentation](./README.md) for active-feature baseline.

---

## Executive Summary

| Category | Count | Severity Breakdown |
|----------|-------|--------------------
| **Dead Code** | 17 findings | 10 DEAD, 2 STALE, 2 REDUNDANT, 2 UNREACHABLE, 1 FALSE POSITIVE |

| **Security Issues** | 23 findings | 5 CRITICAL, 9 HIGH, 6 MEDIUM, 3 LOW |

**Critical path**: The backend has **zero authentication**, **wildcard CORS**, and **unvalidated destructive sync** — any website can read, write, or wipe all data and drain AI credits.

---

## Part 1: Dead Code Findings

### Summary Table

| # | Finding | File(s) | Severity | Lines | Action |
|---|---------|---------|----------|-------|--------|
| D1 | Static prototype files | `index-static.html`, `style.css`, `script.js` | DEAD | ~1,500 | Delete |
| D2 | Figma `ImageWithFallback` component | `app/components/figma/ImageWithFallback.tsx` | DEAD | ~40 | Delete |
| D3 | Empty `tabs/` directory | `app/components/tabs/` | DEAD | 0 | Delete |
| D4 | `localStorageRepository.ts` (production) | `app/data/localStorageRepository.ts` | DEAD | ~277 | Delete (+ tests) |
| D5 | `getDexieRepository()` singleton factory | `app/data/dexieRepository.ts` | REDUNDANT | ~6 | Delete |
| D6 | `AiKeySubmissionSchema` + `LocationResolutionSchema` | `app/data/schema.ts` | DEAD | ~10 | Delete |
| D7 | `clearAiKey()` method (all repos) | `repository.ts`, `dexieRepository.ts`, `localStorageRepository.ts`, `serverRepository.ts` | UNREACHABLE | ~25 | Delete or add UI |
| D8 | Dexie `version(2)` no-op migration | `app/data/dexieRepository.ts` | STALE | 2 | Keep (harmless) |
| D9 | `harvestAlerts` always-empty array | `app/hooks/useGardenEvents.ts` | REDUNDANT | ~5 | Delete + update consumers |
| D10 | Unused `previousPlantInstance` parameter | `app/hooks/useGardenEvents.ts` | STALE | 1 | Simplify signature |
| D11 | `figma-prompts.md` design artifact | `figma-prompts.md` | STALE | ~100 | Archive or delete |
| D12 | Redundant type definitions in components | `PlanterGrid.tsx`, `EventsBar.tsx`, `PlanterDialog.tsx`, `types.ts` | STALE | ~80 | Refactor to use `schema.ts` |
| D13 | `localStorageRepository.test.ts` (orphaned tests) | `app/data/__tests__/localStorageRepository.test.ts` | DEAD | ~290 | Delete with D4 |
| D14 | ESLint deps installed but no config | `package.json` devDependencies | DEAD | N/A | Create config or remove deps |
| D15 | Unused shadcn/ui sidebar component | `app/components/ui/sidebar.tsx` | DEAD | ~500 | Delete |
| D16 | Unused sidebar CSS variables | `styles/theme.css` | DEAD | ~20 | Delete |
| D17 | Unused animation CSS variables | `styles/theme.css` | DEAD | ~3 | Delete |

**Total dead lines**: ~3,000  
**Runtime impact of removal**: Zero

---

### D1. Static Prototype Files (DEAD)

**Files**: `index-static.html`, `style.css`, `script.js` (project root)

Pre-React prototypes from early design phase. Not referenced by any build tool, Vite config, or import.
- `index-static.html` — static HTML mockup
- `style.css` — ~1,000 lines of pixel-perfect CSS, now replaced by Tailwind
- `script.js` — ~200 lines of jQuery-style DOM manipulation, replaced by React

**Action**: Delete all three. Safe: zero references anywhere.

---

### D2. Figma `ImageWithFallback` Component (DEAD)

**File**: `app/components/figma/ImageWithFallback.tsx`

React component providing `<img>` error fallback. Exported but never imported in any active code. Lives in `figma/` prototype directory.

**Action**: Delete. Not used by any active feature.

---

### D3. Empty `tabs/` Directory (DEAD)

**File**: `app/components/tabs/`

Empty directory — likely a placeholder for a feature that was never implemented or was implemented differently.

**Action**: Delete empty directory.

---

### D4. `localStorageRepository.ts` — Dead Production Code (DEAD)

**File**: `app/data/localStorageRepository.ts` (~277 lines)

Legacy `GardenRepository` implementation from before Dexie was adopted. The entire file is a bridge implementation that is:
- Never imported in any production code (App.tsx, hooks, components)
- Only imported in its own test file (`localStorageRepository.test.ts`)
- Fully replaced by `DexieRepository` (local) and `ServerRepository` (sync)

**Action**: Delete file. Delete companion test file (`D13`). The `migration.ts` reads from localStorage directly (raw keys), not through this repository class.

---

### D5. `getDexieRepository()` Singleton Factory (REDUNDANT)

**File**: `app/data/dexieRepository.ts` (lines ~495–500)

```typescript
export function getDexieRepository(): DexieRepository {
  if (!_instance) _instance = new DexieRepository();
  return _instance;
}
```

Never imported or called anywhere. Production uses `ServerRepository` (which creates `DexieRepository` internally). AI services use `getGardenPlannerDB()` for direct Dexie access.

**Action**: Delete function and `_instance` variable.

---

### D6. Unused Schemas: `AiKeySubmissionSchema` & `LocationResolutionSchema` (DEAD)

**File**: `app/data/schema.ts` (lines ~376–381, type exports ~525–526)

Two Zod schemas and their inferred types that were planned for frontend request validation but never integrated. The hooks that handle these operations (`useOpenRouterSettings`, `useLocationSettings`) call repository methods directly without frontend schema validation.

**Action**: Delete schemas and type exports from `schema.ts`.

---

### D7. `clearAiKey()` — Unreachable Repository Method (UNREACHABLE)

**Files**: Interface in `repository.ts`, implementations in `dexieRepository.ts`, `localStorageRepository.ts`, `serverRepository.ts`

Method is defined in the `GardenRepository` interface and implemented in all three repository classes, but **never called from any UI code or hook**. There is no "Clear AI Key" button in the application.

Users can store an OpenRouter API key via `storeAiKey()` (used by `useOpenRouterSettings`), but cannot remove it.

**Action**: Either implement a "Clear API Key" button in settings UI, or delete method from interface and all implementations.

---

### D8. Dexie `version(2)` No-Op Migration (STALE)

**File**: `app/data/dexieRepository.ts` (lines ~130–131)

```typescript
// v2: placeholder (upgrade ran before migration was written — no-op)
this.version(2).stores({});
```

Historical artifact. Empty migration that does nothing. Versions 1 and 3–12 have real migrations. Cannot be removed without risking Dexie upgrade path issues for existing users.

**Action**: Keep. Harmless, and removing Dexie version entries can break the upgrade chain.

---

### D9. `harvestAlerts` Always-Empty Array (REDUNDANT)

**File**: `app/hooks/useGardenEvents.ts` (lines ~129–131)

```typescript
const harvestAlerts: GardenEventsState["harvestAlerts"] = [];
```

Always initialized to empty array and never modified. Returned as part of `GardenEventsState` but `EventsBar` receives the prop without using it. Harvest timing is now derived in the suggestion engine.

**Action**: Remove from `GardenEventsState` interface, hook return, and `EventsBar` props.

---

### D10. ~~Unused `previousPlantInstance` Parameter~~ (FALSE POSITIVE)

**File**: `app/hooks/useGardenEvents.ts` (line ~188)

**Status**: NOT DEAD. Despite the misleading ESLint `@typescript-eslint/no-unused-vars` suppression comment, the `previousPlantInstance` parameter IS actively used in the function body to compare pest events and health state. The ESLint suppression is itself incorrect/stale.

---

### D11. `figma-prompts.md` Design Artifact (STALE)

**File**: `figma-prompts.md` (project root, ~100 lines)

Early design prompts and copy from initial design exploration. Design system has since matured — current source of truth is `CLAUDE.md`. Not referenced by any code or build process.

**Action**: Move to `docs/archived/` or delete.

---

### D12. Redundant Type Definitions in Components (STALE)

**Files**: `app/components/PlanterGrid.tsx`, `app/components/EventsBar.tsx`, `app/components/PlanterDialog.tsx`, `app/types.ts`

Components define local interfaces that duplicate or diverge from the canonical Zod-derived types in `schema.ts`:

| File | Exported Types |
|------|----------------|
| `PlanterGrid.tsx` (lines 68, 105, 122) | `Plant`, `PlantInstance`, `PlanterSquare` |
| `EventsBar.tsx` (lines 24, 59) | `GardenEvent`, `Suggestion` |
| `PlanterDialog.tsx` (lines 15, 24) | `VirtualSection`, `PlanterConfig` |

`app/types.ts` imports `Plant`, `PlantInstance`, `PlanterSquare` from `PlanterGrid.tsx` and `VirtualSection` from `PlanterDialog.tsx`, then re-exports them. Hooks import from `types.ts` rather than from `schema.ts`.

This violates the project's stated principle:

> "All types live in `app/data/schema.ts` as Zod schemas with inferred TypeScript types. Do not create separate interface files."

The comment in `types.ts` acknowledges the divergence: "These are distinct from the Zod-derived schema types... Cast with `as unknown as Schema*` when passing to the repository layer."

**Action**: Migrate to `schema.ts` types exclusively. Update all imports. Simplify `types.ts`.

---

### D13. `localStorageRepository.test.ts` — Orphaned Tests (DEAD)

**File**: `app/data/__tests__/localStorageRepository.test.ts` (~290 lines)

Tests for the dead `localStorageRepository.ts` (D4). Tests do pass, but they exercise production-dead code.

**Action**: Delete alongside D4.

---

### D14. ESLint Dependencies Without Configuration (DEAD)

**File**: `package.json` devDependencies

ESLint and its plugins (`@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) are installed but no ESLint configuration file exists (`eslint.config.js`, `.eslintrc.*`). No `lint` npm script is defined.

**Action**: Either create `eslint.config.js` with project linting rules, or remove the unused dependencies.

---

### D15. Unused shadcn/ui Sidebar Component (DEAD)

**File**: `app/components/ui/sidebar.tsx` (~500 lines)

Complete shadcn/ui sidebar component that is never imported by any file in the codebase. Includes `SidebarProvider`, `SidebarMenu`, `SidebarGroup`, `SidebarFooter`, and ~20 sub-components. The app's actual sidebar is `EventsBar.tsx`, which is a custom implementation.

**Action**: Delete. The sidebar component is a shadcn/ui primitive that was installed but never integrated.

---

### D16. Unused Sidebar CSS Variables (DEAD)

**File**: `styles/theme.css` (lines ~56–63 light mode, ~108–115 dark mode, ~149–158 Tailwind mappings)

16 sidebar CSS custom properties (`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, etc.) defined in both light and dark mode, plus their Tailwind `--color-sidebar-*` mappings. Only referenced by the dead `sidebar.tsx` component (D15).

**Action**: Delete alongside D15.

---

### D17. Unused Animation CSS Variables (DEAD)

**File**: `styles/theme.css` (lines ~68, ~72–73)

Three custom property definitions that are never referenced in any component or style:
- `--ease-in-quart` (line 68)
- `--duration-relaxed` (line 72)
- `--duration-entrance` (line 73)

**Action**: Delete. Leftover design tokens from an earlier iteration.

---

## Part 2: Security Findings

### Severity Legend

| Level | Meaning |
|-------|---------|
| 🔴 CRITICAL | Immediate exploitation risk. Fix before any deployment. |
| 🟠 HIGH | Significant security gap. Fix before production deployment. |
| 🟡 MEDIUM | Should address. Reduced defense-in-depth. |
| 🔵 LOW | Minor concern. Nice to have. |

---

### Critical Findings

#### S1. 🔴 No Authentication on Any API Endpoint

**Files**: `backend/src/server.ts`, `backend/src/routes.ts`

All 8 API routes have **zero authentication**. Any network-adjacent client can:
- Read all garden data (`GET /api/garden`)
- Wipe the database (`POST /api/garden/sync` with empty arrays)
- Store/delete the user's API key (`POST/DELETE /api/settings/ai-key`)
- Make unlimited AI requests using the user's OpenRouter credits (`POST /api/ai/chat`)

**Recommendation**: Add bearer token authentication. For self-hosted single-user: generate random token on first startup, store in SQLite, require `Authorization: Bearer <token>` on all routes.

---

#### S2. 🔴 Wildcard CORS Enables Cross-Origin Attacks

**File**: `backend/src/server.ts` (line ~38)

```javascript
res.header("Access-Control-Allow-Origin", "*");
```

Combined with S1 (no auth), any website a user visits can call the backend API from the user's browser. An attacker could drain OpenRouter credits (~$60/min with expensive models) or wipe garden data.

**Recommendation**: Replace with explicit origin allowlist from environment variable:
```javascript
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
```

---

#### S3. 🔴 Unvalidated Destructive Sync Endpoint

**File**: `backend/src/routes.ts` (lines ~684–695)

`POST /api/garden/sync` deletes all data (`DELETE FROM plants`, `DELETE FROM areas`, etc.) then inserts request body **without any Zod validation**. Contrast with `POST /api/ai/chat` which correctly uses `AiChatRequestSchema.safeParse()`.

Attack: `POST /api/garden/sync` with `{ areas: [], plants: [] }` → permanent data destruction.

**Recommendation**: Add Zod schema validation with array size limits. Wrap in database transaction. Require confirmation header for destructive operations.

---

#### S4. 🔴 No Server-Side Rate Limiting

**File**: `backend/src/server.ts`

No `express-rate-limit` or equivalent. The frontend has client-side rate limiting (10 req/min for AI), but this is trivially bypassed with curl/Postman.

**Recommendation**: Install `express-rate-limit`. Apply general limit (100 req/15min) on `/api/`, strict limit (10 req/min) on `/api/ai/chat`.

---

#### S5. 🔴 Arbitrary AI Model Selection — Cost Escalation

**File**: `backend/src/routes.ts` (lines ~17–18, ~905)

The client can override the stored AI model with any string. Attacker can force expensive models (e.g., `anthropic/claude-3.5-sonnet` at ~$3/req) to drain credits.

```javascript
const resolvedModel = model || dbModel;  // Client model OVERRIDES stored model
```

**Recommendation**: Create server-side model allowlist. Always use stored model (`dbModel`), never allow client override.

---

### High Findings

#### S6. 🟠 Plaintext API Key Storage in SQLite

**File**: `backend/src/routes.ts` (line ~440)

OpenRouter API keys stored as plaintext JSON in SQLite. If the database file is exfiltrated (container escape, backup leak, volume mount access), keys are immediately compromised.

**Recommendation**: Encrypt API keys at rest using `crypto.createCipheriv('aes-256-gcm', ...)` with encryption key from environment variable.

---

#### S7. 🟠 Schema Divergence — Silent Data Loss on Sync

**Files**: `app/data/schema.ts` vs `backend/src/db.ts` vs `backend/src/routes.ts`

Fields defined in Zod but missing from SQLite schema and sync INSERT:

| Field | In Zod | In SQLite | In Sync INSERT | Effect |
|-------|--------|-----------|----------------|--------|
| `daysToFlower` | ✓ | ✗ | ✗ | Lost on sync |
| `daysToFruit` | ✓ | ✗ | ✗ | Lost on sync |
| `instanceId` (events) | ✓ | ✗ | ✗ | Lost on sync |

Data survives in local Dexie but is silently dropped when synced to backend.

**Recommendation**: Add missing columns to SQLite schema. Update sync INSERT statements.

---

#### S8. 🟠 Weak ID Generation — `Math.random()` Instead of `crypto.randomUUID()`

**Files**: `app/components/PlanterGrid.tsx`, `app/hooks/useGardenEvents.ts` (5 locations)

Uses `Date.now()-${Math.random()}` for event/instance IDs, while the rest of the codebase correctly uses `crypto.randomUUID()`. `Math.random()` has only ~53 bits of entropy and is not cryptographically secure. Two events in the same millisecond could collide.

**Recommendation**: Replace all `Math.random()` ID generation with `crypto.randomUUID()`.

---

#### S9. 🟠 50MB Request Body Limit

**File**: `backend/src/server.ts` (lines ~32–34)

```javascript
app.use(express.json({ limit: "50mb" }));
```

Typical garden data is 1–2 MB. 50 MB parsing blocks the Node event loop. Without auth (S1), anyone can trigger resource exhaustion.

**Recommendation**: Reduce to `10mb`.

---

#### S10. 🟠 Unguarded `JSON.parse` in Garden Data Retrieval

**File**: `backend/src/routes.ts` (lines ~569–571)

```javascript
companions: JSON.parse(row.companions || "[]"),
```

If SQLite contains malformed JSON, `JSON.parse` throws unhandled `SyntaxError`, crashing the request.

**Recommendation**: Implement `safeJsonParse()` helper with default fallback.

---

#### S11. 🟠 Missing Quote Escaping in AI Prompt Construction

**File**: `app/services/ai/treatmentOptions.ts` (line ~84)

`sanitizeTreatmentObservation()` only collapses whitespace — does not escape quotes. User input with `"` can break prompt structure, enabling prompt injection.

**Recommendation**: Add `replace(/"/g, '\\"')` to sanitizer. Apply to all user inputs in AI prompts.

---

#### S12. 🟠 Error Details Leaked to Client

**File**: `backend/src/routes.ts` (line ~1026)

```javascript
res.status(500).json({ error: "AI proxy error", details: String(error) });
```

Stack traces, file paths, and dependency versions exposed to the client.

**Recommendation**: Log full error server-side, return generic message to client.

---

#### S13. 🟠 Verbose AI Prompt Logging to stdout

**File**: `backend/src/routes.ts` (lines ~901–907)

Full AI prompt content (including user location, plant names, pest observations) logged to stdout in plaintext. In containerized deployments, these logs may be persisted or forwarded to aggregation services.

**Recommendation**: Log summaries only (model, message count, token estimate). Gate full content behind `DEBUG_AI_PROMPTS=true`.

---

#### S14. 🟠 Non-Atomic Client-Side Migration

**File**: `app/data/migration.ts` (lines ~83–96)

Uses `Promise.all` (not a Dexie transaction) for data migration. If browser crashes mid-migration, the migration flag may not get set, resulting in partial data loss on next load.

**Recommendation**: Wrap in Dexie transaction for all-or-nothing semantics.

---

### Medium Findings

#### S15. 🟡 Missing Security Headers in nginx

**File**: `nginx.conf`

Missing: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Strict-Transport-Security`.

---

#### S16. 🟡 Missing CSRF Protection

No CSRF tokens on any endpoint. Less critical without authentication (S1), but must be implemented when auth is added.

---

#### S17. 🟡 No Timeout on External API Calls (Backend)

**File**: `backend/src/routes.ts` (geocoding `fetch`)

Backend `fetch` to Open-Meteo geocoding API has no timeout. If the external service hangs, the backend blocks indefinitely.

---

#### S18. 🟡 Sensitive Data in Console Logs

**File**: `backend/src/routes.ts` (line ~788)

User location search queries logged to stdout.

---

#### S19. 🟡 Docker Network `external: true` Without Documentation

**File**: `docker-compose.yml`

`pangolin` network marked as `external: true` but `DEPLOYMENT.md` never documents `docker network create pangolin`. Deployment may fail.

---

#### S20. 🟡 Incomplete Model Validation on Settings Patch

**File**: `backend/src/routes.ts` (line ~69)

`aiModel` field accepts any string up to 200 chars — no format or allowlist validation.

---

### Low Findings

#### S21. 🔵 Missing Content-Security-Policy Header

#### S22. 🔵 Development `console.log` Calls in Production Backend

#### S23. 🔵 No Helmet.js for Automatic Security Headers

---

## Part 3: BYOK-Specific Analysis

The old BYOK (Bring Your Own Key) pattern was a concern in the original task. Here is the current state:

### Current Architecture (Active)

The BYOK flow is **server-side proxied** — the correct approach:

1. User enters OpenRouter API key in settings UI
2. Frontend sends key to `POST /api/settings/ai-key` 
3. Backend stores key in SQLite (⚠️ plaintext — see S6)
4. All AI requests go through `POST /api/ai/chat` backend proxy
5. Backend reads key from SQLite, adds to OpenRouter request headers
6. Key **never appears in browser network requests to external APIs**

### BYOK Security Gaps Found

| Issue | Finding ID | Status |
|-------|-----------|--------|
| Key stored as plaintext in SQLite | S6 | 🟠 Needs encryption |
| No auth on key storage endpoint | S1 | 🔴 Anyone can overwrite the key |
| No auth on AI proxy endpoint | S1 | 🔴 Anyone can consume credits |
| Client can override model selection | S5 | 🔴 Cost escalation attack |
| Full prompt logged to stdout | S13 | 🟠 Sensitive data exposure |
| No `clearAiKey()` UI | D7 | Users can't remove their key |

### No Old Client-Side BYOK Code Found

**Good news**: No remnants of direct client-to-OpenRouter API calls were found. There is no old BYOK pattern where the browser directly contacted external AI APIs. All AI communication is correctly routed through the backend proxy at `/api/ai/chat`.

---

## Part 4: Recommended Cleanup Order

### Immediate (Before Deployment)

| Priority | Item | Type | Effort |
|----------|------|------|--------|
| 🔴 1 | Add authentication to all API routes | Security | Medium |
| 🔴 2 | Replace wildcard CORS with allowlist | Security | Low |
| 🔴 3 | Validate `POST /garden/sync` input | Security | Medium |
| 🔴 4 | Add server-side rate limiting | Security | Low |
| 🔴 5 | Create AI model allowlist | Security | Low |

### Short-term

| Priority | Item | Type | Effort |
|----------|------|------|--------|
| 🟠 6 | Encrypt API keys in SQLite | Security | Medium |
| 🟠 7 | Fix schema divergence (missing columns) | Security | Medium |
| 🟠 8 | Replace `Math.random()` ID generation | Security | Low |
| 🟠 9 | Reduce request body limit to 10MB | Security | Trivial |
| 🟠 10 | Add `safeJsonParse()` to backend | Security | Low |
| 🟠 11 | Escape quotes in AI prompt inputs | Security | Low |
| 🟠 12 | Remove error details from client responses | Security | Low |
| 🟠 13 | Redact prompt content from logs | Security | Low |
| 🗑️ 14 | Delete prototype files (D1) | Dead code | Trivial |
| 🗑️ 15 | Delete `localStorageRepository.ts` + tests (D4, D13) | Dead code | Trivial |
| 🗑️ 16 | Delete unused schemas (D6) | Dead code | Trivial |
| 🗑️ 17 | Delete dead `sidebar.tsx` + CSS vars (D15, D16, D17) | Dead code | Trivial |

### Medium-term

| Priority | Item | Type | Effort |
|----------|------|------|--------|
| 🟡 17 | Add security headers to nginx | Security | Low |
| 🟡 18 | Add timeouts to backend external API calls | Security | Low |
| 🗑️ 19 | Refactor component types to use `schema.ts` (D12) | Dead code | Medium |
| 🗑️ 20 | Remove or implement `clearAiKey()` (D7) | Dead code | Low |
| 🗑️ 21 | Remove `harvestAlerts` dead code (D9) | Dead code | Low |
| 🗑️ 22 | Configure or remove ESLint deps (D14) | Dead code | Low |
| 🗑️ 23 | Archive `figma-prompts.md` (D11) | Dead code | Trivial |

---

## Files Safe to Delete

If cleaning house completely:

```
# Root prototype files
index-static.html
style.css
script.js
figma-prompts.md

# Dead production code
app/data/localStorageRepository.ts
app/data/__tests__/localStorageRepository.test.ts
app/components/figma/ImageWithFallback.tsx
app/components/ui/sidebar.tsx
app/components/tabs/                        (empty directory)
```

Additionally, remove from `styles/theme.css`:
- All `--sidebar*` CSS variables (both light and dark mode blocks)
- All `--color-sidebar-*` Tailwind mappings
- `--ease-in-quart`, `--duration-relaxed`, `--duration-entrance` variables

**Total lines eliminated**: ~3,000  
**Runtime impact**: Zero

---

## Appendix: Cleanup Execution Log

> Executed on 2026-03-15. All changes verified with TypeScript type check, Vitest (136/136 tests pass), and full production build.

### Items Cleaned

| ID | Action | Result |
|----|--------|--------|
| D1 | Deleted `index-static.html`, `style.css`, `script.js` | ✅ Done |
| D2 | Deleted `app/components/figma/ImageWithFallback.tsx` + empty `figma/` dir | ✅ Done |
| D3 | Deleted empty `app/components/tabs/` directory | ✅ Done |
| D4 | Deleted `app/data/localStorageRepository.ts` | ✅ Done |
| D5 | Removed `getDexieRepository()` + `_instance` from `dexieRepository.ts` | ✅ Done |
| D6 | Removed `AiKeySubmissionSchema`, `LocationResolutionSchema` + types from `schema.ts` | ✅ Done |
| D7 | Removed `clearAiKey()` from `repository.ts`, `dexieRepository.ts`, `serverRepository.ts` | ✅ Done |
| D9 | Removed `harvestAlerts` from `useGardenEvents.ts`, `App.tsx`, `EventsBar.tsx` + orphaned i18n keys (`eventsBar.harvestSoon`, `.now`, `.daysUntil`) in en/nl | ✅ Done |
| D11 | Moved `figma-prompts.md` to `docs/archived/` | ✅ Done |
| D13 | Deleted `app/data/__tests__/localStorageRepository.test.ts` | ✅ Done |
| D14 | Removed `@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` from `package.json` devDependencies | ✅ Done |
| D15 | Deleted `app/components/ui/sidebar.tsx` | ✅ Done |
| D16 | Removed 24 `--sidebar*` / `--color-sidebar-*` CSS variables from `styles/theme.css` | ✅ Done |
| D17 | Removed `--ease-in-quart`, `--duration-relaxed`, `--duration-entrance` from `styles/theme.css` | ✅ Done |

### Items NOT Cleaned (by design)

| ID | Reason |
|----|--------|
| D8 | Dexie `version(2)` no-op — cannot remove without breaking upgrade chain |
| D10 | **False positive** — `previousPlantInstance` IS actively used; ESLint suppression comment is misleading |
| D12 | Type duplication is a refactoring task, not dead code — deferred to separate effort |
