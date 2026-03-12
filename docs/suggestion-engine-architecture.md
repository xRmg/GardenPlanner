# Suggestion Engine Architecture

**Garden Planner — dual-mode (rules + AI) suggestion engine**  
Author: GitHub Copilot (architecture design session, March 2026)  
Status: Design document — no implementation yet

---

## Executive Summary

The suggestion engine replaces the three hardcoded suggestions in `useGardenEvents.ts` with a principled, testable, gracefully-degrading system. It operates in two modes — a deterministic rules engine and an AI-assisted mode — whose outputs are merged into a unified `Suggestion[]` array consumed by `EventsBar`.

The design follows the existing patterns in the codebase: all types flow from Zod schemas, data access goes through `GardenRepository`, AI calls go through `OpenRouterClient` with the model fallback chain, and new Dexie tables follow the pattern established by `aiPlantCache`.

---

## 1. `useSuggestions` Hook API

### Parameters

```typescript
interface UseSuggestionsParams {
  areas: Area[];          // from useGardenData — plant instances live here
  seedlings: Seedling[];  // from useGardenData — for sow/harden rules
  events: GardenEvent[];  // from useGardenData — last-watered timestamps
  settings: Settings;     // lat/lng, koeppenZone, aiProvider, aiModel
  plants: Plant[];        // AVAILABLE_PLANTS (bundled + custom) — for enriching context
  repository: GardenRepository; // for reading/writing caches
}
```

The hook is intentionally *read-heavy*: it does not write back to any garden state except caches.

### Return Value

```typescript
interface UseSuggestionsReturn {
  suggestions: Suggestion[];         // sorted: high priority first, then by dueDate
  loading: boolean;                  // true during first load or manual refresh
  backgroundRefreshing: boolean;     // true during silent background refresh (no spinner)
  error: string | null;              // non-null when both AI and weather failed
  mode: SuggestionMode;             // which tier is active (see §7)
  lastRefreshed: Date | null;        // timestamp of last successful evaluation
  refresh: () => void;               // explicit user-triggered refresh
}

type SuggestionMode =
  | "ai+weather"       // Tier 1: full AI + live weather
  | "rules+weather"    // Tier 2: rules engine + live weather
  | "rules"            // Tier 3: rules engine + seasonal defaults
  | "static";          // Tier 4: bundled seasonal tips, empty garden
```

### Mode Selection Logic

Mode is determined **synchronously at the start of each evaluation run**, before any async operations:

```
1. If areas are all empty (no plant instances) AND no seedlings → Tier 4 (static)
2. If settings.aiProvider.type !== "none"
     AND lat/lng are set
     AND last weather fetch succeeded                     → attempt Tier 1 (ai+weather)
     AND AI call succeeds                                 → Tier 1
     AND AI call fails (rate limit / network)             → Tier 2 (rules+weather)
3. If lat/lng are set
     AND weather fetch succeeds                           → Tier 2 (rules+weather)
4. lat/lng missing OR weather fetch fails                 → Tier 3 (rules)
```

The resolved tier is stored in React state so the UI can show the correct badge
without waiting for suggestions to arrive.

### Refresh Strategy

| Trigger | Behaviour |
|---|---|
| `areas`, `seedlings` change | Debounced 2 s — full evaluation with `loading: true` on first run, `backgroundRefreshing: true` on subsequent runs |
| `events` change | **Not re-evaluated** — events feed into rule cooldowns at next scheduled refresh only |
| Mount | Immediate evaluation after `hasLoadedFromDB` becomes `true` |
| 15-minute timer | Silent background refresh (`backgroundRefreshing: true`) while component is mounted |
| Manual `refresh()` | Full evaluation with `loading: true` |
| `settings` change (lat/lng, AI provider) | Triggers full re-evaluation (mode may change) |

The 15-minute timer is set via `useEffect` with a `setInterval`. It uses `backgroundRefreshing` rather than `loading` to avoid UI flicker.

**Rationale for not re-triggering on `events`**: completing a suggestion logs an event which would immediately trigger a re-evaluation — a feedback loop. Weather and plant state matter for suggestions; event timestamps are consumed lazily on the next scheduled refresh.

---

## 2. Service Layer Structure

```
app/services/suggestions/
├── index.ts              — re-exports: evaluateSuggestions(), SuggestionMode
├── types.ts              — shared internal types (RuleContext, SuggestionResult,
│                           AISuggestionContext, AISuggestionsResponse)
├── rulesEngine.ts        — deterministic rule evaluation (array of Rule objects)
├── aiSuggestions.ts      — AI context builder, prompt, response parser, cache access
├── suggestionsCache.ts   — Dexie-backed 24 h cache for AI suggestion batches
└── merger.ts             — merge, deduplicate, sort (rules + AI output)
```

### Public Interface of Each Module

#### `index.ts`

```typescript
/**
 * Top-level orchestrator. Called by useSuggestions.
 * Returns the merged suggestion list and the resolved mode.
 */
export async function evaluateSuggestions(
  params: UseSuggestionsParams,
  weather: WeatherData | null,
  signal?: AbortSignal,
): Promise<{ suggestions: Suggestion[]; mode: SuggestionMode }>;
```

#### `types.ts`

```typescript
export interface RuleContext {
  currentMonth: number;        // 1-indexed, from new Date()
  koeppenZone: string;         // e.g. "Cfb"
  lat?: number;
  lng?: number;
  // All placed PlantInstances, flattened across all areas + planters
  placedPlants: Array<PlantInstance & { planterId: string; areaId: string }>;
  // All seedling batches
  seedlings: Seedling[];
  // Last event timestamp per (planterId|instanceId) × eventType
  // key: `${planterId}:${instanceId}`, value: Map<GardenEventType, Date>
  lastEvents: Map<string, Map<GardenEventType, Date>>;
  weather: WeatherData | null;  // null when Tier 3 or weather unavailable
}

// What a rule returns — id is assigned by the engine, not the rule
export interface SuggestionResult {
  /** Deterministic key: used to assign a stable id and check for duplicates.
   *  Format: `${ruleId}:${planterId}:${instanceId}:${YYYY-MM-DD}` for plant-specific,
   *          `${ruleId}:global:${YYYY-MM-DD}` for garden-wide suggestions. */
  key: string;
  type: SuggestionType;
  plant?: Plant;
  planterId?: string;
  priority: Priority;
  description: string;
  dueDate?: string;             // ISO datetime
  expiresAt?: string;           // ISO datetime — after this date, discard
  source: "rules";
  ruleId: string;
}

export interface AISuggestionResult {
  type: SuggestionType;
  plant?: Plant;                // matched from received plantName vs AVAILABLE_PLANTS
  planterId?: string;           // matched from received planterName
  priority: Priority;
  description: string;
  dueDate?: string;
  source: "ai";
}
```

#### `rulesEngine.ts`

```typescript
export interface Rule {
  /** Stable identifier — used as part of the deterministic suggestion key. */
  id: string;
  /** Human-readable label for debugging. */
  label: string;
  /**
   * Minimum days between the last event of the suggestion's corresponding
   * GardenEventType and re-firing this rule for the same plant instance.
   * E.g. a watering rule with cooldownDays=1 won't re-fire if the plant
   * was watered within the last 24 hours.
   */
  cooldownDays: number;
  evaluate(ctx: RuleContext): SuggestionResult[];
}

/**
 * RULES is the master list — order does not affect correctness
 * but reflects priority grouping for readability.
 */
export const RULES: Rule[];

/** Run all rules against the context and return deduplicated results. */
export function runRules(ctx: RuleContext): SuggestionResult[];
```

The `RULES` array contains named rule objects — one file per logical group is acceptable if the list grows large (e.g. `rules/watering.ts`, `rules/frost.ts`).

#### `aiSuggestions.ts`

```typescript
/** Build the context payload sent to the AI. */
export function buildAISuggestionContext(
  ctx: RuleContext,
  areas: Area[],
): AISuggestionContext;

/** Call the AI (via OpenRouterClient) and parse the structured response. */
export async function fetchAISuggestions(
  context: AISuggestionContext,
  client: OpenRouterClient,
  signal?: AbortSignal,
): Promise<AISuggestionResult[]>;

/** Stable cache key for a given context. */
export function aiSuggestionCacheKey(context: AISuggestionContext): string;
```

#### `suggestionsCache.ts`

```typescript
export interface AISuggestionsCacheRow {
  key: string;
  suggestions: AISuggestionResult[];
  timestamp: number;
  model: string;
}

export class SuggestionsCache {
  async get(key: string): Promise<AISuggestionResult[] | null>;
  async set(key: string, suggestions: AISuggestionResult[], model: string): Promise<void>;
  async invalidate(key: string): Promise<void>;
}
```

#### `merger.ts`

```typescript
/**
 * Merge rules output and AI output into a single deduplicated, sorted list.
 * Rules take priority on conflict (same type + plant).
 */
export function mergeSuggestions(
  rulesResults: SuggestionResult[],
  aiResults: AISuggestionResult[],
): Suggestion[];   // Suggestion = SuggestionSchema inferred type, extended (see §6)
```

### Merge / Deduplication Strategy

1. Assign stable IDs to rules results from their `key` field (SHA-1-like truncated hash is fine — `key.replace(/[^a-z0-9]/gi, '').slice(0, 16)` or just the key itself base64-encoded).
2. Collect AI results. For each AI result, check if a rules result with the same `type + plant.id` already exists:
   - If yes: discard the AI result (rule-based ground truth wins).
   - If no: include the AI result.
3. Sort the merged list by: `priority` desc (`high` → `medium` → `low`), then `dueDate` asc (sooner first), then `source` asc (`rules` before `ai`).

---

## 3. Weather Data Layer

### New File: `app/services/weather.ts`

This module is self-contained and independent of the suggestion engine — it can also be used by future features (e.g. frost alerts in the toolbar).

### Open-Meteo Endpoint

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lng}
  &current=temperature_2m,relative_humidity_2m,precipitation,apparent_temperature
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum,
         et0_fao_evapotranspiration,windspeed_10m_max,precipitation_probability_max
  &forecast_days=8
  &timezone=auto
```

**Rationale for chosen variables:**
- `et0_fao_evapotranspiration` — standard evapotranspiration estimate; drives watering rules more accurately than temperature alone
- `precipitation_probability_max` — enables "don't water today, rain likely" suggestion
- `apparent_temperature` — used for heat-stress alerts (perceived temperature matters for plants in containers)
- `forecast_days=8` — 7 actionable days plus today

We do **not** use the soil moisture variable (`soil_moisture_0_1cm`) from the `/forecast` endpoint because it reflects atmospheric model estimates rather than real measurements and varies wildly by soil type.

### TypeScript Types

```typescript
// app/services/weather.ts

export interface DailyForecast {
  date: string;                    // YYYY-MM-DD
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;                // total precipitation
  precipProbabilityPct: number;    // 0-100
  evapotranspirationMm: number;    // FAO ETo — for watering rules
  windspeedMaxKmh: number;
}

export interface CurrentConditions {
  tempC: number;
  apparentTempC: number;           // feels-like
  humidity: number;                // 0-100%
  precipMm: number;                // last hour
}

export interface WeatherData {
  current: CurrentConditions;
  today: DailyForecast;
  forecast: DailyForecast[];       // days 1-7 (tomorrow onward)
  timezone: string;                // IANA timezone from Open-Meteo
  fetchedAt: string;               // ISO datetime
  lat: number;
  lng: number;
}

// Dexie table row
export interface WeatherCacheRow {
  key: string;       // `${roundedLat}|${roundedLng}` — see below
  data: WeatherData;
  timestamp: number;
}

/** Fetch weather from Open-Meteo, using the Dexie cache (3 h TTL). */
export async function fetchWeather(
  lat: number,
  lng: number,
  repository: GardenRepository,
): Promise<WeatherData>;
```

### Caching Strategy

- **Cache key**: `${lat.toFixed(2)}|${lng.toFixed(2)}` — rounding to 2 decimal places (~1 km precision) prevents cache misses from GPS jitter while still being geographically valid.
- **TTL**: 3 hours. Weather advice for a garden is practically identical for a 3-hour window. Shorter TTL would cause unnecessary API calls; longer would give stale frost warnings.
- **Storage**: New Dexie table `weatherCache` (see §6 for schema evolution). Single row per key — `put()` overwrites.
- **Invalidation**: TTL-only. If `timestamp + 3h < now`, discard and re-fetch. No manual invalidation is needed.
- **Failure handling**: If the fetch fails (offline, rate-limited), return the stale cached entry (any age) so rules can still use last-known weather. `WeatherData` includes `fetchedAt` so the UI can show "weather data may be outdated." If no cache exists at all, return `null` — the engine degrades to Tier 3.

### Adding the Dexie Table

```typescript
// In GardenPlannerDB constructor (dexieRepository.ts):
this.version(5).stores({
  weatherCache: "key",
  aiSuggestionsCache: "key",
});
```

*(Version numbering continues from the current state of the DB.)*

---

## 4. Rules Engine Design

### Rule Object Pattern (Strategy Array)

Rules are **plain objects conforming to the `Rule` interface** collected in a single `RULES` array. This is preferred over:
- A `switch-case` (not extensible, hard to test individually)
- A class hierarchy (over-engineered for this domain)
- A plugin registry (unnecessary complexity at this stage)

Each rule is independently unit-testable by passing a mock `RuleContext`.

### Example Rule Catalogue

```typescript
// app/services/suggestions/rulesEngine.ts

export const RULES: Rule[] = [

  // ── Watering ────────────────────────────────────────────────────────────

  {
    id: "water:overdue",
    label: "Plant not watered in >3 days",
    cooldownDays: 1,
    evaluate(ctx) {
      return ctx.placedPlants
        .filter((p) => {
          const lastWatered = ctx.lastEvents
            .get(`${p.planterId}:${p.instanceId}`)
            ?.get("watered");
          const daysSince = lastWatered
            ? (Date.now() - lastWatered.getTime()) / 86_400_000
            : Infinity;
          return daysSince > 3;
        })
        .map((p) => ({
          key: `water:overdue:${p.planterId}:${p.instanceId}:${today()}`,
          type: "water" as SuggestionType,
          plant: p.plant,
          planterId: p.planterId,
          priority: "medium" as Priority,
          description: `${p.plant.name} hasn't been watered in over 3 days`,
          ruleId: "water:overdue",
          source: "rules" as const,
        }));
    },
  },

  {
    id: "water:heat-stress",
    label: "Heat-stress watering (>28°C forecast)",
    cooldownDays: 1,
    evaluate(ctx) {
      if (!ctx.weather) return [];
      const hotDays = ctx.weather.forecast.filter(
        (d) => d.tempMaxC > 28 && d.precipMm < 2
      );
      if (hotDays.length === 0) return [];
      return [
        {
          key: `water:heat-stress:global:${today()}`,
          type: "water",
          priority: "high",
          description: `Heat above 28 °C expected — give all beds an extra soak`,
          dueDate: hotDays[0].date + "T08:00:00+00:00",
          ruleId: "water:heat-stress",
          source: "rules",
        },
      ];
    },
  },

  {
    id: "water:skip-rain",
    label: "Skip watering — rain forecast",
    cooldownDays: 1,
    evaluate(ctx) {
      if (!ctx.weather) return [];
      const rainyTomorrow = ctx.weather.forecast[0]?.precipProbabilityPct > 80;
      if (!rainyTomorrow) return [];
      return [
        {
          key: `water:skip-rain:global:${today()}`,
          type: "no-water",   // new suggestion type (see §6)
          priority: "low",
          description: "Rain likely tomorrow — skip today's watering",
          ruleId: "water:skip-rain",
          source: "rules",
        },
      ];
    },
  },

  // ── Harvest ─────────────────────────────────────────────────────────────

  {
    id: "harvest:due",
    label: "Harvest window open",
    cooldownDays: 3,
    evaluate(ctx) {
      return ctx.placedPlants
        .filter((p) => {
          const inWindow = p.plant.harvestMonths.includes(ctx.currentMonth);
          const planted = p.plantingDate ? new Date(p.plantingDate) : null;
          const readyDays = p.plant.daysToHarvest ?? 0;
          const isReadyByAge = planted
            ? (Date.now() - planted.getTime()) / 86_400_000 >= readyDays * 0.9
            : inWindow; // if no planting date, trust month window
          return inWindow && isReadyByAge;
        })
        .map((p) => ({
          key: `harvest:due:${p.planterId}:${p.instanceId}:${yearMonth()}`,
          type: "harvest" as SuggestionType,
          plant: p.plant,
          planterId: p.planterId,
          priority: "medium" as Priority,
          description: `${p.plant.name} is ready to harvest`,
          ruleId: "harvest:due",
          source: "rules" as const,
        }));
    },
  },

  // ── Sowing ──────────────────────────────────────────────────────────────

  {
    id: "sow:indoor",
    label: "Sow indoors this month",
    cooldownDays: 14,
    evaluate(ctx) {
      // Only fire if the plant is in AVAILABLE_PLANTS but NOT already placed
      // (anti-spam: no point suggesting sowing tomatoes if 6 are already in)
      // ... implementation detail omitted for brevity ...
      return [];
    },
  },

  // ── Frost alerts ────────────────────────────────────────────────────────

  {
    id: "frost:warning",
    label: "Frost forecast for frost-sensitive plants",
    cooldownDays: 1,
    evaluate(ctx) {
      if (!ctx.weather) return [];
      const frostNights = ctx.weather.forecast.filter((d) => d.tempMinC <= 2);
      if (frostNights.length === 0) return [];
      const sensitivePlants = ctx.placedPlants.filter(
        (p) => p.plant.frostHardy === false || p.plant.frostSensitive === true
      );
      if (sensitivePlants.length === 0) return [];
      return [
        {
          key: `frost:warning:global:${frostNights[0].date}`,
          type: "frost",
          priority: "high",
          description: `Frost risk ${frostNights[0].date} — protect ${sensitivePlants.map((p) => p.plant.name).join(", ")}`,
          dueDate: frostNights[0].date + "T18:00:00+00:00",
          expiresAt: frostNights[0].date + "T23:59:59+00:00",
          ruleId: "frost:warning",
          source: "rules",
        },
      ];
    },
  },

  // ... more rules for fertilize, repot, weed, thin, harden-off ...
];
```

### Anti-spam: Cooldown Enforcement

The `runRules` function enforces cooldowns:

```typescript
export function runRules(ctx: RuleContext): SuggestionResult[] {
  const results: SuggestionResult[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    const candidates = rule.evaluate(ctx);
    for (const candidate of candidates) {
      // Deduplicate within this batch by key
      if (seen.has(candidate.key)) continue;
      seen.add(candidate.key);

      // Check per-plant cooldown against last event of the matching type
      if (candidate.plant && rule.cooldownDays > 0) {
        const mapKey = `${candidate.planterId ?? ""}:${candidate.plant.id}`;
        const lastEvent = ctx.lastEvents.get(mapKey)
          ?.get(suggestionTypeToEventType(candidate.type));
        if (lastEvent) {
          const elapsedDays =
            (Date.now() - lastEvent.getTime()) / 86_400_000;
          if (elapsedDays < rule.cooldownDays) continue;
        }
      }
      results.push(candidate);
    }
  }
  return results;
}
```

The mapping `suggestionTypeToEventType` connects, e.g., `"water" → "watered"`, `"harvest" → "harvested"`, `"compost" → "composted"`, etc.

---

## 5. AI Suggestions Design

### Context Serialized to the AI

The AI receives a compact JSON snapshot. PII is kept to a minimum (no location names, only Köppen zone). The payload is intentionally human-readable so prompt engineering is simple.

```typescript
// app/services/suggestions/types.ts

export interface AISuggestionContext {
  koeppenZone: string;           // e.g. "Cfb"
  currentMonth: number;          // 1-12
  hemisphere: "N" | "S";        // derived from lat sign
  weather: {
    todayTempMaxC: number;
    todayPrecipMm: number;
    next7DaysMaxTempC: number;   // worst-case heat
    next7DaysMinTempC: number;   // worst-case frost
    next7DaysTotalPrecipMm: number;
  } | null;
  plants: Array<{
    name: string;
    latinName?: string;
    plantingDate?: string;       // YYYY-MM-DD
    daysToHarvest?: number;
    daysSinceWatered?: number;   // null if never watered
    daysSinceHarvested?: number;
    planterName: string;
  }>;
  seedlings: Array<{
    plantName: string;
    status: SeedlingStatus;      // "germinating" | "growing" | "hardening" | "ready"
    daysSincePlanted: number;
  }>;
}
```

**Why not send full plant details?** The AI prompt for plant lookup already fetches rich plant data. For suggestions, we only need context informing *timing* and *state* — what's planted, how old it is, and what the weather is doing. Sending full `Plant` objects would inflate tokens without aiding suggestion quality.

### AI Response Schema

```typescript
// Validated with Zod before use
export const AISuggestionsResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      type: SuggestionTypeSchema,             // extended enum (see §6)
      plantName: z.string().optional(),       // matches a name from the context plants
      planterName: z.string().optional(),
      priority: PrioritySchema,
      description: z.string().max(120),       // keep short for the UI card
      dueDate: z.string().optional(),         // YYYY-MM-DD (not full ISO — AI often omits TZ)
      rationale: z.string().optional(),       // stripped before display, kept for logging
    })
  ).max(12),  // cap to prevent token waste and UI flooding
});
```

**Parsing strategy**: Use `safeParse`. If the response fails Zod validation, log a warning and return an empty array (graceful degradation). Never throw on AI parse failures.

**`dueDate` normalisation**: The response schema accepts `YYYY-MM-DD` strings because the AI reliably produces short dates but rarely adds timezone offsets. The merger converts to ISO datetime by appending `T09:00:00+00:00` (morning of that day) before constructing the final `Suggestion`.

### Prompt Design

The suggestion prompt is separate from the plant lookup prompt in `prompts.ts`:

```typescript
// app/services/suggestions/aiSuggestions.ts

export const SUGGESTIONS_SYSTEM_PROMPT = `
You are a practical gardening assistant. Given a garden state snapshot, return a
list of actionable care suggestions for the coming week.

Rules:
- Return ONLY valid JSON. No markdown, no prose.
- Maximum 12 suggestions. Prioritise high-urgency items.
- Match plantName exactly to the names in the input context.
- Omit suggestions that are already covered by obvious seasonal patterns
  (e.g. do not suggest "water herbs" in a Cfa zone in August — that is self-evident).
- Focus on non-obvious observations: nutrient deficiencies, pest windows, 
  harvest timing, frost risk, companion planting opportunities.
- dueDate: YYYY-MM-DD format only, within the next 7 days.
- description: 1 sentence, imperative tone, max 120 characters.
`;
```

### Caching AI Suggestion Responses

AI suggestions are aggressively cached because:
1. Garden state changes infrequently (days, not hours)
2. AI calls are expensive (tokens + latency)
3. Suggestions are not safety-critical (stale suggestions are merely unhelpful)

**Cache key construction**:

```typescript
export function aiSuggestionCacheKey(ctx: AISuggestionContext): string {
  const plantNames = ctx.plants
    .map((p) => p.name)
    .sort()
    .join(",");
  const raw = `${ctx.koeppenZone}|${ctx.currentMonth}|${plantNames}`;
  // Use a simple djb2 hash — no crypto API needed for non-security use
  return djb2Hash(raw).toString(36);
}
```

- **TTL**: 24 hours — a full garden day. Weather data is embedded in the context hash implicitly via the absence of weather in the key (meaning: suggestions cached without weather will be regenerated when weather becomes available, because the AI call path is only reached in Tier 1).
- **Invalidation**: TTL-based. Additionally, the cache entry is invalidated when `areas` changes (plant list changes) — detected by comparing the plant name set hash at evaluation time against the cached entry's key.
- **Storage**: New Dexie table `aiSuggestionsCache` (row: `{ key, suggestions, timestamp, model }`).

---

## 6. Schema Evolution

### New `SuggestionType` Values

```typescript
export const SuggestionTypeSchema = z.enum([
  // Existing
  "water",
  "harvest",
  "repot",
  "compost",
  "weed",
  // New
  "sow",        // time to start seeds indoors or direct-sow
  "fertilize",  // apply feed
  "no-water",   // over-watering warning (rain forecast or recently watered)
  "frost",      // frost protection alert
  "thin",       // thin overcrowded seedlings
  "harden",     // start hardening off indoor seedlings
]);
```

**Migration note**: The `SuggestionSchema` comment in `schema.ts` already states suggestions are NOT persisted — they are re-derived on each session. There is therefore no Dexie migration needed for new suggestion types. The only consumer of `SuggestionType` outside of runtime state is `EventsBar.tsx`'s `suggestionIcons` map, which should provide a fallback icon for unknown types.

### New Fields on `SuggestionSchema`

```typescript
export const SuggestionSchema = z.object({
  id: z.string(),
  type: SuggestionTypeSchema,
  plant: PlantSchema.optional(),
  priority: PrioritySchema,
  description: z.string(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  // New fields:
  source: z.enum(["rules", "ai", "static"]).default("rules"),
  planterId: z.string().optional(),      // link to the specific planter
  expiresAt: z.string().datetime({ offset: true }).optional(), // auto-hide after this time
  ruleId: z.string().optional(),         // which rule fired (for debugging)
});
```

**`expiresAt` usage**: Frost alerts expire at end of the forecast day. Sowing suggestions expire at end of the month. The hook filters out expired suggestions before returning them.

### New Fields on `PlantSchema`

```typescript
export const PlantSchema = z.object({
  // ... existing fields ...

  // New fields for richer rule engine input:
  /** 
   * Approximate watering interval in normal conditions (days).
   * Overrides the hardcoded 3-day default in the watering rule.
   */
  wateringIntervalDays: z.number().int().positive().optional(),

  /**
   * Weeks between fertilizer applications during growing season.
   * null/undefined → no fertilizing suggestion generated.
   */
  fertilizeIntervalWeeks: z.number().int().positive().optional(),

  /**
   * Plant cannot survive frost. Distinct from frostHardy (which is the
   * positive form). Both can coexist: frostHardy=false means it tolerates
   * light frost; frostSensitive=true means even 0°C daytime is dangerous.
   */
  frostSensitive: z.boolean().optional(),

  /**
   * Minimum night temperature tolerated (°C).
   * Used for more precise frost alerts than the binary frostHardy flag.
   */
  minTempC: z.number().optional(),
});
```

**Rationale**: `frostHardy` (existing) is retained for backwards compatibility. `frostSensitive` adds higher-resolution frost alerting without breaking existing data.

### What to Store in Dexie vs Memory

| Data | Storage | Rationale |
|---|---|---|
| `suggestions[]` | **Memory only** (React state) | Re-derived each session; schema.ts already declares this. Would require a version migration each time new suggestion types are added. |
| Weather data | **Dexie** `weatherCache` | 3-hour TTL; too expensive to refetch on every tab open |
| AI suggestion batch | **Dexie** `aiSuggestionsCache` | 24-hour TTL; AI calls are expensive |
| Last-event timestamps | **Computed from `events[]`** (memory) | Events are already in Dexie; no double-storage needed |
| `SuggestionMode` | **Memory** (React state) | Session-specific; resolves fresh on mount |

### New Dexie Version

```typescript
// dexieRepository.ts — GardenPlannerDB constructor

this.version(5).stores({
  weatherCache: "key",
  aiSuggestionsCache: "key",
});

// No upgrade() needed — new tables start empty
```

*Version numbers 3 (virtual section fix) and 4 are already taken. Use 5.*

---

## 7. Graceful Degradation Chain

### Tier 1 — AI + Weather (Full)

**Activates when:**
- `settings.aiProvider.type !== "none"` (BYOK key present, or proxy configured)
- `settings.lat` and `settings.lng` are set
- Weather fetch completes successfully (from cache or network)
- AI call completes successfully (may use cached AI response)

**What the engine does:** Runs all rules with live weather context, then augments with AI suggestions. The AI receives the full weather + plant context.

**UI indicator:** `EventsBar` header shows a small "✨ AI + live weather" badge (Lucide `Sparkles` icon, green). Loading state shows a skeleton pulse on the suggestions list.

---

### Tier 2 — Rules + Weather

**Activates when:**
- `settings.lat` and `settings.lng` are set
- Weather fetch completes successfully
- AI is either not configured, or the AI call failed (rate limit, network error, parse failure)

**What the engine does:** Runs all rules with live weather context. No AI augmentation.

**UI indicator:** `EventsBar` header shows "Live weather" badge (Lucide `CloudSun` icon, blue). If AI was configured but failed, a subtle "AI unavailable" message is shown in the suggestions footer.

---

### Tier 3 — Rules Only

**Activates when:**
- `settings.lat`/`settings.lng` are absent (user hasn't set location)
- OR weather fetch fails and no cached weather data exists
- AI is not relevant here (rules don't depend on AI)

**What the engine does:** Runs rules with `weather: null`. Rules that require weather data return no results. Seasonal rules (using `currentMonth` and `koeppenZone`) still fire. The `koeppenZone` comes from `settings.growthZone` — already stored even without coordinates (user may have entered it manually or it was deriving from a previous location).

**UI indicator:** `EventsBar` shows no badge. If lat/lng are missing, a subtle inline prompt: "Add your location for weather-aware suggestions → Settings." (Only shown if the suggestions list is short or empty — not on every render.)

---

### Tier 4 — Static Tips

**Activates when:**
- No plant instances placed in any area **AND** no seedlings tracked
- OR the rules engine itself throws an unexpected error

**What the engine does:** Returns 2-4 pre-written seasonal tips from a bundled static data structure keyed by `[hemisphere][season]`. These are generic and don't reference any specific plant.

```typescript
// Bundled in the app — never requires a network call
const STATIC_TIPS: Record<"N" | "S", Record<"spring" | "summer" | "autumn" | "winter", string[]>> = {
  N: {
    spring: ["Start seeds indoors 6-8 weeks before last frost", "Turn your compost pile after winter"],
    summer: ["Water deeply and less frequently to encourage deep roots", ...],
    ...
  },
  ...
};
```

**UI indicator:** `EventsBar` shows a subtle "Add plants to get personalised suggestions" call-to-action instead of a badge. The static tips are displayed without source attribution.

---

### Tier Transition Flow

```
useSuggestions runs evaluation:

  ┌─ Garden empty? ───────────────────────────────────────────────────────► Tier 4
  │
  ├─ Has lat/lng?
  │    └─ Yes → try fetchWeather()
  │         ├─ Success → weatherData available
  │         │     └─ AI configured?
  │         │          ├─ Yes → try fetchAISuggestions()
  │         │          │     ├─ Success ──────────────────────────────────► Tier 1
  │         │          │     └─ Fail (rate limit/network) ───────────────► Tier 2
  │         │          └─ No ─────────────────────────────────────────────► Tier 2
  │         └─ Fail (no cache, offline) ───────────────────────────────────► Tier 3
  └─ No lat/lng ────────────────────────────────────────────────────────────► Tier 3
```

---

## 8. Integration Points

### In `App.tsx`

`useSuggestions` is called **once** at the top level of `App` and replaces the hardcoded suggestions in `useGardenEvents`. The `AVAILABLE_PLANTS` array is passed in so rules can cross-reference plants not yet placed (for sow suggestions).

```typescript
// App.tsx (sketch — not full implementation)

const { areas, seedlings, settings, events, repositoryRef } = useGardenData();
const { AVAILABLE_PLANTS } = usePlantCatalog(customPlants);

const {
  suggestions,
  loading: suggestionsLoading,
  backgroundRefreshing,
  mode: suggestionsMode,
  refresh: refreshSuggestions,
} = useSuggestions({
  areas,
  seedlings,
  events,
  settings,
  plants: AVAILABLE_PLANTS,
  repository: repositoryRef.current,
});

// handleCompleteSuggestion stays in useGardenEvents
const { handleCompleteSuggestion, harvestAlerts } = useGardenEvents({
  setEvents,
  repositoryRef,
  suggestions,          // pass in for harvestAlerts derivation
});
```

`useGardenEvents` is slimmed down: it no longer manages `suggestions` state (that moves to `useSuggestions`), but it retains `handleCompleteSuggestion`, `handlePlantAdded`, `handlePlantRemoved`, and `harvestAlerts` (which is derived from `suggestions` passed in as a parameter).

### `EventsBar` Prop Updates

`EventsBar` receives two new props:

```typescript
interface EventsBarProps {
  events: GardenEvent[];
  suggestions: Suggestion[];
  harvestAlerts?: HarvestAlert[];
  onCompleteSuggestion?: (suggestion: Suggestion) => void;
  // New:
  suggestionsMode?: SuggestionMode;
  suggestionsLoading?: boolean;
}
```

The component does not need to know *how* suggestions are generated — it renders what it receives. The `suggestionsMode` prop is used to render the tier badge. The `suggestionsLoading` prop shows a skeleton while the first evaluation runs.

### Completing a Suggestion → Logging a GardenEvent

The `handleCompleteSuggestion` flow is unchanged conceptually; it just needs to handle the richer `Suggestion` type:

```typescript
// useGardenEvents.ts

function handleCompleteSuggestion(suggestion: Suggestion) {
  // 1. Remove from suggestions list (useSuggestions will re-evaluate on next refresh)
  //    If we own the suggestions state here, call setSuggestions.
  //    In the new design, useSuggestions owns the list, so we signal a refresh instead.

  // 2. Log the corresponding GardenEvent
  const eventType = suggestionTypeToEventType(suggestion.type);
  if (eventType) {
    const event: GardenEvent = {
      id: crypto.randomUUID(),
      type: eventType,
      plant: suggestion.plant,
      date: new Date().toISOString(),
      gardenId: suggestion.planterId,
      profileId: settings.profileId,
    };
    repositoryRef.current.saveEvent(event);
    setEvents((prev) => [event, ...prev]);
  }

  // 3. Trigger a background refresh of suggestions so the completed item
  //    disappears (cooldown will suppress it on next evaluation)
  refreshSuggestions();
}
```

**`suggestionTypeToEventType` mapping:**

| SuggestionType | GardenEventType |
|---|---|
| `water` | `watered` |
| `harvest` | `harvested` |
| `compost` | `composted` |
| `weed` | `weeded` |
| `repot` | `planted` (closest equivalent) |
| `sow` | `sown` |
| `fertilize` | `composted` (composted covers general soil feeding) |
| `no-water` | `null` — no event logged (just dismiss) |
| `frost` | `null` — no event logged (protection acknowledgement) |
| `thin` | `removed` |
| `harden` | `null` — no matching event type yet; log as a note event |

Note: `null` mappings mean the suggestion is dismissed without logging an event. This is valid — not every care action maps to a loggable garden event.

---

## Open Questions / Future Considerations

1. **`harden` event type**: Should `GardenEventTypeSchema` gain a `"hardened"` type to close the loop on the `harden` suggestion? Deferred — add when seedling workflow is fleshed out.

2. **Suggestion persistence across sessions**: Currently suggestions are re-derived on every session. If users want to see "I dismissed this 3 days ago," a lightweight dismissed-IDs set in `Settings` (or a new Dexie table) could be added. Not needed for Phase 1.

3. **Feedback loop for AI quality**: Tracking which AI suggestions were completed vs dismissed would allow future prompt tuning. A `dismissedAISuggestions` counter per `ruleId` in settings is a minimal first step.

4. **Multiple profiles**: The `profileId` field is already on `Area` and `GardenEvent`. `useSuggestions` filters by `settings.profileId` when flattening plant instances — this is already correct.

5. **Rate limiter integration**: The existing `RateLimiter` in `rateLimiter.ts` is per-minute token-based. AI suggestion calls should use the same limiter as plant lookups to prevent the two features from competing for quota during rapid suggestion refreshes.
