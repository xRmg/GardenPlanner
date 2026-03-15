# Feature 10: AI Integration

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

AI integration is an optional capability powered by OpenRouter (BYOK — bring your own key). It augments the application in three areas: auto-filling plant catalogue entries, generating pest/disease treatment plans, and enhancing the suggestion engine with 10 AI-exclusive suggestion types. All AI requests are proxied through the backend server to keep the user's API key private.

---

## Components

| Component | File | Role |
|-----------|------|------|
| OpenRouter Client | `app/services/ai/openrouter.ts` | API client with model fallback |
| Plant AI Lookup Hook | `app/hooks/usePlantAILookup.ts` | AI-powered plant metadata retrieval |
| Plant Cache | `app/services/ai/plantCache.ts` | Two-tier caching (memory + Dexie) |
| Prompts | `app/services/ai/prompts.ts` | System/user prompt builders |
| Rate Limiter | `app/services/ai/rateLimiter.ts` | Client-side request throttling |
| Retry | `app/services/ai/retry.ts` | Exponential backoff retry |
| Treatment Options | `app/services/ai/treatmentOptions.ts` | AI treatment plan generation |
| AI Suggestions | `app/services/suggestions/aiSuggestions.ts` | AI suggestion enhancement |

---

## Sub-Features

### 10.1 Server-Side API Key Management
- User enters OpenRouter API key in Settings
- Key validated server-side: backend calls `GET https://openrouter.ai/api/v1/auth/key` with the key
- Valid key stored in SQLite `settings.aiProvider` as `{ type: "byok", key: "sk-or-v1-..." }`
- **Frontend never sees the key**: settings response returns `{ type: "server" }` instead
- Key deletion via `DELETE /api/settings/ai-key` removes from database
- All AI requests proxied via `POST /api/ai/chat` — backend injects stored key

### 10.2 AI Proxy Endpoint
`POST /api/ai/chat` accepts:
| Field | Type | Description |
|-------|------|-------------|
| `messages` | Message[] | System + user messages |
| `model` | string (optional) | Model override (default from settings) |
| `temperature` | number (optional) | Default: 0.3 |
| `maxTokens` | number (optional) | Default: 1024, max: 32,768 |

Backend forwards to OpenRouter `POST https://openrouter.ai/api/v1/chat/completions` with:
- `Authorization: Bearer {stored_key}`
- `response_format: { type: "json_object" }`
- Response returned unchanged to frontend

### 10.3 Plant AI Lookup ("Ask AI ✨")
- **Trigger**: "Ask AI ✨" button in PlantDialog (file: `PlantDefinitionDialog.tsx`, visible when AI provider = "server")
- **Flow**:
  1. Check in-memory cache → Dexie `aiPlantCache` (30-day TTL)
  2. If miss: build prompt with plant name + variety + Köppen zone + locale
  3. Send to backend proxy
  4. Parse JSON response, validate plant name match
  5. Apply confidence thresholds per field
  6. Cache result for future lookups
  7. Return filtered plant data

- **Cache key**: `name|latinName|koeppenZone|locale` (lowercase, trimmed)
- **Confidence thresholds**:
  | Level | Score | Behavior |
  |-------|-------|----------|
  | HIGH | 0.85 | Safe for display (icon, color) |
  | MEDIUM | 0.70 | Include with ⚠ indicator |
  | LOW | 0.50 | Include with ⚠⚠ indicator |
  | REJECT | 0.30 | Zero out field entirely |

- **Fields filtered**: latinName, description, daysToHarvest, spacingCm, companions, antagonists, icon, color, localized labels
- **Self-reference stripping**: Removes plant's own name from companion/antagonist lists

### 10.4 AI Treatment Options
- **Trigger**: Treatment Options Dialog (pest alert suggestion or manual action)
- **System prompt priorities**: biological > mechanical > cultural > monitor > synthetic
- **Response schema**:
  ```
  {
    summary: string,
    verifyFirst: boolean,
    confidence: 0–1,
    options: [{
      title, methodType, summary, steps[], caution, followUpDays
    }]
  }
  ```
- User selects an option or writes custom note → logged as "treatment" event

### 10.5 AI-Enhanced Suggestions (10 Exclusive Types)
AI generates these suggestion types that the rules engine cannot:
| Type | Description |
|------|-------------|
| `companion_conflict` | Antagonist plants detected adjacent in grid |
| `succession_sow` | Harvest window closing, sow replacement batch |
| `pest_alert` | Weather conditions align with known pest pressure |
| `disease_risk` | High humidity → fungal risk prediction |
| `thin_seedlings` | Seedlings germinated without follow-up thinning |
| `harden_seedlings` | Indoor seedlings ready for outdoor exposure |
| `frost_protect` | Frost forecast for tender plants |
| `end_of_season` | Late-season plants at risk |
| `mulch` | Hot/dry spell incoming |
| `prune` | Post-harvest cleanup |

- **Context serialization**: Köppen zone, hemisphere, weather summary (7 days), all placed plants with adjacency, seedlings, recent events (14 days)
- **Confidence gate**: Reject AI suggestions < 0.4
- **Rate limit**: 3 requests per 10 minutes
- **Fuzzy matching**: AI-returned plant/planter names matched to local database

### 10.6 Model Configuration
- **Default model**: `google/gemini-2.0-flash`
- **Fallback chain** (if primary fails): Gemini 2.0 Flash → Mistral Small → Llama 3.3 70B
- **User configurable**: Model ID editable in settings
- **Cost**: Estimated ~$0.024/month at 4 refreshes/day on Gemini Flash

### 10.7 Rate Limiting
- **Plant lookup**: 10 requests per 60 seconds (client-side rolling window)
- **Suggestions**: 3 requests per 10 minutes
- **Algorithm**: Maintains timestamp array, waits if at limit
- **Wait calculation**: `windowMs - (now - oldest) + 50ms` buffer

### 10.8 Retry Logic
- **Max retries**: 3 total (2 retries after first attempt)
- **Retryable statuses**: 429, 500, 502, 503, 504
- **Backoff formula**: `1000ms * 2^attempt + jitter(500ms)`

### 10.9 AI Plant Data Cache
- **Two tiers**: In-memory Map (session-scoped) + Dexie table `aiPlantCache` (persistent)
- **TTL**: 30 days
- **Seeding**: Pre-populated from user's custom plant catalogue on DB load
- **Key format**: `name|latinName|koeppenZone|locale`

---

## External Dependencies
- **OpenRouter**: `https://openrouter.ai/api/v1/chat/completions` (requires user API key)
- **Models**: Google Gemini 2.0 Flash (primary), Mistral Small (fallback), Llama 3.3 70B (fallback)
