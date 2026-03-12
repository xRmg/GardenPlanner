# Suggestion Engine — Implementation Plan

> **Status**: Planning complete. Ready for implementation.
> **Phase**: 1.9 (rules engine) + 1.10 (weather integration) — both required together
> **Inputs**: gardening expert spec, SW architecture doc, Open-Meteo API spec, AI prompt spec
> **Depends on**: 1.6 ✅ (hooks), 1.7 ✅ (OpenRouter BYOK), 1.8/1.8a/1.8b ✅ (AI plant lookup)
> **Detailed specs**: `suggestion-engine-architecture.md`, `ai-suggestion-prompts-spec.md`

---

## Overview

The suggestion engine replaces the 3 hardcoded suggestions in `useGardenEvents.ts` with a principled, dual-mode system. It is offline-capable and degrades gracefully across 4 tiers.

### Two Modes

| Mode | Description | Requirements |
|---|---|---|
| **Normal (rules-based)** | Deterministic rules fired from garden state + weather data | lat/lng + Open-Meteo |
| **AI-enhanced** | Same rules + AI enrichment via OpenRouter | Mode 1 + valid AI provider in Settings |

### Degradation Tiers

```
Tier 1: AI + Weather      → richest suggestions (AI-enhanced mode, lat/lng set)
Tier 2: Rules + Weather   → deterministic rules + live Open-Meteo data
Tier 3: Rules only        → offline, calendar + garden state only
Tier 4: Static tips       → empty garden or no data at all
```

---

## Suggestion Catalogue

### Normal Mode — 6 Core Rules

#### 1. Weeding
- **Trigger**: Avg max temp ≥ 12°C (last 3 days) AND cumulative precip ≥ 8 mm (last 5 days) AND ≥ 10 days since last `weeded` event AND growing season (Apr–Oct N. hemisphere)
- **Priority**: HIGH if temp ≥ 18°C + precip ≥ 15 mm + ≥ 14 days; MEDIUM otherwise; LOW if borderline
- **Cooldown**: 7 days after `weeded` event logged
- **Weather needs**: `temperature_2m_max` (daily, 3 days), `precipitation_sum` (daily, 5 days)

#### 2. Sowing (Indoor + Direct)
- **Trigger (indoor)**: Current month ∈ `sowIndoorMonths[]` for a plant with no active seedling/instance this season
- **Trigger (direct)**: Current month ∈ `sowDirectMonths[]` AND last-frost date passed (derived from Köppen zone)
- **Priority**: HIGH if ≤ 2 weeks to window close; MEDIUM if 3–4 weeks; LOW if window just opened
- **Escalation**: If `currentMonth + ceil(daysToHarvest/30)` exceeds frost month → HIGH regardless
- **Cooldown**: Suppress per-plant per-season after `sown` or `planted` event logged
- **Weather needs**: `temperature_2m_min` (proxy for soil temperature / germination viability), frost date from Köppen zone mapping

#### 3. Harvesting
- **Trigger**: `today ≥ plantingDate + daysToHarvest` OR `currentMonth ∈ harvestMonths[]` AND no `harvested` event this season
- **Priority**: HIGH if > 7 days overdue or within 3 days of readiness; MEDIUM if within 7 days; LOW if month window matches but 1–3 weeks away
- **Escalation**: Fast-bolting crops (lettuce, beans, courgette) → always at least MEDIUM once in window
- **Cooldown**: Suppress per-instance after `harvested` event
- **Weather needs**: Optional `temperature_2m_max` to adjust ripening speed estimate

#### 4. Fertilization
- **Trigger**: Growing season active AND planter has active instances AND ≥ 28 days since last `composted` event (or never this season)
- **Priority**: HIGH if ≥ 42 days or never this season; MEDIUM if 28–41 days; season-opener HIGH 
- **Suppression**: Do NOT fire if > 15 mm rain forecast within 48 h (nutrient runoff)
- **Cooldown**: 21 days after `composted` event
- **Weather needs**: `precipitation_sum` forecast (next 48 h)

#### 5. Watering
- **Trigger**: Cumulative precip last 5 days < 10 mm AND max temp last 3 days ≥ 18°C AND ≥ 2–3 days since last `watered` event
- **Priority**: HIGH if < 2 mm in 7+ days AND temp ≥ 25°C; MEDIUM if < 5 mm in 5 days AND temp ≥ 20°C; LOW otherwise
- **Mutual exclusion**: Cannot coexist with No-Watering suggestion for same planter
- **Cooldown**: 2 days after `watered` event
- **Weather needs**: `precipitation_sum` (daily, 7 days past), `temperature_2m_max` (daily, 3 days), `et0_fao_evapotranspiration` (primary when available)

#### 6. No-Watering (Skip)
- **Trigger**: Forecast precip next 24 h ≥ 8 mm OR next 48 h ≥ 15 mm AND precipitation_probability ≥ 70% AND Watering rule would otherwise fire
- **Priority**: Always MEDIUM (informational, positive)
- **Note**: Replaces Watering suggestion for same planter — the two must be mutually exclusive
- **Weather needs**: `precipitation_probability` (hourly, 48 h), `precipitation_sum` forecast

### AI-Enhanced Mode — 10 Additional Suggestion Types

| Type | Description | Requires |
|---|---|---|
| `companion_conflict` | Antagonist plant detected adjacent in grid | Grid layout + `antagonists[]` |
| `succession_sow` | Just harvested / near harvest — sow next batch now | `harvestMonths[]`, last harvest event |
| `pest_alert` | Weather conditions align with known pest pressure window | Humidity + temp + Köppen zone |
| `disease_risk` | Prolonged high humidity → fungal risk | VPD, humidity (hourly forecast) |
| `thin_seedlings` | Germination events without thinning follow-up | Seedling batches, age |
| `harden_seedlings` | Indoor seedlings ready for gradual outdoor exposure | Seedling age + outdoor temp forecast |
| `frost_protect` | Frost forecast within 48 h for frost-sensitive plants | `temperature_2m_min` forecast, `frostHardy` |
| `end_of_season` | Late season with plants still in ground | `harvestMonths[]`, frost date proximity |
| `mulch` | Hot/dry spell coming, bare soil exposed | ET₀, soil moisture, temp forecast |
| `prune` | Post-harvest cleanup recommended | Recent `harvested` events + plant type |

> **AI Rule**: AI must NOT generate `water`, `weed`, `harvest`, `fertilize`, or `no-water` types — those belong to the rules engine.

---

## Schema Changes Required

### Extended `SuggestionTypeSchema`
```typescript
// Current: ["water", "harvest", "repot", "compost", "weed"]
// Add:
"sow"           // replaces generic "compost" for sowing context
"fertilize"     // rename "compost" → "fertilize" (or add alongside)
"no-water"      // new: skip-watering positive suggestion
"frost"         // new: frost protection alert
"companion_conflict"  // AI only
"succession_sow"      // AI only
"pest_alert"          // AI only
"disease_risk"        // AI only
"thin_seedlings"      // AI only
"harden_seedlings"    // AI only
"end_of_season"       // AI only
"mulch"               // AI only
"prune"               // AI only
```

### Extended `SuggestionSchema`
```typescript
// New fields to add:
source: z.enum(["rules", "ai", "static"]).default("rules"),
planterId: z.string().optional(),     // which planter this applies to
expiresAt: z.string().datetime({ offset: true }).optional(), // auto-dismiss time
```

### New Plant Fields (optional enhancement)
```typescript
// Optional additions to PlantSchema for better rules:
wateringIntervalDays: z.number().int().positive().optional(),  // default: 3
fertilizeIntervalWeeks: z.number().int().positive().optional(), // default: 4
frostSensitive: z.boolean().optional(),  // complement to frostHardy
minTempC: z.number().optional(),         // germination minimum
```

### New Dexie Tables (version bump required)
```
weatherCache: { id, lat, lng, data, fetchedAt }   — 3h TTL
aiSuggestionsCache: { id, contextHash, suggestions, createdAt }  — 24h TTL
```

---

## File Structure

```
app/
  services/
    weather.ts                      — Open-Meteo client + WeatherData types + 3h Dexie cache
    suggestions/
      index.ts                      — evaluateSuggestions() orchestrator
      types.ts                      — RuleContext, SuggestionResult, AISuggestionContext
      rulesEngine.ts                — Rule[] strategy array + runRules()
      aiSuggestions.ts              — AI context builder, prompt, response parser, cache
      suggestionsCache.ts           — Dexie-backed 24h AI suggestions cache
      merger.ts                     — merge(), dedup(), sort() for rules + AI output
  hooks/
    useSuggestions.ts               — React hook wiring together weather + evaluateSuggestions
```

---

## Open-Meteo Integration

### Endpoint
`GET https://api.open-meteo.com/v1/forecast`

### Required Parameters
```
latitude={lat}&longitude={lng}
&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,is_day
&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,et0_fao_evapotranspiration,vapour_pressure_deficit,soil_moisture_0_to_1cm
&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,et0_fao_evapotranspiration,weather_code
&forecast_days=7
&forecast_hours=48
&past_days=2
&timezone=auto
```

> **Important**: `timezone=auto` is **required** — without it the API returns 400 for daily data

### Caching
- Cache key: `${lat.toFixed(2)}|${lng.toFixed(2)}`
- TTL: 3 hours (Dexie `weatherCache` table)
- Stale-while-revalidate: serve cached data while fetching fresh in background
- On location change: invalidate immediately

### Watering Decision Logic
```
waterBudget = sum(rain_sum, last 5 days) - sum(et0_fao_evapotranspiration, last 5 days)
if waterBudget < -10mm → HIGH watering
if waterBudget < -5mm  → MEDIUM watering  
if waterBudget < 0mm   → LOW watering
if forecast precip next 24h ≥ 8mm AND probability ≥ 70% → no-water (override)
```

### Frost Alert Logic
- Variable: `temperature_2m_min` (daily forecast)
- Threshold: ≤ 2°C within next 48 hours
- Affects: all `PlantInstance` where `plant.frostHardy !== true`
- Priority: always HIGH

---

## AI Suggestions — Key Design Decisions

### System Prompt Summary
- Role: practical gardening advisor. Pure JSON output. Max 12 suggestions.
- Hard prohibition: do NOT generate water/weed/harvest/fertilize (rules engine owns those)
- Climate-aware: use Köppen zone + hemisphere for all timing
- Confidence scoring: suppress < 0.40, show ⚠ on 0.40–0.79, clean at ≥ 0.80

### Context Serialization (target: ~800 input tokens)
```json
{
  "today": "2026-03-12",
  "koeppenZone": "Cfb",
  "hemisphere": "N",
  "weather": {
    "tempNow": 9.4,
    "tempMinNext7d": 2.1,
    "tempMaxNext7d": 14.2,
    "precipLast5dMm": 3.2,
    "precipNext48hMm": 0.5,
    "precipProbMax": 20,
    "humidityPct": 72
  },
  "plants": [
    {
      "name": "Tomato",
      "planterName": "Raised Bed A",
      "plantedDate": "2026-02-01",
      "daysToHarvest": 75,
      "sowDirectMonths": [4,5],
      "harvestMonths": [7,8,9],
      "companions": ["Basil"],
      "antagonists": ["Fennel"],
      "adjacentPlants": ["Fennel"]
    }
  ],
  "seedlings": [
    { "name": "Pepper", "status": "sprouted", "daysSinceSeeded": 18 }
  ],
  "recentEvents": [
    { "type": "watered", "daysAgo": 2, "planterName": "Raised Bed A" }
  ],
  "activeRuleSuggestions": ["harvest:Tomato", "water:RaisedBedA"]
}
```

### Response Schema
```json
{
  "suggestions": [
    {
      "type": "companion_conflict",
      "plantName": "Tomato",
      "planterName": "Raised Bed A",
      "priority": "medium",
      "description": "Fennel nearby will inhibit your Tomato — move one of them.",
      "dueDate": "2026-03-15",
      "confidence": 0.92,
      "rationale": "Tomato adjacentPlants includes Fennel which is in antagonists list."
    }
  ]
}
```

### AI Caching
- Cache key: hash of `koeppenZone + hemisphere + month + sorted(plant@planter) + seedling statuses + weather fingerprint`
- Weather fingerprint: temp at 1°C granularity, precip at 5mm granularity
- TTL: 24 hours
- Invalidation: when new plant added, harvest logged, or seedling status changes

### Cost Estimate
- ~1,030 tokens/request (800 in + 230 out) at $0.10/$0.40 per million (Gemini Flash)
- ~$0.024/month per user at 4 refreshes/day
- Rate limiting: `RateLimiter(3, 600_000)` — max 3 AI suggestion calls per 10 minutes

---

## `useSuggestions` Hook Interface

```typescript
function useSuggestions(params: {
  areas: Area[];
  seedlings: Seedling[];
  events: GardenEvent[];
  settings: Settings;
  plants: Plant[];
  repository: GardenRepository;
}): {
  suggestions: Suggestion[];
  loading: boolean;
  backgroundRefreshing: boolean;
  error: string | null;
  mode: "ai+weather" | "rules+weather" | "rules" | "static";
  lastRefreshed: Date | null;
  refresh: () => void;
}
```

### Refresh Triggers
- On mount (after DB loads)
- When `areas` or `seedlings` change (debounced 2s)
- Background timer every 15 minutes
- Manual `refresh()` call
- Settings change (lat/lng, AI provider)
- **NOT on `events` change** — prevents completion→refresh feedback loop

---

## Integration with Existing Code

### In `App.tsx` (or whichever component owns top-level state)
```typescript
const { suggestions, loading, mode } = useSuggestions({
  areas, seedlings, events, settings, plants, repository
});
// Pass to EventsBar, replacing hardcoded suggestions
```

### In `EventsBar.tsx`
- Add `suggestionsMode` and `suggestionsLoading` props
- Add mode indicator badge (✨ AI | 🌤 Weather | 📅 Rules | 📋 Static)
- `onCompleteSuggestion` → logs a GardenEvent then calls `refreshSuggestions()`

### Completing a Suggestion → Auto-logs an Event
```
Watering suggestion completed  → logs "watered" event
Harvest suggestion completed   → logs "harvested" event
Weeding suggestion completed   → logs "weeded" event
Fertilization suggestion       → logs "composted" event
Sowing suggestion              → logs "sown" event
```

---

## Implementation Order

1. **Schema changes** — extend `SuggestionTypeSchema`, add new Suggestion fields, optional Plant fields
2. **Weather service** — `app/services/weather.ts` + Dexie `weatherCache` table
3. **Rules engine** — `app/services/suggestions/rulesEngine.ts` (all 6 rules)
4. **`useSuggestions` hook** — rules-only first (Tier 2/3), weather integrated
5. **Wire into `EventsBar`** — replace hardcoded suggestions
6. **AI suggestions service** — `app/services/suggestions/aiSuggestions.ts` + `suggestionsCache.ts`
7. **Merger** — `app/services/suggestions/merger.ts` to combine AI + rules output
8. **Enable Tier 1** — activate in `useSuggestions` when AI provider is set
9. **Tests** — unit tests for rules engine (deterministic, easy to test) + weather cache

---

## Open Questions

- [ ] Köppen zone → frost date mapping table: bundled lookup (see `useLocationSettings.ts`) — which zones need explicit overrides?
- [ ] Should `no-water` be surfaced even when no `water` suggestion would fire? (positive reinforcement — "no need to water today, rain coming")
- [ ] Planter type (container vs raised bed vs row) affects watering interval — add to `Planter` schema?
- [ ] Heavy-feeding crop classification: add `feedingClass: "light" | "medium" | "heavy"` to Plant schema for fertilization intervals, or use a static lookup table keyed by plant name?
- [ ] Max visible suggestions in `EventsBar`: cap at 5–7 to avoid overwhelming, with "N more..." expand?
- [ ] Should `frost_protect` bypass the AI-only restriction and also be generated by the rules engine? (It's deterministic: `temp ≤ 2°C + frostHardy: false`)
