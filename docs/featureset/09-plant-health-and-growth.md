# Feature 9: Plant Health & Growth Tracking

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

Plant Health & Growth Tracking provides per-plant-instance monitoring of growth progress and health conditions. Growth stages are auto-derived from planting date and plant metadata, while health states and pest/treatment events are manually logged. This data feeds into the suggestion engine and AI treatment recommendations.

---

## Components

| Component | File | Role |
|-----------|------|------|
| Plant Details Dialog | `app/components/PlantDetailsDialog.tsx` | View/edit growth, health, pest log |
| Treatment Options Dialog | `app/components/TreatmentOptionsDialog.tsx` | AI-generated treatment recommendations |
| Growth Stage Service | `app/services/plantGrowthStage.ts` | Auto-derive growth from planting date |

---

## Data Model

### Growth Stages
| Stage | Timing (from planting) | Description |
|-------|----------------------|-------------|
| `sprouting` | 0–14 days | Initial emergence |
| `vegetative` | 15+ days | Active leaf/stem growth |
| `flowering` | daysToFlower+ | Producing flowers |
| `fruiting` | daysToFruit+ | Setting fruit |
| `dormant` | daysToHarvest + 30 | Past harvest window, stale |

### Health States
| State | Description |
|-------|-------------|
| `healthy` | Normal condition |
| `stressed` | Showing signs of stress (wilting, yellowing) |
| `damaged` | Physical damage (wind, hail, accidental) |
| `diseased` | Active disease symptoms |
| `dead` | Plant has died |

### PestEvent
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `date` | ISO 8601 datetime | When observed/applied |
| `type` | "pest" \| "treatment" | Observation or intervention |
| `description` | string (max 500 chars) | Details of observation or treatment |

---

## Sub-Features

### 9.1 Automatic Growth Stage Derivation
Algorithm in `deriveGrowthStage(instance, today)`:
```
0–14 days after planting     → "sprouting"
15+ days                     → "vegetative"
daysToFlower+ days           → "flowering"
daysToFruit+ days            → "fruiting"
daysToHarvest + 30 days      → "dormant" (stale)
No planting date             → null (unknown)
```

**Fallback logic**:
- If `daysToFruit` not set: skip flowering stage, jump to fruiting at `daysToHarvest - 14`
- If `daysToFlower` set but `daysToFruit` not: flowering continues until harvest or indefinitely

`getEffectiveGrowthStage()` respects the `growthStageOverride` flag — if set, returns the user's manually chosen stage instead of the derived one.

### 9.2 Manual Growth Stage Override
- PlantDetailsDialog provides growth stage selector (dropdown)
- Override toggle: user can mark the stage as manually overridden
- When override is active, auto-derivation is ignored for that instance
- Override persists until explicitly cleared

### 9.3 Health State Tracking
- Health state selector in PlantDetailsDialog
- States: healthy, stressed, damaged, diseased, dead
- Health state changes logged as garden events
- Health state affects suggestion engine:
  - Dormant/dead plants suppress watering suggestions
  - Damaged/diseased plants trigger higher-priority treatment follow-up

### 9.4 Pest & Treatment Event Log
- Chronological list in PlantDetailsDialog
- Per-event display: type badge ("pest" / "treatment"), date, description, delete button
- Add new event: type selector, description textarea (max 500 chars), add button
- Events stored per-instance in `plantInstance.pestEvents[]`
- Also logged as garden-level events for journal/calendar display

### 9.5 Treatment Options Dialog
- Triggered by pest_alert suggestion or manual action
- **Context display**: Plant name/icon, variety, latest pest event, last treatment, location
- **AI-generated options** (when AI is configured):
  - Up to 3 treatment recommendations
  - Each option includes: title, summary, method type, full description, pros, cons
  - Method types (ordered by preference):
    1. **biological** (emerald badge)
    2. **mechanical** (sky badge)
    3. **cultural** (amber badge)
    4. **monitor** (slate badge)
    5. **synthetic** (rose badge)
  - Loading state with spinner, error handling with retry
  - AI request can be aborted
- **Custom note entry**: Textarea for manual treatment notes (≤180 chars)
- Selected treatment logs a "treatment" event with the chosen description

---

## Integration with Other Features
- **Suggestion engine**: Growth stage affects suggestion context; health state affects priority; unresolved pest events trigger treatment follow-up rule
- **Calendar view**: Pest and treatment events displayed on calendar
- **Events bar**: Pest and treatment events appear in activity journal
- **AI suggestions**: Pest log included in AI context for companion_conflict and disease_risk suggestions
