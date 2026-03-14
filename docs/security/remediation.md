# Remediation Roadmap — Garden Planner

**Based on**: Security audit dated 2026-03-14  
**Principle**: Fix the highest-impact, easiest-to-exploit issues first.

---

## Phase 1 — Immediate (block deployment)

These findings are actively exploitable and can cause data loss or financial damage.

### 1.1 Add authentication to all API endpoints (C1)

Add a shared-secret or session-based auth middleware. For a single-user self-hosted app, a simple approach:

- Generate a random token on first startup, stored in SQLite
- Require `Authorization: Bearer <token>` on all routes
- Return 401 for missing/invalid tokens
- Display the token in the backend logs on first run (or set via environment variable)

### 1.2 Replace wildcard CORS with explicit origin (C2)

```javascript
// Instead of:
res.header("Access-Control-Allow-Origin", "*");

// Use:
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
```

### 1.3 Add Zod validation to POST /garden/sync (C3)

Validate the full sync payload against existing Zod schemas from `schema.ts`. Reject payloads that fail validation with 400. Add array length limits (e.g., max 10,000 plants).

### 1.4 Add rate limiting (C4)

```bash
npm install express-rate-limit
```

Apply tiered limits:
- `/api/ai/chat`: 10 requests/minute
- `/api/garden/sync`: 5 requests/minute
- All other routes: 60 requests/minute

### 1.5 Add AI model allowlist (C5)

```javascript
const ALLOWED_MODELS = new Set([
  "google/gemma-3-4b-it:free",
  "stepfun/step-3.5-flash:free",
  // ... user's configured models
]);

if (model && !ALLOWED_MODELS.has(model)) {
  return res.status(400).json({ error: "Model not allowed" });
}
```

---

## Phase 2 — Urgent (within 1 week)

### 2.1 Encrypt API key at rest (H1)

Use Node.js `crypto` to encrypt the key before storing in SQLite:
- Derive an encryption key from an environment variable or auto-generated secret
- Use AES-256-GCM with a random IV per encryption
- Store the encrypted blob + IV in the database

### 2.2 Fix schema divergence (H2)

Add the missing columns to SQLite and the sync INSERT:
- `daysToFlower` (plants table)
- `daysToFruit` (plants table)
- `instanceId` (events table)

Use the existing `ensureColumn()` pattern in `db.ts`.

### 2.3 Replace Math.random() with crypto.randomUUID() (H3)

Replace all 5 instances of `Date.now()-Math.random()` ID generation:
- `app/components/PlanterGrid.tsx` line 366
- `app/hooks/useGardenEvents.ts` lines 63, 91, 142, 198

### 2.4 Make migration atomic (H4)

Wrap the Dexie writes in a transaction. Only set the migration flag and delete localStorage keys after the transaction succeeds. Add an in-progress flag to detect and recover from interrupted migrations.

### 2.5 Reduce body size limit (H5)

```javascript
app.use(express.json({ limit: "5mb" }));
```

### 2.6 Add try-catch around JSON.parse calls (H6)

Wrap all `JSON.parse()` calls in the garden GET handler in try-catch blocks, returning a safe default on parse failure instead of crashing.

### 2.7 Escape quotes in AI prompt inputs (H7)

Update `sanitizeTreatmentObservation()` to escape double quotes:
```javascript
return value?.replace(/\s+/g, " ").replace(/"/g, '\\"').trim().slice(0, maxLength) ?? "";
```

### 2.8 Remove error details from client responses (H8)

```javascript
// Instead of:
res.status(500).json({ error: "AI proxy error", details: String(error) });

// Use:
console.error("[AI Proxy] Unexpected error:", error);
res.status(500).json({ error: "AI proxy error" });
```

### 2.9 Reduce AI prompt logging verbosity (H9)

Replace full-content prompt logging with a summary (role + character count only). Never log the full `m.content` in production. Guard verbose logging behind `NODE_ENV === "development"`:

```javascript
messages.forEach((m, i) => {
  console.log(`  [${i}] role=${m.role} | ${m.content.length} chars`);
  // Don't log m.content in production
});
```

---

## Phase 3 — Important (within 2–4 weeks)

### 3.1 Add nginx security headers (M1)

Add to the `server` block in `nginx.conf`:
```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Content-Security-Policy "default-src 'self'; font-src 'self'; style-src 'self' 'unsafe-inline'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=()" always;
```

### 3.2 Run backend container as non-root (M2)

Add to `Dockerfile.backend`:
```dockerfile
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app/data
USER nodejs
```

### 3.3 Set database file permissions (M3)

```javascript
fs.mkdirSync(dbDir, { recursive: true, mode: 0o700 });
// After database creation:
fs.chmodSync(dbPath, 0o600);
```

### 3.4 Self-host Google Fonts (M4)

Download Inter font files and serve them from the app's own assets instead of loading from `fonts.googleapis.com`. This improves privacy, eliminates an external dependency, and aligns with the self-hosted design goal.

### 3.5 Update DEPLOYMENT.md (M5)

Replace the "No Database" section with accurate documentation about the SQLite database, its contents, backup strategy, and the Docker volume configuration.

### 3.6 Disable gzip on sensitive API endpoints (M6)

```nginx
location ~ ^/api/(settings|garden) {
    proxy_pass http://backend:3000;
    gzip off;
}
```

---

## Phase 4 — Opportunistic

### 4.1 Add table name whitelist for PRAGMA (L1)

```javascript
const VALID_TABLES = new Set(["plants", "areas", "planters", "seedlings", "events", "settings"]);
if (!VALID_TABLES.has(table)) throw new Error(`Invalid table: ${table}`);
```

### 4.2 Pin container image digests (L2)

Replace floating tags with `@sha256:` digests and update periodically.

### 4.3 Review npm dependency pinning strategy (L3)

Ensure `package-lock.json` is always committed and used in CI. Consider exact versions for production dependencies.

---

## Verification Checklist

After implementing fixes, verify:

- [ ] All API routes return 401 without valid auth token
- [ ] CORS rejects requests from unauthorized origins
- [ ] `POST /garden/sync` rejects invalid payloads with 400
- [ ] Rate limiter blocks excessive requests
- [ ] AI chat rejects non-allowlisted models
- [ ] Database file is not world-readable
- [ ] `npm audit` reports 0 production vulnerabilities
- [ ] Security headers present in nginx responses (check via `curl -I`)
- [ ] Error responses contain no stack traces or internal details
- [ ] `daysToFlower`, `daysToFruit`, `instanceId` survive a sync round-trip
