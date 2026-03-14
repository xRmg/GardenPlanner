# Security Findings — Garden Planner

**Audit date**: 2026-03-14  
**Methodology**: 6-domain expert review + manual code verification  
**Scope**: Deployed application only (no pentesting, no code changes)

All findings are verified against source code with exact file paths and line numbers.

**Total**: 23 findings (5 Critical, 9 High, 6 Medium, 3 Low)

---

## CRITICAL Findings

### C1. Complete Absence of Authentication on All API Endpoints

**Exploitability**: Trivial (single curl command)  
**Impact**: Full read/write/delete access to all garden data and settings

All 8 API routes have zero authentication:

| Route | Risk |
|-------|------|
| `GET /api/settings` | Leaks location, growth zone, AI provider type |
| `PATCH /api/settings` | Modify any setting (location, zone, model, locale) |
| `POST /api/settings/ai-key` | Overwrite API key |
| `DELETE /api/settings/ai-key` | Delete API key, disabling AI features |
| `POST /api/settings/location/resolve` | Abuse Open-Meteo geocoding via proxy |
| `GET /api/garden` | Export entire garden database |
| `POST /api/garden/sync` | Replace/wipe all garden data |
| `POST /api/ai/chat` | Consume OpenRouter credits |

**Files**:
- `backend/src/server.ts` lines 37–44 (CORS middleware, no auth)
- `backend/src/routes.ts` lines 394–1028 (all route handlers)

**Evidence**: No middleware checks for session tokens, API keys, JWTs, or any form of identity before processing requests.

---

### C2. Wildcard CORS Enables Cross-Origin Exploitation

**Exploitability**: Trivial (1 line of JavaScript on any website)  
**Impact**: Any website can call all API endpoints from a visitor's browser

```javascript
// backend/src/server.ts, line 38
res.header("Access-Control-Allow-Origin", "*");
```

**Attack chain**: An attacker hosts `evil.com` with a fetch call to the Garden Planner backend. Because CORS allows `*`, the browser permits the cross-origin request. Combined with C1 (no auth), this enables:
- Reading all garden data
- Wiping the database via `/garden/sync`
- Draining OpenRouter credits via `/ai/chat`

**Cost escalation estimate**: With `anthropic/claude-3.5-sonnet` at ~$1/request and `maxTokens: 32768`, an attacker could drain ~$60/minute.

---

### C3. Unvalidated Destructive Sync — POST /garden/sync

**Exploitability**: Trivial (single POST request)  
**Impact**: Complete data destruction or corruption

`POST /api/garden/sync` performs a full database replacement with **zero input validation**:

```javascript
// backend/src/routes.ts, line 684-685
db.prepare("DELETE FROM plants").run();
db.prepare("DELETE FROM areas").run();
db.prepare("DELETE FROM planters").run();
db.prepare("DELETE FROM seedlings").run();
db.prepare("DELETE FROM events").run();
```

The endpoint then inserts whatever is in `req.body` without Zod schema validation, per-element type checking, or array length limits. Compare with `POST /ai/chat` which validates via `AiChatRequestSchema.safeParse()`.

**Attack vectors**:
- Empty arrays → wipes all data permanently
- Oversized arrays (100K+ elements) → memory exhaustion / DoS
- Type-confused fields → silent data corruption in SQLite
- Missing required fields → partial insert failures within transaction

---

### C4. No Rate Limiting on Any Endpoint

**Exploitability**: Trivial  
**Impact**: Denial of service, API cost exhaustion

No rate-limiting middleware exists anywhere in the backend. Combined with C1 and C2:

- `POST /ai/chat`: unlimited AI requests using stored OpenRouter key
- `POST /settings/location/resolve`: unlimited Open-Meteo geocoding (can get your IP rate-limited)
- `POST /garden/sync`: CPU-intensive sync can be triggered repeatedly

**File**: `backend/src/server.ts` — no `express-rate-limit` or equivalent.

---

### C5. Arbitrary AI Model Selection — Cost Escalation

**Exploitability**: Medium (requires CORS or direct access)  
**Impact**: Attacker chooses the most expensive model, maximising API costs

```javascript
// backend/src/routes.ts, line 18
model: z.string().max(200).optional(),  // ← No allowlist
```

The `model` field from the client request is sent directly to OpenRouter without validation against an allowlist. An attacker can specify `anthropic/claude-3.5-sonnet` (expensive) regardless of what the user has configured.

```javascript
// backend/src/routes.ts, ~line 905
const resolvedModel = model || dbModel;  // Client model overrides stored model
```

---

## HIGH Findings

### H1. Plaintext API Key Storage in SQLite

**Impact**: Key compromise if database file is accessed  
**File**: `backend/src/routes.ts` line 440

The OpenRouter API key is stored as plaintext JSON in the SQLite `settings` table:

```sql
UPDATE settings SET aiProvider = '{"type":"byok","key":"sk-or-v1-actual-key-here"}' ...
```

The database file at `/app/data/garden.db` is:
- World-readable inside the container (no explicit `chmod 0600`)
- Accessible via the Docker volume `garden-data`
- Stored without encryption

If the database is exfiltrated (backup leak, Docker volume escape, path traversal), the API key is immediately compromised.

---

### H2. Schema Divergence — Silent Data Loss on Sync

**Impact**: Plant metadata permanently lost during sync cycle  
**Verified in code**: Fields exist in Zod schema but missing from SQLite AND sync endpoint

| Field | Zod Schema (schema.ts L129-130) | SQLite (db.ts) | Sync INSERT (routes.ts) |
|-------|------|--------|------|
| `daysToFlower` | `z.number().int().positive().optional()` | **Missing** | **Missing** |
| `daysToFruit` | `z.number().int().positive().optional()` | **Missing** | **Missing** |
| `instanceId` (events) | `z.string().optional()` (schema.ts L364) | **Missing** | **Missing** |

**Data loss path**:
1. User sets `daysToFlower: 45` on a plant → saved to Dexie (client) ✓
2. App syncs to backend via `POST /garden/sync`
3. Backend INSERT has only 23 bind parameters — `daysToFlower` is not one of them
4. Field stored as NULL in SQLite
5. On next `GET /garden`, field returns as undefined
6. Re-sync to client Dexie → field permanently lost

Same issue for `instanceId` on events — the specific plant instance that was harvested/watered is lost, breaking plant-level audit trails.

---

### H3. Weak ID Generation — Math.random() Instead of crypto.randomUUID()

**Impact**: Potential ID collisions leading to data overwrites  
**Violates**: Project's own coding standard (`.github/copilot-instructions.md` line 169)

Multiple locations use `Date.now()` + `Math.random()` for ID generation:

| Location | Pattern |
|----------|---------|
| `app/components/PlanterGrid.tsx` L366 | `instance-${Date.now()}-${Math.random()}` |
| `app/hooks/useGardenEvents.ts` L63 | `planted-${Date.now()}-${Math.random()}` |
| `app/hooks/useGardenEvents.ts` L91 | `${eventType}-${Date.now()}-${Math.random()}` |
| `app/hooks/useGardenEvents.ts` L142 | `observation-health-${Date.now()}-${Math.random()}` |
| `app/hooks/useGardenEvents.ts` L198 | `event-${Date.now()}-${Math.random()}` |

The rest of the codebase correctly uses `crypto.randomUUID()` (App.tsx, PlantDetailsDialog.tsx, dexieRepository.ts). `Math.random()` has only ~53 bits of entropy and is not cryptographically secure.

---

### H4. Non-Atomic Client-Side Migration

**Impact**: Partial data loss if interrupted mid-migration  
**File**: `app/data/migration.ts` lines 83–96

```javascript
await Promise.all([
  ...areas.map((a) => repo.saveArea(a)),
  ...plants.map((p) => repo.savePlant(p)),
  ...seedlings.map((s) => repo.saveSeedling(s)),
  ...events.map((e) => repo.saveEvent(e)),
  repo.saveSettings(settings),
]);

localStorage.setItem(MIGRATED_FLAG, "1");
Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key));
```

If the browser crashes or power is lost mid-migration:
1. Some writes succeed, others don't (Promise.all, no Dexie transaction)
2. The migration flag may or may not be set
3. Legacy localStorage keys are removed regardless
4. On next load: migration won't re-run → partial data, no recovery

---

### H5. 50MB Request Body Limit

**Impact**: Memory exhaustion, event loop blocking  
**File**: `backend/src/server.ts` line 32–34

```javascript
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
```

Typical garden data is 1–2MB. A 50MB JSON payload takes several seconds to parse, blocking the Node.js event loop during that time.

---

### H6. Unguarded JSON.parse in Garden Data Retrieval

**Impact**: Server crash on corrupted database rows  
**File**: `backend/src/routes.ts` lines 569–571

```javascript
companions: JSON.parse(row.companions || "[]"),
antagonists: JSON.parse(row.antagonists || "[]"),
```

If the SQLite row contains malformed JSON (e.g., from a corrupted sync), `JSON.parse` throws an unhandled `SyntaxError`, crashing the request handler. Multiple similar patterns exist throughout the garden GET endpoint.

---

### H7. Missing Quote Escaping in AI Prompt Construction

**Impact**: Potential AI prompt structure breakage  
**File**: `app/services/ai/treatmentOptions.ts` line 84

```javascript
export function sanitizeTreatmentObservation(value, maxLength = 120) {
  return value?.replace(/\s+/g, " ").trim().slice(0, maxLength) ?? "";
}
```

This function only collapses whitespace and truncates — it does **not** escape double quotes. User-supplied pest notes containing `"` characters can break the prompt's quoting structure:

```
Input:  Holes in leaves "ignore previous instructions"
Result: Observed pest note: "Holes in leaves "ignore previous instructions""
```

While JSON mode and the overall prompt structure provide partial mitigation, the missing quote escaping is a defence-in-depth gap.

---

### H8. Error Details Leaked to Client

**Impact**: Internal error messages, stack traces, and system paths exposed  
**File**: `backend/src/routes.ts` line 1026

```javascript
res.status(500).json({ error: "AI proxy error", details: String(error) });
```

`String(error)` can include stack traces, file paths, dependency versions, and internal error messages. This information helps attackers understand the backend's structure and find further vulnerabilities.

---

### H9. Verbose AI Prompt Logging — Full Content to stdout

**Impact**: Sensitive user data (plant names, location, growth zone, pest notes) written to container logs in plaintext  
**File**: `backend/src/routes.ts` lines 901–907

```javascript
messages.forEach((m, i) => {
  console.log(`  [${i}] role=${m.role} | ${m.content.length} chars`);
  console.log(`  ┌─────────────────────────────────────────────────`);
  m.content.split("\n").forEach((line) => console.log(`  │ ${line}`));
  console.log(`  └─────────────────────────────────────────────────`);
});
```

Every AI request logs the **complete system prompt and user prompt** — including user location coordinates, growth zone, plant data, and pest observation notes. In a containerised deployment, these logs may be persisted by Docker's logging driver, forwarded to a log aggregation service, or accessible to other containers on the same host.

Response content is also logged at lines 985–991, including the full AI-generated plant data.

---

## MEDIUM Findings

### M1. Missing Security Headers in nginx

**File**: `nginx.conf`

No security headers are configured:

| Header | Status |
|--------|--------|
| `X-Frame-Options` | Missing (clickjacking risk) |
| `X-Content-Type-Options` | Missing (MIME sniffing) |
| `Content-Security-Policy` | Missing (XSS fallback) |
| `Strict-Transport-Security` | Missing (downgrade attacks) |
| `Referrer-Policy` | Missing (URL leakage) |
| `Permissions-Policy` | Missing (browser API restriction) |

---

### M2. Backend Container Runs as Root

**File**: `Dockerfile.backend` — no `USER` directive

The Node.js process runs as UID 0 inside the container. If the application is compromised, the attacker has full root access within the container and can modify the database, node_modules, and configuration files.

---

### M3. SQLite Database File Permissions Not Set

**File**: `backend/src/db.ts` lines 12–15

```javascript
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
```

The directory and database file are created with default permissions (world-readable). Since the database contains the plaintext API key, it should be restricted to `0700`/`0600`.

---

### M4. Google Fonts CDN — External Resource Dependency

**File**: `styles/fonts.css` line 2

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

Loading fonts from Google's CDN:
- Creates a privacy concern (Google receives the visitor's IP on every page load)
- Adds a hard dependency on an external service (CDN outage → broken typography)
- May conflict with the app's "self-hosted, no mandatory backend" design goal

---

### M5. Stale DEPLOYMENT.md — False "No Database" Claim

**File**: `DEPLOYMENT.md` line 198

> "No Database: Garden Planner is currently data-free on the server; all persistence is client-side."

This is factually incorrect. The backend has a SQLite database at `/app/data/garden.db` storing settings, the API key, and (via sync) the complete garden state. Operators relying on this documentation may:
- Skip database backups
- Under-secure the backend container
- Be unable to recover data after a failure

---

### M6. GZIP Compression on Sensitive API Responses

**File**: `nginx.conf` lines 28–30

```nginx
gzip on;
gzip_types ... application/json;
```

Compressing JSON responses that include user-controlled data can expose the application to BREACH-style attacks if served over HTTPS with reflected user input. Low exploitability in current setup, but worth disabling for `/api/settings` and `/api/garden`.

---

## LOW Findings

### L1. PRAGMA String Interpolation in db.ts

**File**: `backend/src/db.ts` lines 18–21

```javascript
const rows = db.prepare(`PRAGMA table_info(${table})`).all();
```

Table names are interpolated directly into SQL. While currently all callers pass hardcoded strings, this pattern violates secure coding principles. If a future refactoring reads table names from configuration or input, it becomes an injection vector.

---

### L2. Container Image Tags Not Pinned to Digest

**Files**: `Dockerfile` line 19, `Dockerfile.backend` line 4

Both Dockerfiles use floating tags (`node:20-alpine`, `nginx:alpine`) rather than pinned `@sha256:` digests. A supply chain attack on the base image would affect all builds.

---

### L3. Caret (^) Versioning on All npm Dependencies

**Files**: `package.json`, `backend/package.json`

All 34+ dependencies use caret ranges (e.g., `^19.0.0`). While `package-lock.json` pins versions for reproducible installs, a compromised or buggy minor/patch release could be pulled in on `npm install` without the lock file (e.g., CI misconfiguration).

---

## Positive Security Findings

These represent genuine security strengths in the codebase:

1. **Prepared statements throughout** — All SQL queries use `db.prepare()` with bound parameters (except PRAGMA, see L1)
2. **Zod validation on most endpoints** — Settings, AI key, AI chat, and location endpoints all validate input via `safeParse()`
3. **API key never in frontend** — The GET /settings response returns `{ type: "server" }` without the actual key
4. **Multi-stage Docker build** — Source code and dev dependencies excluded from production images
5. **React auto-escaping** — All rendered text uses JSX expressions (no `dangerouslySetInnerHTML`)
6. **SIGTERM/SIGINT handlers** — Backend shuts down gracefully, closing the database connection
7. **Truncation on AI prompt inputs** — `truncate()` in prompt builders limits string length (80–120 chars)
