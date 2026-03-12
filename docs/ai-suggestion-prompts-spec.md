# AI Suggestion Prompts — Full Specification

**Garden Planner — AI-enhanced suggestion engine: prompts, context, schema & operations**  
Author: GitHub Copilot (design session, March 2026)  
Status: Design specification — complements `suggestion-engine-architecture.md`

---

## Relationship to Existing Docs

`suggestion-engine-architecture.md` covers the *structural* design: hooks, service modules, merge strategy, Dexie schema, and tier degradation. This document focuses exclusively on the **AI layer**: prompt wording, context serialisation, response schema, suggestion taxonomy, confidence thresholds, caching, cost, and failure modes. The two documents are complementary; implement both together.

---

## 1. System Prompt Design

### Design Goals

- Pure JSON output — no markdown fence, no prose
- Hard cap on response length (never more than 12 suggestions)
- Climate-aware framing via Köppen zone *and* hemisphere
- Defer to the rule engine for routine reminders (don't repeat water/harvest)
- Bias toward non-obvious, value-adding observations

### Complete System Prompt

```
You are a practical gardening advisor embedded in a garden planning application.
Your role is to review a garden state snapshot and return a JSON list of
actionable care suggestions for the coming 7 days.

RESPONSE FORMAT
- Return ONLY a single valid JSON object. No markdown, no code fences, no prose.
- The object must have exactly one key: "suggestions" (array).
- Limit to a maximum of 12 suggestions. If fewer than 12 are genuinely warranted,
  return only those. Do not pad with low-value suggestions.

SUGGESTION PRINCIPLES
- Prefer non-obvious advice: companion planting conflicts, pest/disease pressure
  windows, succession sowing opportunities, harvest timing nuances.
- Do NOT repeat what a basic rule engine would already catch:
  - Overdue watering when no rain is forecast
  - Harvest-window reminders derivable from planting date + daysToHarvest alone
  - Generic seasonal tips ("water more in summer")
- Each suggestion must be directly supported by at least one piece of data in
  the input context (plant name, planting date, weather reading, seedling status).
  Never invent plants or events not present in the context.
- description: one imperative sentence, ≤ 120 characters, no plant emoji.
- rationale: one internal sentence (≤ 100 chars) explaining why — for logging only,
  never displayed to the user.

CLIMATE AWARENESS
- Apply the supplied Köppen–Geiger zone and hemisphere to all timing advice.
- Month numbers in the input are 1-indexed (1 = January). Sowing and harvest
  windows that are correct for zone "Cfb" Northern Hemisphere are NOT correct
  for "Cfb" Southern Hemisphere. Adjust accordingly.
- "frost risk" means tempMinC ≤ 2 °C forecast within 7 days.

CONFIDENCE SCORES
- Include a confidence score (0.0–1.0) on every suggestion.
- High confidence (≥ 0.80): AI is reasoning directly from input data.
- Medium confidence (0.55–0.79): Plausible but depends on unstated factors
  (soil type, pot size, watering method, local microclimate).
- Low confidence (< 0.55): Highly situational; output only if the upside is
  significant (e.g. disease outbreak window where timing is critical).
- Never return a suggestion with confidence < 0.40. Suppress it instead.

PRIORITY RULES
- "high": time-sensitive, risk of plant loss or missed harvest window within 48 h
- "medium": should act this week, minor consequence if delayed
- "low": informational / planning ahead

FIELD CONSTRAINTS
- type: must be one of the values listed below.
- plantName: must exactly match a name from plants[] in the input, or omit.
- planterName: must exactly match a name from plants[].planterName, or omit.
- dueDate: YYYY-MM-DD format, within the next 7 days, or omit.
- All strings must be valid UTF-8 with no control characters.

VALID SUGGESTION TYPES
water, harvest, repot, compost, weed, sow, fertilize, no_water, frost_protect,
thin_seedlings, harden_seedlings, companion_conflict, succession_sow, pest_alert,
disease_risk, end_of_season, mulch, prune

Return schema (JSON):
{
  "suggestions": [
    {
      "type": string,
      "plantName": string | null,
      "planterName": string | null,
      "priority": "high" | "medium" | "low",
      "description": string,
      "dueDate": string | null,
      "rationale": string,
      "confidence": number
    }
  ]
}
```

### Prompt Design Rationale

| Choice | Reason |
|---|---|
| "Do NOT repeat what a basic rule engine would already catch" | Without this, the AI duplicates every watering suggestion at significant token cost |
| `rationale` field kept internal | Gives the AI a scratchpad thought, improving suggestion quality without polluting the UI |
| Hard type allowlist in the prompt | Prevents hallucinated types like `"transplant_shock"` that the client can't render |
| `confidence < 0.40` suppressed at source | Cheaper than filtering post-response; also signals to the model not to emit garbage |
| `description ≤ 120 chars` | Matches the `EventsBar` card width; avoids text overflow without truncation |

---

## 2. Context Serialisation Schema

### Token Budget Analysis

Target: **~800 input tokens** beyond the system prompt.

| Component | Estimated Tokens |
|---|---|
| System prompt (above) | ~380 |
| Garden context JSON | ~400 |
| User prompt framing | ~20 |
| **Total input** | **~800** |

At `gpt`-class tokenisation, 1 token ≈ 4 characters. The garden context must therefore stay under ~1,600 characters to meet the target.

### `AISuggestionContext` — Full Definition

```typescript
// app/services/suggestions/types.ts

export interface AISuggestionContext {
  // ── Location & climate ───────────────────────────────────────────────────
  koeppenZone: string;         // e.g. "Cfb"
  hemisphere: "N" | "S";      // derived: lat >= 0 ? "N" : "S"
  currentMonth: number;        // 1–12 from new Date() at evaluation time

  // ── Weather summary ──────────────────────────────────────────────────────
  // null when weather unavailable (Tier 3 — AI is not called in Tier 3,
  // but the field is optional so the type doesn't need two branches)
  weather: {
    todayTempMaxC: number;        // rounded to 1 dp
    todayPrecipMm: number;        // rounded to 1 dp
    next7DaysMaxTempC: number;    // max of daily maxes — heat stress indicator
    next7DaysMinTempC: number;    // min of daily mins — frost risk indicator
    next7DaysTotalPrecipMm: number; // sum — drought/waterlogging indicator
    next7DaysPrecipProbMax: number; // max daily rain probability 0–100
  } | null;

  // ── Placed plants ─────────────────────────────────────────────────────────
  plants: Array<{
    name: string;           // plant.name — exact, for matching in response
    planterName: string;    // planter.name — exact, for matching in response
    plantingDate: string | null;  // YYYY-MM-DD (not full ISO — saves tokens)
    daysToHarvest: number | null;
    daysSinceWatered: number | null;  // null if no watering event ever logged
    companions: string[];   // plant.companions — for companion conflict detection
    antagonists: string[];  // plant.antagonists — for conflict detection
    frostSensitive: boolean;
  }>;

  // ── Seedlings ────────────────────────────────────────────────────────────
  seedlings: Array<{
    name: string;           // seedling.plant name
    status: "germinating" | "growing" | "hardening" | "ready";
    daysSinceSown: number;
  }>;

  // ── Recent events (last 14 days only) ────────────────────────────────────
  // Lets AI reason about what has already been done recently
  recentEvents: Array<{
    type: string;           // GardenEventType string
    plantName: string | null;
    daysAgo: number;        // integer, 0 = today
  }>;
}
```

### Serialisation to Prompt String

The context is serialised as compact JSON (no indentation) and injected as the user message body. See §8 for a full example.

### What to Include vs Omit

**Include:**

| Field | Why |
|---|---|
| `koeppenZone` + `hemisphere` | Without these, month-based timing advice is meaningless |
| `weather.*` summary (6 numbers) | Frost risk, heat stress, drought/rain context in ~60 chars |
| `plant.name` + `plant.planterName` | Needed so the AI can reference specific plants by name in response |
| `plant.plantingDate` | Enables days-since-planting growth stage inference |
| `plant.daysToHarvest` | Allows harvest timing calculation AI can't do without it |
| `plant.daysSinceWatered` | Lets AI reason about moisture stress without restating the rule |
| `plant.companions` + `plant.antagonists` | Required for `companion_conflict` suggestions |
| `plant.frostSensitive` | Needed for precise frost-protect targeting |
| `seedling.status` + `seedling.daysSinceSown` | Drives `harden_seedlings` and `thin_seedlings` |
| `recentEvents` (14 days) | Prevents suggesting something just done; enriches disease/pest risk |

**Omit:**

| Field | Why Omitted |
|---|---|
| `plant.id` | Internal UUID; AI never needs it (response uses name, not id) |
| `plant.color` + `plant.icon` | Visual metadata, irrelevant to horticultural advice |
| `plant.description` + `plant.latinName` | AI already knows these plants; sending them wastes ~200 tokens |
| `plant.sowIndoorMonths[]` + `sowDirectMonths[]` | AI knows these from its training; context sends `currentMonth` instead |
| `plant.spacingCm` | Only relevant during placement, not ongoing care |
| `plant.amount` (seed stock) | Inventory, not a care input |
| `area.id`, `planter.id`, `planter.rows/cols` | Grid geometry is irrelevant for suggestions |
| `harvestDate` | Mostly null; skippable |
| `pestEvents[]` | Rich structured data — summarise into `recentEvents` instead |
| Full `lat/lng` | Privacy; `koeppenZone + hemisphere` carries the same horticultural meaning |
| `settings.locale` | Has no bearing on gardening advice |
| Events older than 14 days | Rarely relevant; stale events inflate tokens |

### Serialisation Helper (Design)

```typescript
// buildAISuggestionContext() converts rich app state to the compact format:

function formatPlantingDate(iso: string | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10); // "YYYY-MM-DD" — strips time and timezone
}

function daysDiff(iso: string | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// Weather summary: reduce 8 × DailyForecast objects to 6 summary numbers
function summariseWeather(w: WeatherData): AISuggestionContext["weather"] {
  const days = [w.today, ...w.forecast];
  return {
    todayTempMaxC: round1(w.today.tempMaxC),
    todayPrecipMm: round1(w.today.precipMm),
    next7DaysMaxTempC: round1(Math.max(...days.map((d) => d.tempMaxC))),
    next7DaysMinTempC: round1(Math.min(...days.map((d) => d.tempMinC))),
    next7DaysTotalPrecipMm: round1(days.reduce((s, d) => s + d.precipMm, 0)),
    next7DaysPrecipProbMax: Math.max(...days.map((d) => d.precipProbabilityPct)),
  };
}
```

---

## 3. Response JSON Schema

### Zod Schema (Validated at Runtime)

```typescript
// app/services/suggestions/aiSuggestions.ts

import { z } from "zod";
import { PrioritySchema } from "@/app/data/schema";

// All types the AI is permitted to return — superset of SuggestionTypeSchema
const AI_SUGGESTION_TYPE = z.enum([
  // Existing types (rule engine also uses these)
  "water",
  "harvest",
  "repot",
  "compost",
  "weed",
  "sow",
  "fertilize",
  "no_water",
  "frost_protect",
  "thin_seedlings",
  "harden_seedlings",
  // AI-only types
  "companion_conflict",
  "succession_sow",
  "pest_alert",
  "disease_risk",
  "end_of_season",
  "mulch",
  "prune",
]);

export const AISuggestionItemSchema = z.object({
  type: AI_SUGGESTION_TYPE,
  plantName: z.string().max(80).nullable().optional(),
  planterName: z.string().max(80).nullable().optional(),
  priority: PrioritySchema,
  description: z.string().max(120),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  rationale: z.string().max(100).optional(), // internal only, stripped before display
  confidence: z.number().min(0).max(1),
});

export const AISuggestionsResponseSchema = z.object({
  suggestions: z.array(AISuggestionItemSchema).max(12),
});

export type AISuggestionItem = z.infer<typeof AISuggestionItemSchema>;
export type AISuggestionsResponse = z.infer<typeof AISuggestionsResponseSchema>;
```

### `max_tokens` Budget

**Recommendation: `max_tokens = 1200`**

Reasoning:
- 12 suggestions × ~7 fields × ~12 chars/field ≈ ~1,000 JSON characters ≈ ~250 tokens
- JSON structural overhead (keys, punctuation, whitespace) adds ~150 tokens
- Safety margin: ×1.5 for verbosity variance across model providers → ~600 tokens
- Setting to 1,200 tokens provides headroom without wasting money

Setting too low (e.g. 400) risks truncated JSON. Setting too high (e.g. 4,000) is wasteful but models stop at `]` anyway — the real cost is still per-token used, not per-token allowed.

### Post-Parse Normalisation

After Zod `safeParse` succeeds, apply these transforms before merging:

```typescript
function normaliseAIResponse(
  raw: AISuggestionsResponse,
  context: AISuggestionContext,
): AISuggestionResult[] {
  const validPlantNames = new Set(context.plants.map((p) => p.name));
  const validPlanterNames = new Set(context.plants.map((p) => p.planterName));

  return raw.suggestions
    // 1. Suppress low-confidence suggestions (see §5)
    .filter((s) => s.confidence >= 0.40)
    // 2. Validate plant/planter names against context
    .map((s) => ({
      ...s,
      plantName: s.plantName && validPlantNames.has(s.plantName)
        ? s.plantName : null,
      planterName: s.planterName && validPlanterNames.has(s.planterName)
        ? s.planterName : null,
    }))
    // 3. Normalise dueDate to full ISO datetime (morning of that day, UTC)
    .map((s) => ({
      ...s,
      dueDate: s.dueDate ? `${s.dueDate}T09:00:00+00:00` : undefined,
    }))
    // 4. Strip rationale (internal only)
    .map(({ rationale: _r, ...rest }) => ({ ...rest, source: "ai" as const }));
}
```

---

## 4. Suggestion Types for AI Mode

### Extended Taxonomy

Beyond the 4 base rules-engine types (`water`, `weed`, `harvest`, `compost`), the AI may generate these additional types. Each entry includes: required context fields, minimum confidence threshold, and an example message.

---

#### `companion_conflict`
**Description**: Two plants placed in the same or adjacent planters are known antagonists of each other, potentially suppressing growth or attracting shared pests.  
**Required context**: `plant.antagonists[]`, at least 2 plants in context  
**Confidence threshold**: 0.65 — companion data varies by cultivar and is widely debated; never flag at low confidence  
**Example**: `"Fennel in Bed A may suppress the basil planted nearby — consider separating them"`  
**Notes**: The AI must cite specific plant names from the context. Generic "some plants don't mix" suggestions must be suppressed.

---

#### `succession_sow`
**Description**: A fast-maturing crop currently in the ground could be followed by a second sowing to extend the harvest window, given remaining season length.  
**Required context**: `plant.daysToHarvest`, `currentMonth`, `koeppenZone`, `hemisphere`  
**Confidence threshold**: 0.60 — requires accurate frost-free season length inference  
**Example**: `"Radishes in Row 2 will finish by April — sow a second batch now for a June harvest"`  
**Notes**: Only fire when at least 60 days of frost-free growing remain. AI must calculate this from Köppen zone + currentMonth rather than returning generic "plant a second batch" advice.

---

#### `pest_alert`
**Description**: Seasonal pest pressure window is opening for a specific plant, based on climate zone, current month, and recent temperature pattern.  
**Required context**: `koeppenZone`, `currentMonth`, `weather.next7DaysMaxTempC`  
**Confidence threshold**: 0.55 — pest windows are probabilistic; show with ⚠ indicator below 0.70  
**Example**: `"Aphid pressure typically peaks for brassicas in Cfb zones during March — inspect undersides of leaves"`  
**Notes**: AI must name the specific pest *and* the specific plant. Vague "watch for pests" suggestions are rejected by the confidence filter because they carry no actionable signal.

---

#### `disease_risk`
**Description**: Environmental conditions (humidity, recent rain, warm nights) create elevated risk for a specific fungal or bacterial disease on a named plant.  
**Required context**: `weather.next7DaysTotalPrecipMm`, `weather.next7DaysMaxTempC`, plant name  
**Confidence threshold**: 0.60 — must be grounded in weather data, not speculation  
**Example**: `"High humidity forecast after rain raises late blight risk for tomatoes — ensure good airflow"`  
**Notes**: This type is most valuable precisely when the rule engine cannot fire it, because the rule engine has no disease model. Unlike `pest_alert`, `disease_risk` can be garden-wide (no specific plantName required) if the risk applies broadly.

---

#### `thin_seedlings`
**Description**: A seedling batch has been growing long enough that overcrowding is likely, or is in "growing" status past the typical thinning window.  
**Required context**: `seedling.status`, `seedling.daysSinceSown`  
**Confidence threshold**: 0.70 — thinning timing depends on pot depth and species, both omitted from the context  
**Example**: `"Carrot seedlings sown 18 days ago should be thinned to 5 cm spacing before roots establish"`

---

#### `harden_seedlings`
**Description**: An indoor seedling batch marked "growing" or "ready" should begin or continue the hardening-off process given current outdoor conditions.  
**Required context**: `seedling.status`, `weather.next7DaysMinTempC`, `currentMonth`  
**Confidence threshold**: 0.65 — should not fire if any frost risk present (tempMinC ≤ 2 in forecast)  
**Example**: `"Tomato seedlings are ready to start hardening off — put them outside for 1–2 hours on warm days"`  
**Notes**: Do not suggest hardening if `weather.next7DaysMinTempC ≤ 2`. This is redundant with the `frost_protect` rule but the AI is better placed to combine the two signals.

---

#### `frost_protect`
**Description**: Frost is forecast and specific frost-sensitive plants are at risk; a protection action is needed before nightfall.  
**Required context**: `weather.next7DaysMinTempC`, `plant.frostSensitive`  
**Confidence threshold**: 0.80 — safety-critical; only fire when weather data is present and unambiguous  
**Example**: `"Frost forecast Thursday night — cover the courgettes in Bed B with fleece before dark"`  
**Notes**: This duplicates the rule-engine `frost:warning` rule intentionally. The AI version can add specificity (which planter, suggested action). The merger deduplicates on `type + plantName`, so only one version appears. Rule-engine version takes priority per the deduplication strategy.

---

#### `end_of_season`
**Description**: A plant is past its harvest window and likely declining; removal would free space and prevent disease.  
**Required context**: `plant.harvestMonths[]`, `currentMonth`, `plant.plantingDate`  
**Confidence threshold**: 0.65 — seasonal end varies significantly by year and microclimate  
**Example**: `"Broad beans in Row 1 are past their peak harvest month — remove spent plants to free bed space"`

---

#### `mulch`
**Description**: Conditions favour applying mulch: heat wave incoming, dry spell after recent harvest, or soil-conserving before winter.  
**Required context**: `weather.next7DaysMaxTempC` or `weather.next7DaysTotalPrecipMm`  
**Confidence threshold**: 0.55 — informational; clearly flagged with ⚠ if below 0.70  
**Example**: `"30 °C forecast this week — apply a 5 cm mulch layer to retain soil moisture in raised beds"`

---

#### `prune`
**Description**: A pruning action is seasonally appropriate for a named plant (e.g. cutting back herbs to prevent bolting, removing tomato suckers during fruit set).  
**Required context**: `plant.name`, `currentMonth`, `koeppenZone`  
**Confidence threshold**: 0.60 — pruning advice is species-specific; only generate when the AI is confident it applies to the named plant  
**Example**: `"Pinch out tomato side shoots while plants are in active growth to concentrate energy on fruit"`

---

### Suppressed Types (AI Should Never Emit)

These types must be handled by the rule engine only:

| Type | Reason for AI Exclusion |
|---|---|
| `water` | Rule engine handles with cooldown + ET₀ data; AI duplication adds noise |
| `repot` | Requires pot-size data not present in context |
| `weed` | Entirely local observation; no remote inference possible |

---

## 5. Confidence Thresholds & Filtering

### Hard Threshold: 0.40 — Suppress Entirely

Any suggestion with `confidence < 0.40` must be **dropped before sending to the merger**. This is enforced in `normaliseAIResponse()`. The model is instructed in the system prompt not to emit these, but the client-side filter is the authoritative guard.

**Rationale**: At < 0.40 the AI is essentially guessing. Even with a ⚠ indicator, surfacing wildly speculative suggestions erodes user trust faster than showing fewer suggestions.

### Indicator Thresholds

| Confidence | Display Treatment | UI Signal |
|---|---|---|
| ≥ 0.80 | Shown normally, no indicator | — |
| 0.55 – 0.79 | Shown with amber ⚠ tooltip | ⚠ "AI estimate — verify before acting" |
| 0.40 – 0.54 | Shown with amber ⚠ tooltip + reduced visual prominence (opacity-75) | ⚠ "Low confidence — use judgment" |
| < 0.40 | **Dropped** | Not shown |

The tooltip text should be accessible (keyboard-focusable, `aria-label`). The `⚠` badge is rendered on the `EventsBar` suggestion card, not in the description text.

### Ranking: AI vs Rule-Based Suggestions

Rules-based suggestions are pre-sorted by the rules engine before merging. The merged list uses this sort key:

```
1. priority (high → medium → low)
2. source (rules before ai — within the same priority tier)
3. dueDate ascending (sooner due dates first; null last)
4. confidence descending (higher-confidence AI suggestions bubble up within tier)
```

**Practical effect**: A rule-generated `high`-priority frost warning always precedes an AI `high`-priority pest alert. Two AI medium-priority suggestions are sorted by confidence (most confident first). This mirrors the principle that deterministic facts outrank probabilistic estimates.

### AI Suggestion Count Cap

Even after confidence filtering, cap at **8 AI suggestions** in the final merged list (in addition to unlimited rule suggestions). This prevents AI output from monopolising the `EventsBar` in pathological cases where the model returns 12 suggestions at 0.80+ confidence.

The cap is applied in `merger.ts` after deduplication:

```typescript
const aiSuggestions = merged.filter(s => s.source === "ai").slice(0, 8);
const ruleSuggestions = merged.filter(s => s.source !== "ai");
return [...ruleSuggestions, ...aiSuggestions];
```

---

## 6. Caching Strategy for AI Suggestions

### Cache Key Construction

The cache key must be stable for the same garden state but change when the state changes in a suggestion-relevant way. Full garden state hashing (including `plantingDate`, every event timestamp) would invalidate far too often.

**Key inputs:**
```typescript
function aiSuggestionCacheKey(ctx: AISuggestionContext): string {
  // Sort plant names for stability regardless of planter ordering
  const plantFingerprint = ctx.plants
    .map((p) => `${p.name}@${p.planterName}`)
    .sort()
    .join(",");

  const seedlingFingerprint = ctx.seedlings
    .map((s) => `${s.name}:${s.status}`)
    .sort()
    .join(",");

  // Round weather to 1 °C and 5 mm to avoid cache misses from minor fluctuations
  const weatherFingerprint = ctx.weather
    ? [
        Math.round(ctx.weather.next7DaysMinTempC),
        Math.round(ctx.weather.next7DaysMaxTempC),
        Math.round(ctx.weather.next7DaysTotalPrecipMm / 5) * 5,
      ].join("|")
    : "no-weather";

  const raw = [
    ctx.koeppenZone,
    ctx.hemisphere,
    ctx.currentMonth,
    plantFingerprint,
    seedlingFingerprint,
    weatherFingerprint,
  ].join("::");

  return djb2Hash(raw).toString(36); // 7–8 char alphanumeric key
}
```

**What this key captures:**
- Which plants are in the garden and in which planters
- Seedling status changes (germinating → hardening triggers cache miss)
- Weather shifts of ≥ 1 °C temp or ≥ 5 mm precip

**What it deliberately ignores (to avoid over-invalidation):**
- Exact planting dates (minor date drift does not change advice)
- `daysSinceWatered` (volatile; watering logs would invalidate on every irrigation)
- Individual event history (summarised in `recentEvents` which changes slowly)

### TTL: 24 Hours

**Justification:**
- Garden state genuinely changes on a daily cadence at most (new plantings, harvests)
- Weather data refreshes every 3 hours (by `weatherCache`), but the AI-summarised weather fingerprint only changes by ≥ 1 °C — a meaningful threshold
- AI suggestions are advisory, not safety-critical; 24-hour-old advice is still useful
- Cost: at ~$0.001/request (see §7), daily refresh per user is $0.03/month — acceptable
- A 4-hour TTL would be triggered by normal weather fluctuation too often
- A 48-hour TTL risks missing important same-day changes (sudden frost forecast)

### Invalidation Triggers

| Trigger | Action |
|---|---|
| TTL expired (`timestamp + 24h < now`) | Re-fetch on next evaluation |
| New plant placed anywhere (any area) | Cache miss (plant fingerprint changes) |
| Plant removed | Cache miss (fingerprint changes) |
| Seedling status changes | Cache miss (seedling fingerprint changes) |
| `harvest` event logged | **No immediate invalidation** — TTL handles it; the advice won't change in the next few hours |
| `watered` / `weeded` events | **No invalidation** — `daysSinceWatered` is not in the key |
| User changes Köppen zone in Settings | Cache miss (zone is in the key) |
| User changes lat/lng | Does NOT directly cause a miss — zone + hemisphere are in key, not raw coordinates. The next weather fetch will update the weather fingerprint if conditions differ. |

### Stale-While-Revalidate

To avoid blocking the UI on cache miss:

1. Serve the cached (expired) result immediately, marking suggestions with `stale: true` internally
2. Trigger a background re-fetch
3. On completion, update state with fresh suggestions

This is already described in `suggestion-engine-architecture.md` via `backgroundRefreshing`. The `stale` flag is internal to the hook and not surfaced in the `Suggestion` schema.

---

## 7. Cost & Rate Limiting

### Token Estimate Per Request

| Component | Tokens |
|---|---|
| System prompt | ~380 |
| User prompt (context JSON) | ~400 |
| Response (12 suggestions) | ~250 |
| **Total per request** | **~1,030 tokens** |

This estimate is conservative. In practice, gardens with ≤ 5 plants will use ~700 tokens total. Gardens with 15+ plants may approach 1,200 tokens.

### Cost Estimate Per Model

| Model | Input price/1M tokens | Output price/1M tokens | Cost/request | Cost/month @ 4/day |
|---|---|---|---|---|
| `google/gemini-2.0-flash` | $0.10 | $0.40 | ~$0.0002 | ~$0.024 |
| `mistralai/mistral-small` | $0.10 | $0.30 | ~$0.0002 | ~$0.024 |
| `meta-llama/llama-3.3-70b-instruct` | $0.12 | $0.40 | ~$0.0002 | ~$0.024 |

*Prices approximate as of Q1 2026; check OpenRouter pricing before quoting to users.*

**At 4 requests/day per user: ~$0.024/month.** This is negligible — the BYOK model means the user pays this directly from their own OpenRouter balance.

**At 1 request/day (recommended refresh rate): ~$0.006/month.** Users are unlikely to notice the cost.

### Recommended Refresh Policy

**On-demand + daily TTL — not on every page load.**

Rationale:
- Page loads happen frequently (tab restores, refreshes, phone screen-on)
- Garden state changes slowly; the 24h cache handles most cases
- AI suggestions appearing instantly from cache > a spinner on every load

Refresh triggers:
1. **Automatic**: When the cache entry is expired (TTL check on mount)
2. **Manual**: User taps a "Refresh suggestions" button in `EventsBar` (rate-limited to once per 10 minutes)
3. **State-change**: When the garden fingerprint changes (new plant, seedling status change)

**Do NOT auto-refresh on every page load** even if the cache is warm. Check the TTL first.

### Rate Limiting Strategy

Two layers of protection:

#### Layer 1 — Client-Side (`RateLimiter` — existing)

The existing `RateLimiter(10, 60_000)` applies globally across all AI calls. For suggestion fetches specifically, add a dedicated per-feature rate limit:

```typescript
// app/services/suggestions/aiSuggestions.ts
const suggestionRateLimiter = new RateLimiter(
  3,          // max 3 suggestion requests
  600_000,    // per 10-minute window
);
```

This prevents a bug or fast-clicking user from burning budget. 3 per 10 minutes accommodates the normal flow: initial load + 2 manual refreshes.

#### Layer 2 — Backend Proxy (Future)

If the app adds the backend proxy (`proxyUrl` in `OpenRouterConfig`), the proxy should enforce:
- Per-session rate limit: 20 AI requests per hour
- Suggestion-type endpoint rate limit: 6 per hour (separate from plant-lookup)
- Circuit breaker: if the upstream API returns 429 three times in a row, stop forwarding requests for 15 minutes and return a `503` to the client

---

## 8. Example Complete Prompt

### Scenario

**Garden**: Two planters in a single area. Bed A has 3 tomato plants (planted 68 days ago) and basil (planted 40 days ago). Row 1 has a fennel plant. One seedling tray of courgette seedlings currently hardening off. Recent frost event 3 days ago.  
**Climate**: Köppen Cfb, Northern Hemisphere, March (month 3).  
**Weather**: Max 16 °C today, forecast min -1 °C in 6 days, 8 mm total rain next week.

---

### System Prompt

*(As written in §1 above — not repeated here for brevity)*

---

### User Prompt

```
Garden state:
{"koeppenZone":"Cfb","hemisphere":"N","currentMonth":3,"weather":{"todayTempMaxC":16.0,"todayPrecipMm":0.0,"next7DaysMaxTempC":18.0,"next7DaysMinTempC":-1.0,"next7DaysTotalPrecipMm":8.0,"next7DaysPrecipProbMax":55},"plants":[{"name":"Tomato","planterName":"Bed A","plantingDate":"2026-01-03","daysToHarvest":75,"daysSinceWatered":2,"companions":["basil","carrot","parsley"],"antagonists":["fennel","brassica"],"frostSensitive":true},{"name":"Basil","planterName":"Bed A","plantingDate":"2026-01-31","daysToHarvest":null,"daysSinceWatered":2,"companions":["tomato","pepper"],"antagonists":["sage","fennel"],"frostSensitive":true},{"name":"Fennel","planterName":"Row 1","plantingDate":"2026-02-01","daysToHarvest":90,"daysSinceWatered":5,"companions":[],"antagonists":["tomato","basil","brassica"],"frostSensitive":false}],"seedlings":[{"name":"Courgette","status":"hardening","daysSinceSown":25}],"recentEvents":[{"type":"watered","plantName":"Tomato","daysAgo":2},{"type":"watered","plantName":"Basil","daysAgo":2},{"type":"watered","plantName":"Fennel","daysAgo":5}]}
```

*Character count: ~960 chars ≈ 240 tokens. Total input with system prompt: ~620 tokens.*

---

### Expected AI Response

```json
{
  "suggestions": [
    {
      "type": "frost_protect",
      "plantName": "Tomato",
      "planterName": "Bed A",
      "priority": "high",
      "description": "Cover tomatoes in Bed A with fleece — frost forecast (-1 °C) in 6 days",
      "dueDate": "2026-03-18",
      "rationale": "Tomato is frostSensitive, next7DaysMinTempC = -1 °C",
      "confidence": 0.92
    },
    {
      "type": "frost_protect",
      "plantName": "Basil",
      "planterName": "Bed A",
      "priority": "high",
      "description": "Basil is highly frost-sensitive — bring indoors or cover when frost is forecast",
      "dueDate": "2026-03-18",
      "rationale": "Basil frostSensitive=true, same frost forecast",
      "confidence": 0.95
    },
    {
      "type": "companion_conflict",
      "plantName": "Fennel",
      "planterName": "Row 1",
      "priority": "medium",
      "description": "Fennel in Row 1 is an antagonist of nearby Tomato and Basil — consider relocating it",
      "dueDate": null,
      "rationale": "Fennel.antagonists includes tomato,basil; all present in garden",
      "confidence": 0.82
    },
    {
      "type": "harden_seedlings",
      "plantName": "Courgette",
      "planterName": null,
      "priority": "medium",
      "description": "Continue hardening courgette seedlings — increase outdoor time to 4–6 hours on frost-free days",
      "dueDate": null,
      "rationale": "status=hardening, daysSinceSown=25; no frost in next 4 days",
      "confidence": 0.76
    },
    {
      "type": "disease_risk",
      "plantName": "Tomato",
      "planterName": "Bed A",
      "priority": "medium",
      "description": "Rain after dry spell raises early blight risk for tomatoes — water at base, not on foliage",
      "dueDate": null,
      "rationale": "8mm rain after dry period, Cfb zone spring conditions favour early blight",
      "confidence": 0.61
    },
    {
      "type": "succession_sow",
      "plantName": null,
      "planterName": null,
      "priority": "low",
      "description": "March is the last reliable window in Cfb/N to start tomato seeds indoors for a second planting",
      "dueDate": "2026-03-31",
      "rationale": "currentMonth=3, Cfb zone last frost typically April; 75 DTH tomatoes need Mar start",
      "confidence": 0.70
    }
  ]
}
```

**Observations on this example response:**
- The two `frost_protect` suggestions will be **deduplicated against** the rule engine's `frost:warning` rule output (same `type + plantName`); rule-engine version wins per §5
- `companion_conflict` (fennel vs tomato/basil) is genuinely AI-only: no rule can detect this without knowledge of which plants are antagonists of which
- `disease_risk` at 0.61 confidence gets a ⚠ indicator in the UI
- `succession_sow` fires as informational (`low` priority) with a deadline
- Total response: ~600 characters ≈ 150 tokens — well within budget

---

## 9. Failure Modes & Graceful Degradation

### 9.1 Malformed JSON Response

**Scenario**: The model returns prose, a partial JSON snippet, or JSON wrapped in a markdown code fence.

**Handling:**

```typescript
function parseAIResponse(raw: string): AISuggestionsResponse | null {
  // 1. Strip markdown fences (``` ... ```) — common with Llama/Mistral
  const stripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  // 2. Attempt JSON.parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    console.warn("[AI Suggestions] JSON.parse failed — returning empty", { raw: raw.slice(0, 200) });
    return null;
  }

  // 3. Zod validation
  const result = AISuggestionsResponseSchema.safeParse(parsed);
  if (!result.success) {
    console.warn("[AI Suggestions] Schema validation failed", result.error.flatten());
    return null;
  }

  return result.data;
}
```

**Result on null return**: Fall through to rule-engine-only suggestions (Tier 2 behaviour). No error is surfaced to the user. The failure is logged internally for diagnostics.

**Partial recovery**: If `parsed` is an object with a `suggestions` array but some individual items fail validation, Zod `safeParse` still rejects the whole response. Consider using `z.array(...).safeParse(parsed?.suggestions)` if partial recovery is ever needed — but for now, all-or-nothing is simpler and safer.

### 9.2 All Models in Fallback Chain Fail

**Scenario**: `google/gemini-2.0-flash` returns 429, `mistralai/mistral-small` returns 503, `meta-llama/llama-3.3-70b-instruct` times out.

**Handling in `OpenRouterClient`**: The existing `withRetry` wrapper and fallback chain already handle this by cycling through `MODEL_CHAIN`. When all three fail, `chatCompletion` throws `OpenRouterError`.

**In `fetchAISuggestions`**: Catch the error, log it, and return `[]` (empty array).

```typescript
try {
  const raw = await client.chatCompletionWithFallback(messages, options);
  return normaliseAIResponse(parseAIResponse(raw) ?? { suggestions: [] }, ctx);
} catch (err) {
  console.warn("[AI Suggestions] All models failed:", err);
  return []; // Tier 2 degrades to rule-engine only
}
```

**User-visible effect**: The mode badge in `EventsBar` shows "Live weather" (Tier 2) instead of "AI + live weather" (Tier 1). A small inline note: "AI suggestions temporarily unavailable" appears in the `EventsBar` footer (not an error toast — not alarming enough to interrupt the user). This note is `source: "static"` and disappears on the next successful AI fetch.

### 9.3 AI Hallucinates Unknown Suggestion Types

**Scenario**: The model returns `"type": "transplant_shock"` or `"type": "soil_ph_adjustment"` not in the allowlist.

**Handling**: `AI_SUGGESTION_TYPE` Zod enum rejects unknown values. With `safeParse`, unknown types cause the entire response to fail validation (§9.1 path). With `z.array(...).safeParse()` applied per-item, unknown types cause individual items to be dropped, preserving valid items.

**Recommended approach**: Per-item validation to maximise recovery:

```typescript
const rawItems: unknown[] = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
const validItems = rawItems
  .map((item) => AISuggestionItemSchema.safeParse(item))
  .filter((r): r is z.SafeParseSuccess<AISuggestionItem> => r.success)
  .map((r) => r.data);
```

This is more resilient than whole-response validation. The tradeoff is that a model consistently producing 3 good items + 9 hallucinated types will still surface those 3 good items.

**Hard defence**: The `AI_SUGGESTION_TYPE` enum is the final allowlist. A suggestion whose type is not in `EventsBar`'s `suggestionIcons` map will fall back to a generic ℹ icon — it will not crash the UI.

### 9.4 Surfacing AI vs Rules-Based Source

**Principle**: Don't burden the user with implementation details — surface *enough* to build trust, not a debugging console.

**Treatment by context:**

| Situation | What the User Sees |
|---|---|
| Mode is Tier 1 (AI + weather) | `EventsBar` header badge: ✨ "AI-assisted" (small, muted, not prominent) |
| Mode is Tier 2 (rules + weather) | Badge: ☁ "Live weather" |
| Mode is Tier 3 (rules only) | No badge; prompt shown if garden is sparse |
| Mode is Tier 4 (static) | "Add plants for personalised suggestions" CTA only |
| Individual AI suggestion (confidence 0.55–0.79) | Small ⚠ on the suggestion card; tooltip: "AI estimate — verify before acting" |
| Individual AI suggestion (confidence ≥ 0.80) | No indicator — appears identical to rule-based suggestions |
| AI suggestion marked completed | Logs as a `GardenEvent` identically to rule-based completion |

**Philosophy**: High-confidence AI suggestions earn the right to appear without any source branding. The ⚠ indicator serves as calibration for lower-confidence items, not as a general "this came from AI" label. Users care about *whether the advice is good*, not *which system generated it*.

**Debugging (developer only)**: In `import.meta.env.DEV` mode, the `EventsBar` suggestion card renders the `ruleId` or `"source: ai"` in a `<details>` element below each card. This is stripped in production builds.

---

## Appendix A — djb2 Hash Implementation

The cache key uses a simple non-cryptographic hash (no `crypto.subtle` needed since this is not security-sensitive):

```typescript
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash;
}
```

Collision probability for distinct garden fingerprints is negligible: with a 32-bit hash space and fewer than 1,000 distinct garden configurations per user, the birthday problem gives a collision probability < 0.01%.

---

## Appendix B — `EventsBar` Icon Map Extension

The existing `suggestionIcons` map in `EventsBar.tsx` must be extended to cover all new types. Recommended Lucide icons:

| Type | Lucide Icon | Colour |
|---|---|---|
| `companion_conflict` | `AlertTriangle` | amber |
| `succession_sow` | `Repeat` | green |
| `pest_alert` | `Bug` | orange |
| `disease_risk` | `Microscope` | red |
| `thin_seedlings` | `Scissors` | teal |
| `harden_seedlings` | `Sun` | yellow |
| `frost_protect` | `Snowflake` | blue |
| `end_of_season` | `Leaf` | brown |
| `mulch` | `Layers` | brown |
| `prune` | `Scissors` | green |
| `no_water` | `CloudRain` | blue |
| `sow` | `Sprout` | green |
| `fertilize` | `FlaskConical` | purple |
| Unknown (fallback) | `Info` | grey |

---

## Appendix C — Open Questions / Future Considerations

1. **Localisation of AI-generated descriptions**: AI responses arrive in English. If i18n is added (Phase 3), AI descriptions must either (a) be requested in the user's locale via an added `locale` field in the context, or (b) be post-translated via a lightweight translate API call. Option (a) is preferred — add `locale: string` to `AISuggestionContext` and append `"Respond in {locale} language."` to the system prompt.

2. **User feedback on AI suggestions ("Was this helpful?")**: A thumbs-down stored in Dexie could suppress the same `type + plantName` combination for 7 days. This would act as personalised confidence decay at zero cost. Deferred to Phase 2.

3. **Confidence score granularity**: The AI returns `confidence` as a single per-suggestion number. A multi-dimensional confidence (e.g. `{timing: 0.9, severity: 0.6}`) would allow the UI to indicate "timing confident, impact uncertain" but would complicate the prompt and schema significantly. Keep single-dimension for now; revisit if user testing reveals specific confusion patterns.

4. **Model-specific prompt tuning**: Gemini 2.0 Flash tends to follow the "no prose" instruction reliably. Mistral Small occasionally wraps JSON in a code fence (already handled in §9.1). Llama 3.3 70B is verbosely explanatory and may exceed `max_tokens` on the response — prepending "Be terse." to the system prompt when Llama is the active model (detectable from `OpenRouterClient.lastUsedModel`) mitigates this.
