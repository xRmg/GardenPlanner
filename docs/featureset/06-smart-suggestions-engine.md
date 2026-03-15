# Feature 6: Smart Suggestions Engine

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

The suggestion engine is the intelligence layer of the application. It analyzes the current garden state, recent events, weather data, and plant metadata to generate prioritized, actionable care recommendations. The system operates in four tiers that gracefully degrade based on available data sources (AI, weather, rules, static).

---

## Components

| Component | File | Role |
|-----------|------|------|
| Suggestions Hook | `app/hooks/useSuggestions.ts` | Orchestration, refresh scheduling, tier selection |
| Rules Engine | `app/services/suggestions/rulesEngine.ts` | 8 deterministic rules |
| AI Suggestions | `app/services/suggestions/aiSuggestions.ts` | AI enhancement layer |
| Merger | `app/services/suggestions/merger.ts` | Deduplication and aggregation |
| Cache | `app/services/suggestions/suggestionsCache.ts` | TTL-based Dexie caching |
| Orchestrator | `app/services/suggestions/index.ts` | Tier evaluation and pipeline |
| Events Bar | `app/components/EventsBar.tsx` | Suggestion display and completion |

---

## Data Model

### Suggestion (Runtime — NOT persisted)
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `type` | SuggestionType enum | What action to take |
| `plant` | Plant (optional) | Related plant |
| `priority` | "low" \| "medium" \| "high" | Urgency level |
| `description` | string | Human-readable advice |
| `dueDate` | ISO 8601 datetime (optional) | When to act |
| `planterId` | string (optional) | Target planter |
| `instanceId` | string (optional) | Target plant instance |
| `expiresAt` | ISO 8601 datetime (optional) | Auto-dismiss time |
| `source` | "rules" \| "ai" \| "static" | Origin engine |
| `areaId` | string (optional) | Target area |
| `scope` | "area" \| "planter" \| "plant" | Targeting level |
| `areaName` / `planterName` | string (optional) | Display names |

### Suggestion Types

**Rules engine types** (8):
`water`, `harvest`, `repot`, `compost`, `weed`, `sow`, `fertilize`, `treatment`, `no_water`, `frost_protect`

**AI-exclusive types** (10):
`thin_seedlings`, `harden_seedlings`, `companion_conflict`, `succession_sow`, `pest_alert`, `disease_risk`, `end_of_season`, `mulch`, `prune`

---

## Sub-Features

### 6.1 Four-Tier Degradation

| Tier | Mode | Requirements | Fallback Trigger |
|------|------|-------------|------------------|
| 1 | AI + Weather | AI provider configured + location set + weather available | AI fails → Tier 2 |
| 2 | Rules + Weather | Location set + weather available | Weather fails → Tier 3 |
| 3 | Rules Only | Garden has plants | No plants → Tier 4 |
| 4 | Static Tips | Empty garden | N/A (fallback floor) |

Mode badge displayed in EventsBar: "AI + Weather" (violet), "Rules + Weather" (sky), "Rules" (emerald), "Static" (gray).

### 6.2 Deterministic Rules (8 Rules)

#### Rule 1: Watering
- **Trigger**: Water budget negative (5-day rain < ET₀ evapotranspiration) + ≥2 days since last watered
- **Suppression**: All plants dormant or dead
- **Priority**: HIGH if budget < −10mm AND maxTemp ≥25°C; MEDIUM if < −5mm AND ≥20°C; else LOW

#### Rule 2: Sowing (Indoor & Direct)
- **Trigger**: Plant in sowIndoorMonths or sowDirectMonths; direct sowing also requires lastFrostMonth check
- **Blocker**: Plant already has active seedling or placed instance from current year
- **Priority**: HIGH if ≤2 weeks to window close; MEDIUM if ≤4 weeks; else LOW

#### Rule 3: Harvesting
- **Trigger**: daysToHarvest elapsed OR harvestMonths match current month
- **Fast-bolting crops**: lettuce, spinach, rocket, arugula, beans, courgette, radish (HIGH priority when overdue ≥0 days)
- **Overdue priority**: HIGH if >7 days overdue; else MEDIUM
- **Cooldown**: 30 days per instance

#### Rule 4: Fertilization
- **Trigger**: Growing season + ≥21 days since last composted event
- **Suppression**: Heavy rain forecast (48h total ≥15mm, probability ≥60%)
- **Priority**: HIGH if ≥42 days or never composted; else MEDIUM

#### Rule 5: Weeding
- **Trigger**: Growing season + wet warm weather (avg 3-day temp ≥12°C, 5-day precip ≥8mm)
- **Cooldown**: 7 days per planter
- **Priority**: HIGH if temp ≥18°C AND precip ≥15mm AND ≥14 days since weeded; MEDIUM if ≥10 days; else LOW

#### Rule 6: No-Watering (Rain Forecast)
- **Trigger**: 24h precip ≥8mm AND prob ≥70%, OR 48h precip ≥15mm AND prob ≥70%
- **Effect**: Suppresses watering suggestions for same planters

#### Rule 7: Frost Protection
- **Trigger**: 48-hour min temp forecast ≤2°C
- **Filter**: Plant frostSensitive=true or frostHardy=false
- **Priority**: Always HIGH
- **Scope**: Planter-level (one suggestion per planter)

#### Rule 8: Treatment Follow-up
- **Trigger**: Unresolved pest note (pest event without subsequent treatment)
- **Priority**: HIGH if pest ≤1 day old OR healthState in [damaged, diseased]; MEDIUM if ≤4 days; else LOW
- **Scope**: Plant-level

### 6.3 AI Enhancement Layer
- Receives rules output + full garden context (plants, weather, events, adjacency)
- **Allowed types**: Only generates types the rules engine doesn't own
- **Confidence gate**: Rejects AI suggestions with confidence < 0.4
- **Fuzzy plant matching**: Maps AI-returned plant name to local database
- **Rate limit**: 3 requests per 10 minutes
- **Context includes**: Köppen zone, hemisphere, weather summary (7 days), placed plants with adjacency, seedlings, recent events (14 days), active rule suggestion keys

### 6.4 Deduplication and Aggregation
- **Dedup key**: `${type}:${scope}:${planterId|areaId}:${instanceId}:${plantName}`
- **Rules win**: Rules suggestions take precedence over AI for same dedup key
- **Aggregation** (2 passes):
  1. Plant-level → Planter-level: When ≥2 plants in same planter have same suggestion type
  2. Planter-level → Area-level: When ≥2 planters in same area have same suggestion type
- **Description template**: "Water 3 planters" (built from i18n keys)
- **Sorting**: HIGH → MEDIUM → LOW, then by dueDate
- **Cap**: Maximum 7 suggestions displayed

### 6.5 Caching
- **Cache key**: `ai-sug-v${version}-${djb2(contextHash)}` (locale-partitioned)
- **Per-type TTL**:
  - Fast (6h): frost_protect, pest_alert, disease_risk
  - Medium (24h): harden_seedlings, thin_seedlings, harvest, companion_conflict
  - Slow (72h): succession_sow, mulch, end_of_season, prune, repot
- **Batch TTL**: Shortest TTL among all types in batch
- **Background refresh**: `needsBackgroundRefresh` flag at 60% of TTL window
- **Locale invalidation**: Rejects cache if stored locale ≠ requested locale

### 6.6 Refresh Schedule
- On mount (after DB load)
- Debounced 2 seconds when areas/seedlings change
- Background refresh every 15 minutes
- Settings change (lat/lng, AI provider, locale, aiModel)
- Manual `refresh()` call

### 6.7 Suggestion Completion
- Check button (✓) on each suggestion in EventsBar
- Creates corresponding garden event (see Feature 4: suggestion → event mapping)
- Suggestion removed from display after completion

### 6.8 Display
- Priority badge: high (red), medium (orange), low (blue)
- Source mode badge: AI+Weather, Rules+Weather, Rules, Static
- Plant icon + name
- Location (area or planter)
- Due date and expiry
- Treatment options button (for pest_alert suggestions)

---

## Persistence
- Suggestions themselves are **not persisted** — regenerated on refresh
- AI suggestion cache stored in Dexie `aiSuggestionsCache` table with TTL metadata
- Cache indexed by `id`, `createdAt`, `expiresAt`, `locale`, `model`
- Cache version tracking: `CACHE_VERSION` constant in suggestionsCache.ts
