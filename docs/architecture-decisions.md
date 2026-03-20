# Garden Planner — Architecture Decisions

> **Purpose**: Record of key technical decisions with rationale. Captured so they don't need to be re-litigated.
> Active implementation tasks live in `todo.md`. Product vision and deployment tiers are in `docs/product-vision.md`.

---

## Persistence: Dexie.js (not SQLite WASM)

**Decision**: IndexedDB via Dexie.js v4 for local persistence. Hosted sync lands later as part of the Phase 3 slices in `todo.md`.

**Why not SQLite WASM**:

| Factor               | SQLite WASM                          | Dexie (IndexedDB)         |
| -------------------- | ------------------------------------ | ------------------------- |
| Bundle size          | ~800 KB                              | ~15 KB ✅                 |
| Headers required     | `COOP`/`COEP` (SharedArrayBuffer)    | None ✅                   |
| SQL reusability      | None — Postgres schema is written fresh anyway | N/A              |
| Tier 4 migration     | Still need to add Postgres alongside | Dexie becomes local cache |
| CRDT peer-to-peer    | ✅ (`cr-sqlite`)                     | Not needed in this roadmap|

**Conclusion**: Dexie is the right call. The `GardenRepository` interface abstracts data access completely — no SQL carries over. Dexie stays in Tier 4 as the local cache syncing to Postgres.

**Dexie version history**:
- v1: Initial tables (`areas`, `plants`, `seedlings`)
- v2: Virtual sections support
- v3: `aiPlantCache` table
- v4: `events` table (bug fix — events were not persisted)
- v7 (planned for 1.9): `weatherCache` + `aiSuggestionsCache` tables

---

## Climate Classification: Köppen–Geiger (not USDA Hardiness)

**Decision**: Use Köppen–Geiger zones (e.g. `Cfb`, `Csa`) stored as `koeppenZone` in Settings.

| Factor                | USDA Hardiness                  | Köppen–Geiger               |
| --------------------- | ------------------------------- | --------------------------- |
| What it measures      | Min winter temperature only     | Temp + precipitation + seasonality |
| Sowing windows        | Static                          | Accounts for monsoon, dry season |
| Auto-derivation       | Requires user lookup            | Derived from lat/lng ✅     |
| AI knowledge          | Trained on both                 | Increasingly used in literature |

**Derivation**: On location save, the backend resolves the place name to lat/lng and derives the zone server-side before returning sanitized settings to the frontend.

**Plant cache key**: `${name}|${latinName}|${koeppenZone}` — same plant can have different sow/harvest windows per climate.

---

## AI Provider: BYOK Key, Server-Side Proxy

**Decision**: User supplies their own OpenRouter key (BYOK) via the Settings UI, but validation, persistence, and all AI calls are routed through the backend. The browser never calls OpenRouter directly.

| Phase | Approach                                         | Notes                                  |
| ----- | ------------------------------------------------ | -------------------------------------- |
| 1     | User enters key in Settings → backend validates/stores it → AI uses `/api/ai/chat` proxy | Key stored server-side |
| P3A/P3B | Hosted rollout keeps the same proxy pattern while adding hosted auth, managed AI modes, and admin controls | API contract should stay stable |
| Later portability | Worker or equivalent runtime target | Only after hosted feature/API parity is preserved |

**How it works**:
1. User enters an OpenRouter key in Settings.
2. Frontend POSTs the key to `POST /api/settings/ai-key`.
3. The backend validates the key against OpenRouter, stores it in SQLite, and returns sanitized settings with `aiProvider: { type: "server" }`.
4. Frontend reads sanitized settings from `GET /api/settings`; the raw key is never returned to the browser.
5. For every AI call (plant lookup or suggestion engine), the frontend POSTs to `${VITE_API_BASE}/api/ai/chat` — **no key in the request body**.
6. The backend reads the key from its own SQLite settings row and forwards to OpenRouter server-side.

**Security rules**:
- Never use `import.meta.env.VITE_OPENROUTER_KEY` — anything starting with `VITE_` is compiled into the bundle
- Never include the API key in error reports, JSON exports, or browser-visible logs
- The frontend always routes AI requests through the backend proxy and never falls back to direct browser calls
- Validate and store keys via `POST /api/settings/ai-key`; show green ✓ or red ✗ based on the backend response

**Current server-managed settings endpoints**:
1. `GET /api/settings` — returns sanitized settings only
2. `PATCH /api/settings` — persists editable non-secret settings such as locale, growth zone, and model
3. `POST /api/settings/ai-key` — validates and stores a new OpenRouter key server-side
4. `DELETE /api/settings/ai-key` — clears the stored key
5. `POST /api/settings/location/resolve` — resolves a location query to canonical location, coordinates, and growth zone server-side

**Phase 3 note**:
- P3A adds hosted auth and workspace scoping around these capabilities.
- P3B adds the managed AI mode and backend/admin controls without changing the core browser-to-proxy contract.


**Docker self-hosted key injection** (for deployers):
```bash
# Alternatively, pre-seed the key via the backend's own init mechanism
# or have the user enter it in the Settings UI after first run
```

**Model selection**:
- Primary: `google/gemini-2.0-flash` ($0.10/M in, $0.40/M out)
- Fallback chain: Mistral Small → Llama 3.3 70B
- Non-streaming JSON response (must parse complete schema before rendering)

---

## State Management: Context + Custom Hooks (not Zustand)

**Decision**: No global state library. React `useState` + 8 custom hooks wrapping `GardenRepository`.

**Reasoning**:
- Prop drilling is only one level deep (`App` → direct children)
- `GardenRepository` already encapsulates the data layer — Zustand would be a redundant abstraction
- Zustand pays off when many deeply nested components subscribe to the same store; this app has 4–5 cross-cutting state pieces

**Implemented hooks**:

| Hook | Responsibility |
|------|---------------|
| `useGardenData` | Repository init, loading state |
| `useAreaManager` | Areas CRUD |
| `usePlantCatalog` | Plant library (defaults + custom) |
| `useSeedlingManager` | Seedling CRUD + status transitions |
| `useGardenEvents` | Event log (persisted to Dexie) |
| `useOpenRouterSettings` | AI key management + validation |
| `useLocationSettings` | lat/lng + Köppen zone |
| `usePlantAILookup` | AI-powered plant data fetch + 30-day cache |

---

## Weather Provider: Open-Meteo (not OpenWeatherMap)

**Decision**: Use Open-Meteo as the primary weather API.

| API                  | Cost               | Auth        | Quality              |
| -------------------- | ------------------ | ----------- | -------------------- |
| **Open-Meteo** ✅    | Free               | No key      | ECMWF data, excellent|
| OpenWeatherMap       | Free (1K/day)      | API key     | Good                 |
| Visual Crossing      | Free (1K/day)      | API key     | Good historical data |

**Why Open-Meteo**: Free, no API key required (zero friction for self-hosters), ECMWF model quality.

**Usage pattern**:
- Current conditions + hourly 48h forecast + daily 7d forecast + 2 past days
- Variables: `temperature_2m`, `precipitation`, `wind_speed_10m`, `relative_humidity_2m`, `et0_fao_evapotranspiration`
- Cache TTL: 3 hours in Dexie `weatherCache` table
- Graceful degradation: rules engine falls back to calendar-only if weather unavailable

---

## i18n Framework: react-i18next (not react-intl or Lingui)

**Decision**: `i18next` + `react-i18next` + `i18next-browser-languagedetector`.

| Framework         | TypeScript | Namespaces   | Bundle | Verdict                  |
| ----------------- | ---------- | ------------ | ------ | ------------------------ |
| **react-i18next** | ✅          | ✅ First-class | ~15 KB | **Winner**               |
| react-intl        | ✅          | ⚠️ Single    | ~12 KB | No namespace support     |
| Lingui            | ✅          | ✅            | ~5 KB  | Smaller ecosystem        |

**Namespace structure**: `ui` · `plants` · `calendar` · `errors`

**Locale files**: `app/i18n/locales/{en,nl}/{ui,plants,calendar,errors}.json`

**Ships with**: 🇬🇧 English, 🇳🇱 Nederlands. Further locales (de, fr) are Stretch/Future.

**Date/number formatting**: Use `Intl.DateTimeFormat` and `Intl.NumberFormat` — not hardcoded arrays.

See `docs/i18n-and-plant-library-architecture.md` for full implementation spec.

---

## Planning Workflow: Custom Garden Planner Agent

**Decision**: Add a dedicated planning custom agent at `.github/agents/garden-planner-planning.agent.md`.

**Why**:
- Keep planning scope explicit and prevent uncontrolled requirement expansion
- Ensure plans are end-to-end (implementation through validation and docs), with no premature stop
- Standardize expert-assisted planning by requiring subagent delegation before final plan output
- Enforce project hygiene with mandatory `todo.md` updates and concise shipped-change notes

**Planning workflow requirements**:
1. Ask scoped clarifying questions up front using the ask-questions tool
2. Identify and consult relevant experts via `runSubagent`
3. Produce a concrete implementation + verification plan
4. Include documentation impact and required doc updates
5. Require `todo.md` updates, including a short **What Was Done** section
