# Garden Planner — Architecture Decisions

> **Purpose**: Record of key technical decisions with rationale. Captured so they don't need to be re-litigated.
> Active implementation tasks live in `todo.md`. Product vision and deployment tiers are in `docs/product-vision.md`.

---

## Persistence: Dexie.js (not SQLite WASM)

**Decision**: IndexedDB via Dexie.js v4 for local persistence. Supabase added later as a cloud sync layer.

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

**Derivation**: On location save, look up zone from lat/lng using a pre-computed 0.5° grid lookup table embedded in the app (~260 KB, offline, no API call required).

**Plant cache key**: `${name}|${latinName}|${koeppenZone}` — same plant can have different sow/harvest windows per climate.

---

## AI Provider: BYOK → Proxy Path

**Decision**: Start with user-supplied OpenRouter key (BYOK); move to server-side proxy in Phase 3.

| Phase | Approach                                         | Notes                        |
| ----- | ------------------------------------------------ | ---------------------------- |
| 1     | BYOK — key stored in Dexie `settings`            | User controls spend          |
| 3     | Cloudflare Worker proxy — key in env secrets     | No user key needed           |

**BYOK security rules (Phase 1)**:
- Never use `import.meta.env.VITE_OPENROUTER_KEY` — compiled into bundle
- Never include key in AI call logs, error reports, or JSON exports
- Validate key on entry via `GET /api/v1/models`; show green ✓ or red ✗ in Settings

**Docker self-hosted key injection** (for deployers):
```bash
# .env (gitignored)
OPENROUTER_KEY=sk-or-...
# nginx entrypoint writes {"openrouterKey": "$OPENROUTER_KEY"} → /config.json
# App fetches /config.json on load; Settings UI hidden when key is pre-injected
```

**Phase 3 backend secret rules**:
- Never use `ENV` in `Dockerfile` for secrets (visible via `docker history`)
- Cloudflare Workers: `wrangler secret put OPENROUTER_KEY`
- CI/CD: use repository secrets, never hardcode in workflow YAML

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
