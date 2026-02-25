# AI/ML Integration Design — Garden Planner

## Table of Contents

- [A. OpenRouter Integration Design](#a-openrouter-integration-design)
- [B. Smart Suggestions Engine Design](#b-smart-suggestions-engine-design)
- [C. UX Flow for AI-Assisted Plant Entry](#c-ux-flow-for-ai-assisted-plant-entry)
- [D. Cost Estimation](#d-cost-estimation)
- [E. Implementation Roadmap](#e-implementation-roadmap)

---

## A. OpenRouter Integration Design

### A1. Model Selection (Cost vs Quality)

| Model                                   | Use Case                         | Input Cost | Output Cost | Quality                  | Latency |
| --------------------------------------- | -------------------------------- | ---------- | ----------- | ------------------------ | ------- |
| **`google/gemini-2.0-flash`**           | Plant data extraction (primary)  | $0.10/M    | $0.40/M     | High for structured data | ~1.5s   |
| **`mistralai/mistral-small`**           | Plant data extraction (fallback) | $0.10/M    | $0.30/M     | Good                     | ~1s     |
| **`google/gemini-2.0-flash`**           | Smart suggestions                | $0.10/M    | $0.40/M     | High                     | ~1.5s   |
| **`meta-llama/llama-3.3-70b-instruct`** | Budget fallback                  | $0.30/M    | $0.30/M     | Good                     | ~2s     |

**Recommended primary model: `google/gemini-2.0-flash`**

Rationale:

- Excellent at structured JSON output with schemas
- Very low cost ($0.10/M input, $0.40/M output)
- Fast response times (~1.5s)
- Strong horticultural knowledge from training data
- Native JSON mode support reduces parsing failures
- Good enough that you don't need GPT-4o for structured extraction tasks

For the plant lookup use case, bigger models like Claude or GPT-4o are overkill — the data is factual/reference and well-represented in training data.

### A2. Prompt Engineering Strategy

#### Plant Data Extraction Prompt

```typescript
// src/services/ai/prompts.ts

export const PLANT_LOOKUP_SYSTEM_PROMPT = `You are a horticultural database assistant. Given a plant name (and optionally a variety), return structured growing data in JSON format.

Rules:
- All month fields use 1-indexed arrays (1=January, 12=December)
- Sowing/harvest months should reflect UK/European temperate climate by default; adjust if a USDA zone is provided
- spacingCm is the minimum distance between plants in centimeters
- companions and antagonists are lowercase plant names (common names)
- daysToHarvest is from transplant/direct sow to first harvest
- sunRequirement is one of: "full", "partial", "shade"
- icon should be a single emoji that best represents the plant
- color should be a hex color that represents the plant's primary visual identity
- Provide 2-3 common variety suggestions if the user didn't specify one
- Include a confidence score (0-1) for each field

Return ONLY valid JSON matching the schema below. No markdown, no explanation.`;

export const PLANT_LOOKUP_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    icon: { type: "string", description: "Single emoji" },
    color: { type: "string", description: "Hex color code" },
    variety: { type: "string" },
    varietySuggestions: {
      type: "array",
      items: { type: "string" },
      description: "2-3 common varieties if user didn't specify",
    },
    description: { type: "string", maxLength: 200 },
    daysToHarvest: { type: "number" },
    spacingCm: { type: "number" },
    frostHardy: { type: "boolean" },
    sunRequirement: { type: "string", enum: ["full", "partial", "shade"] },
    sowIndoorMonths: {
      type: "array",
      items: { type: "number", minimum: 1, maximum: 12 },
    },
    sowDirectMonths: {
      type: "array",
      items: { type: "number", minimum: 1, maximum: 12 },
    },
    harvestMonths: {
      type: "array",
      items: { type: "number", minimum: 1, maximum: 12 },
    },
    companions: { type: "array", items: { type: "string" } },
    antagonists: { type: "array", items: { type: "string" } },
    confidence: {
      type: "object",
      properties: {
        daysToHarvest: { type: "number" },
        spacingCm: { type: "number" },
        frostHardy: { type: "number" },
        sowIndoorMonths: { type: "number" },
        sowDirectMonths: { type: "number" },
        harvestMonths: { type: "number" },
        companions: { type: "number" },
        antagonists: { type: "number" },
      },
    },
  },
  required: [
    "name",
    "icon",
    "color",
    "daysToHarvest",
    "spacingCm",
    "frostHardy",
    "sunRequirement",
    "sowIndoorMonths",
    "sowDirectMonths",
    "harvestMonths",
    "companions",
    "antagonists",
    "confidence",
  ],
};

export function buildPlantLookupUserPrompt(
  plantName: string,
  growthZone?: string,
  variety?: string,
): string {
  let prompt = `Plant: "${plantName}"`;
  if (variety) prompt += `\nVariety: "${variety}"`;
  if (growthZone) prompt += `\nUSDA Growth Zone: ${growthZone}`;
  return prompt;
}
```

#### Smart Suggestions Prompt

```typescript
export const SUGGESTIONS_SYSTEM_PROMPT = `You are a garden care advisor. Given the current garden state and weather data, produce actionable daily suggestions.

Each suggestion must have:
- type: one of "water", "harvest", "repot", "compost", "weed", "fertilize", "pest_check", "frost_protect", "prune", "sow"
- priority: "low", "medium", or "high"
- description: concise, actionable sentence (max 100 chars)
- reasoning: brief explanation of why this is suggested
- plantId: the plant id this applies to (or null for general tasks)
- dueDate: ISO date string for when to do this

Return a JSON array of 3-8 suggestions, ordered by priority (high first).
Consider:
- Weather forecast: temperature, rain, frost risk
- Each plant's growth stage and days since sowing
- Companion planting conflicts in the current layout
- Optimal harvest windows (compare daysToHarvest + plantingDate vs today)
- Season-appropriate sowing windows
- Time since last watering/feeding event`;

export function buildSuggestionsUserPrompt(context: {
  currentDate: string;
  growthZone: string;
  weather: WeatherData | null;
  plants: PlantState[];
  recentEvents: GardenEvent[];
  gardenLayout: LayoutSummary[];
}): string {
  return JSON.stringify(context, null, 2);
}
```

### A3. API Call Structure

#### OpenRouter Client

```typescript
// src/services/ai/openrouter.ts

interface OpenRouterConfig {
  apiKey: string;
  siteUrl?: string;
  siteName?: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterClient {
  private baseUrl = "https://openrouter.ai/api/v1";
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.config = config;
  }

  async chatCompletion(
    model: string,
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: { type: "json_object" };
      signal?: AbortSignal;
    } = {},
  ): Promise<OpenRouterResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": this.config.siteUrl || window.location.origin,
        "X-Title": this.config.siteName || "Garden Planner",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1024,
        response_format: options.responseFormat,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new OpenRouterError(response.status, error);
    }

    return response.json();
  }
}

class OpenRouterError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`OpenRouter API error: ${status}`);
  }
}
```

#### Streaming vs Batch Decision

| Scenario                       | Strategy                          | Rationale                                                                                                          |
| ------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Plant data lookup              | **Non-streaming, single request** | Response is small (~500 tokens), JSON needs to be complete to parse. Streaming adds complexity with no UX benefit. |
| Smart suggestions              | **Non-streaming, single request** | Same reasoning — JSON array must be complete.                                                                      |
| Future: description generation | Streaming                         | Only if you add free-text generation features.                                                                     |

**Use non-streaming for both current use cases.** Structured JSON responses cannot be usefully streamed to the UI since partial JSON is unparseable.

#### Retry Strategy

```typescript
// src/services/ai/retry.ts

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    retryableStatuses?: number[];
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    retryableStatuses = [429, 500, 502, 503, 504],
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable =
        error instanceof OpenRouterError &&
        retryableStatuses.includes(error.status);

      if (!isRetryable || attempt === maxRetries) throw error;

      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}
```

#### Model Fallback Chain

```typescript
const MODEL_CHAIN = [
  "google/gemini-2.0-flash",
  "mistralai/mistral-small",
  "meta-llama/llama-3.3-70b-instruct",
];

async function queryWithFallback(
  messages: ChatMessage[],
): Promise<OpenRouterResponse> {
  for (const model of MODEL_CHAIN) {
    try {
      return await withRetry(() =>
        client.chatCompletion(model, messages, {
          temperature: 0.3,
          responseFormat: { type: "json_object" },
        }),
      );
    } catch (error) {
      if (model === MODEL_CHAIN[MODEL_CHAIN.length - 1]) throw error;
      console.warn(`Model ${model} failed, falling back...`);
    }
  }
  throw new Error("All models failed");
}
```

### A4. Rate Limiting and Caching Strategy

#### Client-Side Rate Limiter

```typescript
// src/services/ai/rateLimiter.ts

export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxRequests: number = 10,
    private windowMs: number = 60_000, // 1 minute
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestInWindow = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldestInWindow) + 50;
      await new Promise((r) => setTimeout(r, waitMs));
    }

    this.timestamps.push(Date.now());
  }
}
```

#### Plant Data Cache (localStorage + in-memory)

```typescript
// src/services/ai/plantCache.ts

interface CachedPlantData {
  data: PlantAIResponse;
  timestamp: number;
  model: string;
}

const CACHE_KEY = "gp_ai_plant_cache";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — plant data doesn't change

export class PlantCache {
  private memCache = new Map<string, CachedPlantData>();

  constructor() {
    this.loadFromStorage();
  }

  private normalizeKey(name: string, variety?: string, zone?: string): string {
    return [name, variety, zone]
      .filter(Boolean)
      .map((s) => s!.toLowerCase().trim())
      .join("|");
  }

  get(name: string, variety?: string, zone?: string): PlantAIResponse | null {
    const key = this.normalizeKey(name, variety, zone);
    const cached = this.memCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      this.memCache.delete(key);
      this.persistToStorage();
      return null;
    }
    return cached.data;
  }

  set(
    name: string,
    data: PlantAIResponse,
    model: string,
    variety?: string,
    zone?: string,
  ): void {
    const key = this.normalizeKey(name, variety, zone);
    this.memCache.set(key, { data, timestamp: Date.now(), model });
    this.persistToStorage();
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const entries: [string, CachedPlantData][] = JSON.parse(raw);
        this.memCache = new Map(entries);
      }
    } catch {
      /* ignore */
    }
  }

  private persistToStorage(): void {
    try {
      const entries = Array.from(this.memCache.entries());
      localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch {
      /* ignore */
    }
  }

  /** Pre-seed with the app's DEFAULT_PLANTS to avoid AI calls for known plants */
  seedDefaults(plants: Plant[]): void {
    for (const p of plants) {
      const key = this.normalizeKey(p.name, p.variety);
      if (!this.memCache.has(key)) {
        this.memCache.set(key, {
          data: plantToAIResponse(p),
          timestamp: Date.now(),
          model: "builtin",
        });
      }
    }
  }
}
```

**Deduplication logic:** Normalize plant names (`toLowerCase().trim()`), strip articles ("the"), and match common aliases (e.g., "courgette" ↔ "zucchini") via a small alias map.

#### Suggestions Cache

Suggestions are ephemeral and context-dependent — cache for **15 minutes** in memory only. Invalidate on any garden state change (new event, plant added/removed).

---

## B. Smart Suggestions Engine Design

### B1. Architecture: Hybrid (Rules Engine + AI)

**Recommended: Hybrid architecture with rules engine as primary, AI for enrichment.**

```
┌─────────────────────────────────────────────────────┐
│                  Suggestion Pipeline                 │
│                                                      │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │ Weather  │──▶│ Rules Engine │──▶│ AI Enrichment│ │
│  │  Data    │   │ (deterministic│   │ (edge cases, │ │
│  └──────────┘   │  rules)      │   │  priorities) │ │
│                 └──────────────┘   └──────────────┘ │
│  ┌──────────┐          │                  │          │
│  │ Garden   │──────────┘                  │          │
│  │ State    │                             ▼          │
│  └──────────┘                    ┌──────────────┐    │
│  ┌──────────┐                    │   Merged &   │    │
│  │ Events   │───────────────────▶│  Deduplicated│    │
│  │ History  │                    │  Suggestions │    │
│  └──────────┘                    └──────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Why hybrid instead of pure AI?**

| Factor      | Pure AI                  | Hybrid (recommended)                                     |
| ----------- | ------------------------ | -------------------------------------------------------- |
| Cost        | Every refresh = API call | Most suggestions free (rules); AI only for complex cases |
| Latency     | 1-3s per refresh         | Rules: instant. AI: async enrichment                     |
| Reliability | Fails if API is down     | Rules always work; AI enhances when available            |
| Determinism | Non-deterministic        | Core rules are predictable and testable                  |
| Offline     | Broken                   | Fully functional in dumb mode                            |

#### Rules Engine (Tier 1 — always available)

```typescript
// src/services/suggestions/rulesEngine.ts

interface SuggestionRule {
  id: string;
  evaluate: (context: GardenContext) => Suggestion | null;
}

interface GardenContext {
  currentDate: Date;
  currentMonth: number;
  weather: WeatherData | null;
  plants: PlantWithState[]; // plants in garden + their instance data
  seedlings: Seedling[];
  recentEvents: GardenEvent[]; // last 30 days
  settings: Settings;
  gardenLayout: LayoutInfo[]; // which plants are near each other
}

const rules: SuggestionRule[] = [
  // ── FROST PROTECTION ──
  {
    id: "frost-warning",
    evaluate: (ctx) => {
      if (!ctx.weather?.forecast) return null;
      const frostNight = ctx.weather.forecast.find(
        (d) => d.tempMinC <= 2 && isWithinDays(d.date, 3),
      );
      if (!frostNight) return null;

      const tenderPlants = ctx.plants.filter((p) => !p.plant.frostHardy);
      if (tenderPlants.length === 0) return null;

      return {
        id: `frost-${frostNight.date}`,
        type: "frost_protect",
        priority: "high",
        description: `Frost forecast ${formatRelativeDate(frostNight.date)} — protect ${tenderPlants
          .map((p) => p.plant.name)
          .slice(0, 3)
          .join(", ")}`,
        dueDate: frostNight.date,
      };
    },
  },

  // ── HARVEST WINDOW ──
  {
    id: "harvest-ready",
    evaluate: (ctx) => {
      const ready = ctx.plants.filter((p) => {
        if (!p.instance.plantingDate || !p.plant.daysToHarvest) return false;
        const plantDate = new Date(p.instance.plantingDate);
        const harvestDate = addDays(plantDate, p.plant.daysToHarvest);
        const daysUntil = diffDays(ctx.currentDate, harvestDate);
        return daysUntil <= 7 && daysUntil >= -14; // within harvest window
      });

      return ready.length > 0
        ? {
            id: `harvest-${ready[0].plant.id}`,
            type: "harvest",
            priority: ready.some(
              (p) => diffDays(ctx.currentDate, harvestDate(p)) < 0,
            )
              ? "high"
              : "medium",
            description: `${ready[0].plant.icon} ${ready[0].plant.name} is ready to harvest`,
            plantId: ready[0].plant.id,
            dueDate: ctx.currentDate.toISOString(),
          }
        : null;
    },
  },

  // ── WATERING ──
  {
    id: "water-hot-weather",
    evaluate: (ctx) => {
      if (!ctx.weather?.current) return null;
      const isHot = ctx.weather.current.tempC > 28;
      const noRainSoon = !ctx.weather.forecast?.some(
        (d) => d.precipMm > 2 && isWithinDays(d.date, 2),
      );
      const lastWatered = ctx.recentEvents
        .filter((e) => e.type === "watered")
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )[0];
      const daysSinceWatered = lastWatered
        ? diffDays(new Date(lastWatered.date), ctx.currentDate)
        : 999;

      if ((isHot && noRainSoon) || daysSinceWatered > 3) {
        return {
          id: "water-now",
          type: "water",
          priority: isHot ? "high" : "medium",
          description: isHot
            ? `${ctx.weather.current.tempC}°C today — water deeply in the evening`
            : `No watering logged for ${daysSinceWatered} days`,
          dueDate: ctx.currentDate.toISOString(),
        };
      }
      return null;
    },
  },

  // ── COMPANION CONFLICT ──
  {
    id: "companion-conflict",
    evaluate: (ctx) => {
      for (const layout of ctx.gardenLayout) {
        const plantsInArea = layout.plants;
        for (const p of plantsInArea) {
          const antagonists = p.plant.antagonists || [];
          const conflicts = plantsInArea.filter(
            (other) =>
              other.plant.id !== p.plant.id &&
              antagonists.includes(other.plant.id),
          );
          if (conflicts.length > 0) {
            return {
              id: `conflict-${p.plant.id}-${conflicts[0].plant.id}`,
              type: "repot",
              priority: "medium",
              description: `${p.plant.icon} ${p.plant.name} conflicts with ${conflicts[0].plant.icon} ${conflicts[0].plant.name} — consider separating`,
            };
          }
        }
      }
      return null;
    },
  },

  // ── SOW WINDOW ──
  {
    id: "sow-window",
    evaluate: (ctx) => {
      const currentMonth = ctx.currentMonth;
      const sowable = ctx.plants.filter((p) => {
        const indoor = p.plant.sowIndoorMonths?.includes(currentMonth);
        const direct = p.plant.sowDirectMonths?.includes(currentMonth);
        return (indoor || direct) && !p.isPlanted;
      });
      if (sowable.length === 0) return null;
      const plant = sowable[0];
      const method = plant.plant.sowIndoorMonths?.includes(currentMonth)
        ? "indoors"
        : "direct outdoors";
      return {
        id: `sow-${plant.plant.id}-${currentMonth}`,
        type: "sow",
        priority: "medium",
        description: `Good time to sow ${plant.plant.icon} ${plant.plant.name} ${method}`,
      };
    },
  },

  // ── WEEDING REMINDER ──
  {
    id: "weeding-reminder",
    evaluate: (ctx) => {
      const lastWeeded = ctx.recentEvents
        .filter((e) => e.type === "weeded")
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )[0];
      const daysSince = lastWeeded
        ? diffDays(new Date(lastWeeded.date), ctx.currentDate)
        : 999;

      if (daysSince >= 7) {
        return {
          id: "weed-reminder",
          type: "weed",
          priority: daysSince > 14 ? "high" : "low",
          description: `Time to weed — last weeded ${daysSince === 999 ? "never" : `${daysSince} days ago`}`,
          dueDate: ctx.currentDate.toISOString(),
        };
      }
      return null;
    },
  },

  // ── COMPOST / FERTILIZE ──
  {
    id: "fertilize-schedule",
    evaluate: (ctx) => {
      const lastComposted = ctx.recentEvents
        .filter((e) => e.type === "composted")
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )[0];
      const daysSince = lastComposted
        ? diffDays(new Date(lastComposted.date), ctx.currentDate)
        : 999;

      if (daysSince >= 14 && [4, 5, 6, 7, 8].includes(ctx.currentMonth)) {
        return {
          id: "compost-reminder",
          type: "compost",
          priority: "low",
          description:
            "Feed your plants — add compost or liquid feed during the growing season",
          dueDate: addDays(ctx.currentDate, 2).toISOString(),
        };
      }
      return null;
    },
  },
];
```

#### AI Enrichment (Tier 2 — when AI available)

Used for:

- **Pest risk assessment** based on weather patterns + plant combinations (hard to encode as rules)
- **Prioritization refinement** across all rule-generated suggestions (reorder based on holistic context)
- **Novel suggestions** the rules engine can't anticipate (e.g., "your tomatoes may need calcium supplement based on recent heavy rain leaching")

```typescript
// Only called if: AI is available, >15min since last AI enrichment, and there's meaningful context
async function enrichSuggestionsWithAI(
  ruleSuggestions: Suggestion[],
  context: GardenContext,
): Promise<Suggestion[]> {
  const prompt = buildSuggestionsUserPrompt({
    currentDate: context.currentDate.toISOString(),
    growthZone: context.settings.growthZone,
    weather: context.weather,
    existingSuggestions: ruleSuggestions,
    plants: summarizePlantState(context.plants),
    recentEvents: context.recentEvents.slice(0, 20),
    gardenLayout: summarizeLayout(context.gardenLayout),
  });

  try {
    const response = await queryWithFallback([
      { role: "system", content: SUGGESTIONS_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ]);

    const aiSuggestions = JSON.parse(response.choices[0].message.content);
    return mergeSuggestions(ruleSuggestions, aiSuggestions);
  } catch {
    return ruleSuggestions; // graceful fallback
  }
}
```

### B2. Weather API Integration

#### Recommended: Open-Meteo (free, no API key required)

| API                                          | Free Tier                | Key Required | Data Quality           | Rate Limit |
| -------------------------------------------- | ------------------------ | ------------ | ---------------------- | ---------- |
| **[Open-Meteo](https://open-meteo.com)**     | Unlimited non-commercial | ❌ No        | Excellent (ECMWF data) | 10k/day    |
| [OpenWeatherMap](https://openweathermap.org) | 1k calls/day             | ✅ Yes       | Good                   | 60/min     |
| [WeatherAPI.com](https://weatherapi.com)     | 1M calls/month           | ✅ Yes       | Good                   | —          |

**Primary recommendation: Open-Meteo** — no API key needed, no signup, excellent data quality from ECMWF models.

```typescript
// src/services/weather/openMeteo.ts

export interface WeatherData {
  current: {
    tempC: number;
    humidity: number;
    precipMm: number;
    windKph: number;
    weatherCode: number;
  };
  forecast: DayForecast[]; // 7-day forecast
}

interface DayForecast {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;
  precipProbability: number;
  weatherCode: number;
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current:
      "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code",
    forecast_days: "7",
    timezone: "auto",
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`,
  );

  if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
  const data = await response.json();

  return {
    current: {
      tempC: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      precipMm: data.current.precipitation,
      windKph: data.current.wind_speed_10m,
      weatherCode: data.current.weather_code,
    },
    forecast: data.daily.time.map((date: string, i: number) => ({
      date,
      tempMaxC: data.daily.temperature_2m_max[i],
      tempMinC: data.daily.temperature_2m_min[i],
      precipMm: data.daily.precipitation_sum[i],
      precipProbability: data.daily.precipitation_probability_max[i],
      weatherCode: data.daily.weather_code[i],
    })),
  };
}
```

**Geocoding** (convert city name from `settings.location` to lat/lon):

```typescript
// Open-Meteo also provides free geocoding
export async function geocodeLocation(
  query: string,
): Promise<{ lat: number; lon: number } | null> {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`,
  );
  const data = await response.json();
  if (!data.results?.length) return null;
  return { lat: data.results[0].latitude, lon: data.results[0].longitude };
}
```

### B3. Data Pipeline: Weather + Garden State → Suggestions

```
                    ┌───────────────┐
                    │  App State    │
                    │  (React)      │
                    └───────┬───────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
          ┌──────────┐ ┌─────────┐ ┌─────────┐
          │ Weather  │ │ Plants  │ │ Events  │
          │ Service  │ │ + Layout│ │ History │
          └────┬─────┘ └────┬────┘ └────┬────┘
               │            │           │
               └────────────┼───────────┘
                            ▼
                   ┌─────────────────┐
                   │ GardenContext   │
                   │ (assembled)     │
                   └────────┬────────┘
                            │
                   ┌────────┼────────┐
                   ▼                 ▼
            ┌────────────┐   ┌────────────┐
            │ Rules      │   │ AI         │
            │ Engine     │   │ Enrichment │
            │ (sync)     │   │ (async)    │
            └─────┬──────┘   └─────┬──────┘
                  │                │
                  └────────┬───────┘
                           ▼
                  ┌─────────────────┐
                  │ Merge, Dedup    │
                  │ & Rank          │
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │ setSuggestions()│
                  │ (React state)   │
                  └─────────────────┘
```

#### React Hook Implementation

```typescript
// src/hooks/useSuggestions.ts

export function useSuggestions(
  plants: PlantWithState[],
  seedlings: Seedling[],
  events: GardenEvent[],
  settings: Settings,
  gardenLayout: LayoutInfo[],
) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Fetch weather every 30 minutes
  useEffect(() => {
    if (!settings.location) return;

    const fetchWeatherData = async () => {
      const coords = await geocodeLocation(settings.location);
      if (coords) {
        const data = await fetchWeather(coords.lat, coords.lon);
        setWeather(data);
      }
    };

    fetchWeatherData();
    const interval = setInterval(fetchWeatherData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [settings.location]);

  // Generate suggestions when inputs change
  useEffect(() => {
    const context: GardenContext = {
      currentDate: new Date(),
      currentMonth: new Date().getMonth() + 1,
      weather,
      plants,
      seedlings,
      recentEvents: events.filter(
        (e) => diffDays(new Date(e.date), new Date()) < 30,
      ),
      settings,
      gardenLayout,
    };

    // Tier 1: Instant rule-based suggestions
    const ruleSuggestions = evaluateRules(context);
    setSuggestions(ruleSuggestions);

    // Tier 2: AI enrichment (debounced, not on every render)
    if (settings.openRouterApiKey && shouldRefreshAI(lastRefresh)) {
      setIsLoading(true);
      enrichSuggestionsWithAI(ruleSuggestions, context)
        .then((enriched) => {
          setSuggestions(enriched);
          setLastRefresh(new Date());
        })
        .catch(() => {
          /* keep rule suggestions */
        })
        .finally(() => setIsLoading(false));
    }
  }, [plants, seedlings, events, weather, gardenLayout]);

  return { suggestions, weather, isLoading };
}

function shouldRefreshAI(lastRefresh: Date | null): boolean {
  if (!lastRefresh) return true;
  return Date.now() - lastRefresh.getTime() > 15 * 60 * 1000; // 15 min cooldown
}
```

### B4. Refresh Frequency

| Data Source             | Refresh Interval       | Trigger                               |
| ----------------------- | ---------------------- | ------------------------------------- |
| Weather data            | **30 minutes**         | Timer + app foreground                |
| Rule-based suggestions  | **Instant**            | Any state change (plant/event/layout) |
| AI-enriched suggestions | **15 minutes minimum** | State change + cooldown elapsed       |
| Full recalculation      | **On app open**        | `visibilitychange` event              |

### B5. Graceful Degradation

```
Tier 1: Full AI + Weather    → Context-aware, AI-enriched suggestions
Tier 2: Rules + Weather      → Weather-aware but no AI enrichment (API key missing/expired)
Tier 3: Rules only           → Time-based and state-based suggestions (weather API down)
Tier 4: Static fallback      → Hardcoded seasonal tips (everything offline)
```

```typescript
function getFallbackSuggestions(month: number): Suggestion[] {
  // Current static suggestions from App.tsx, but seasonally rotated
  const seasonal: Record<string, Suggestion[]> = {
    spring: [
      {
        id: "s-1",
        type: "sow",
        priority: "high",
        description: "Spring sowing season — check your seed packets",
      },
      {
        id: "s-2",
        type: "compost",
        priority: "medium",
        description: "Prepare beds with compost before planting",
      },
    ],
    summer: [
      {
        id: "s-1",
        type: "water",
        priority: "high",
        description: "Hot weather — water deeply in the evening",
      },
      {
        id: "s-2",
        type: "weed",
        priority: "medium",
        description: "Keep on top of weeds during peak growth",
      },
      {
        id: "s-3",
        type: "harvest",
        priority: "medium",
        description: "Check daily for ripe produce",
      },
    ],
    autumn: [
      {
        id: "s-1",
        type: "harvest",
        priority: "high",
        description: "Harvest remaining crops before frost",
      },
      {
        id: "s-2",
        type: "compost",
        priority: "medium",
        description: "Add fallen leaves to compost",
      },
    ],
    winter: [
      {
        id: "s-1",
        type: "compost",
        priority: "low",
        description: "Plan next year's garden layout",
      },
    ],
  };
  const season =
    month <= 2 || month === 12
      ? "winter"
      : month <= 5
        ? "spring"
        : month <= 8
          ? "summer"
          : "autumn";
  return seasonal[season];
}
```

---

## C. UX Flow for AI-Assisted Plant Entry

### C1. Step-by-Step User Flow

```
┌──────────────────────────────────────────────────────┐
│  1. User clicks "Add New Plant" in PlantDialog       │
│     ▼                                                │
│  2. User types plant name (e.g., "Basil")            │
│     - Debounce 500ms after typing stops              │
│     - Check local cache first                        │
│     ▼                                                │
│  3. Cache hit? → Show "Auto-fill from library?" bar  │
│     Cache miss + API key set? → Show "Ask AI ✨" btn │
│     No API key? → Manual entry only (current UX)     │
│     ▼                                                │
│  4. User clicks "Ask AI ✨" or auto-fill triggers    │
│     - Show skeleton/shimmer on all fields            │
│     - "Asking AI..." indicator with cancel button    │
│     ▼                                                │
│  5. AI response received (~1.5s)                     │
│     - Populate ALL fields with AI values             │
│     - Fields with confidence < 0.7 get amber ⚠ badge│
│     - All fields remain editable                     │
│     ▼                                                │
│  6. If varietySuggestions returned:                   │
│     - Show variety picker chips below the name       │
│     - User picks one → re-queries AI with variety    │
│     ▼                                                │
│  7. User reviews, optionally edits any field         │
│     - Changed fields lose the AI indicator           │
│     ▼                                                │
│  8. User clicks "Save Plant"                         │
│     - Data saved to customPlants as normal           │
│     - AI response cached for this plant+variety+zone │
└──────────────────────────────────────────────────────┘
```

### C2. UI Changes to `PlantDefinitionDialog.tsx`

Add to the existing dialog, just below the plant name field:

```tsx
{
  /* AI Auto-fill Bar — shown when name has 2+ characters */
}
{
  name.trim().length >= 2 && settings.openRouterApiKey && (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-xl border border-primary/20">
      {aiLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-primary font-medium">
            Looking up {name}...
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={cancelAiLookup}
            className="ml-auto"
          >
            Cancel
          </Button>
        </>
      ) : aiResult ? (
        <>
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-medium">
            AI-filled — review & edit below
          </span>
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            AI can fill in growing data
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAiLookup}
            className="ml-auto"
          >
            Ask AI ✨
          </Button>
        </>
      )}
    </div>
  );
}

{
  /* Variety suggestions chips */
}
{
  aiResult?.varietySuggestions?.length > 0 && (
    <div className="flex flex-wrap gap-1.5">
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        Varieties:
      </span>
      {aiResult.varietySuggestions.map((v) => (
        <button
          key={v}
          onClick={() => {
            setVariety(v);
            handleAiLookup(name, v); // re-query with variety
          }}
          className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
            variety === v
              ? "bg-primary text-white border-primary"
              : "bg-muted/30 border-white/20 hover:bg-white/60"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
```

### C3. Handling AI Uncertainty

#### Confidence Score Display

```typescript
// Thresholds
const CONFIDENCE = {
  HIGH: 0.85,   // Green — no indicator needed
  MEDIUM: 0.7,  // Amber ⚠ — "AI suggested, verify"
  LOW: 0.5,     // Red ⚠ — "Low confidence, please check"
  REJECT: 0.3,  // Leave field empty, don't auto-fill
};

function shouldAutoFill(field: string, confidence: number): boolean {
  return confidence >= CONFIDENCE.REJECT;
}

function getConfidenceBadge(confidence: number): React.ReactNode {
  if (confidence >= CONFIDENCE.HIGH) return null; // no badge needed
  if (confidence >= CONFIDENCE.MEDIUM) {
    return <span className="text-amber-500 text-[10px] font-bold ml-1" title="AI suggestion — verify">⚠</span>;
  }
  return <span className="text-red-500 text-[10px] font-bold ml-1" title="Low confidence — please check">⚠⚠</span>;
}
```

#### User Override Tracking

When a user modifies an AI-filled field, track it to improve future prompts and to give visual feedback:

```typescript
const [userOverrides, setUserOverrides] = useState<Set<string>>(new Set());

// When user edits a field that was AI-filled:
const handleFieldChange = (
  field: string,
  value: any,
  setter: (v: any) => void,
) => {
  setter(value);
  if (aiResult) {
    setUserOverrides((prev) => new Set(prev).add(field));
  }
};
```

### C4. Plant Data Caching & Deduplication

**Cache hierarchy:**

```
1. Built-in defaults (DEFAULT_PLANTS array — 12 plants, zero-cost)
      ↓ miss
2. localStorage cache (keyed by name|variety|zone, 30-day TTL)
      ↓ miss
3. In-flight dedup (if same query is already pending, await it)
      ↓ miss
4. OpenRouter API call → cache result at levels 2 & 1
```

**Common plant alias map** to prevent duplicate lookups:

```typescript
const PLANT_ALIASES: Record<string, string> = {
  zucchini: "courgette",
  "bell pepper": "pepper",
  "sweet pepper": "pepper",
  chili: "chilli",
  cilantro: "coriander",
  arugula: "rocket",
  eggplant: "aubergine",
  "green onion": "spring onion",
  scallion: "spring onion",
};

function normalizePlantName(name: string): string {
  const lower = name.toLowerCase().trim();
  return PLANT_ALIASES[lower] || lower;
}
```

---

## D. Cost Estimation

### D1. Tokens per Plant Lookup

| Component                                    | Tokens          |
| -------------------------------------------- | --------------- |
| System prompt                                | ~350            |
| User prompt (plant name + zone)              | ~30             |
| JSON response (full plant data + confidence) | ~400            |
| **Total per lookup**                         | **~780 tokens** |

With `google/gemini-2.0-flash` at $0.10/M input + $0.40/M output:

$$\text{Cost per lookup} = \frac{380 \times 0.10 + 400 \times 0.40}{1{,}000{,}000} = \$0.000198 \approx \$0.0002$$

### D2. Tokens per Smart Suggestion Refresh

| Component                                      | Tokens            |
| ---------------------------------------------- | ----------------- |
| System prompt                                  | ~400              |
| User context (weather + garden state + events) | ~800              |
| JSON response (5–8 suggestions)                | ~500              |
| **Total per refresh**                          | **~1,700 tokens** |

$$\text{Cost per refresh} = \frac{1{,}200 \times 0.10 + 500 \times 0.40}{1{,}000{,}000} = \$0.000320 \approx \$0.0003$$

### D3. Monthly Cost for a Typical User

**Assumptions for a "typical home gardener":**

- Adds 5 new plants per month (2 are cache hits from common plants)
- App opened 2× per day → 2 AI suggestion refreshes per day (with 15-min cooldown, most are rule-only)
- 30 days per month

| Activity                       | Calls/Month | Cost/Call | Monthly    |
| ------------------------------ | ----------- | --------- | ---------- |
| Plant lookups (cache miss)     | 3           | $0.0002   | $0.0006    |
| Suggestion refreshes (AI tier) | 60          | $0.0003   | $0.018     |
| **Total**                      |             |           | **$0.019** |

**Monthly cost: ~$0.02 per user** (approximately 2 cents).

Even an active "power user" (20 plant lookups + 6 suggestion refreshes/day) would cost:

$$20 \times 0.0002 + 180 \times 0.0003 = \$0.004 + \$0.054 = \$0.058/\text{month}$$

**~6 cents/month for a power user.**

If you switched to GPT-4o-mini ($0.15/M input, $0.60/M output), costs would roughly 1.5×:

| User Type | Gemini Flash | GPT-4o-mini | Claude Haiku |
| --------- | ------------ | ----------- | ------------ |
| Typical   | $0.02/mo     | $0.03/mo    | $0.03/mo     |
| Power     | $0.06/mo     | $0.09/mo    | $0.08/mo     |

All models are negligibly cheap for this use case. Choose on quality, not cost.

---

## E. Implementation Roadmap

### Phase 1: Foundation (Week 1)

1. Add `openRouterApiKey` to `Settings` interface and settings UI
2. Create `src/services/ai/openrouter.ts` — OpenRouter client with retry + model fallback
3. Create `src/services/ai/plantCache.ts` — localStorage-backed cache
4. Create `src/services/ai/prompts.ts` — prompt templates + schema

### Phase 2: AI Plant Entry (Week 2)

5. Add "Ask AI ✨" button to `PlantDefinitionDialog.tsx`
6. Implement `usePlantAILookup` hook (debounce, cache check, API call, confidence display)
7. Add variety suggestion chips UI
8. Add confidence badges to form fields

### Phase 3: Weather Integration (Week 3)

9. Create `src/services/weather/openMeteo.ts` — weather client
10. Add geocoding for `settings.location`
11. Create `useWeather` hook (30-min refresh, localStorage coords cache)
12. Display current weather in the toolbar or events bar

### Phase 4: Smart Suggestions (Week 4)

13. Create `src/services/suggestions/rulesEngine.ts` — deterministic rules
14. Create `useSuggestions` hook with tiered architecture
15. Expand `Suggestion` type to include new types (`frost_protect`, `sow`, `fertilize`, `pest_check`, `prune`)
16. Update `EventsBar.tsx` with new suggestion types + icons
17. Add AI enrichment layer
18. Implement graceful degradation with fallback tiers

### File Structure

```
src/
  services/
    ai/
      openrouter.ts        # API client
      prompts.ts           # System prompts + schemas
      plantCache.ts        # Plant data cache
      rateLimiter.ts       # Client-side rate limiter
      retry.ts             # Retry + fallback logic
    weather/
      openMeteo.ts         # Weather API client
      geocoding.ts         # Location → lat/lon
    suggestions/
      rulesEngine.ts       # Deterministic suggestion rules
      aiEnrichment.ts      # AI suggestion enrichment
      merge.ts             # Suggestion dedup + ranking
      fallback.ts          # Static seasonal fallbacks
  hooks/
    usePlantAILookup.ts    # Hook for plant dialog
    useWeather.ts          # Weather data hook
    useSuggestions.ts      # Orchestration hook
```
