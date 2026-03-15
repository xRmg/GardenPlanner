# Feature 4: Garden Event Logging

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

The event logging system creates a chronological journal of all garden activities. Every action — planting, watering, harvesting, pest observation — becomes a timestamped event stored in the database. This history serves both the user (review past care) and the system (suggestion engine uses events for cooldowns, overdue detection, and context).

---

## Components

| Component | File | Role |
|-----------|------|------|
| Events Bar | `app/components/EventsBar.tsx` | Sidebar display of event journal |
| Garden Events Hook | `app/hooks/useGardenEvents.ts` | Event creation, mapping, and persistence |
| Calendar View | `app/components/CalendarView.tsx` | Events displayed on calendar |

---

## Data Model

### GardenEvent
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `type` | enum | Event type (see below) |
| `plant` | Plant (optional) | Related plant (for plant-scoped events) |
| `date` | ISO 8601 datetime | When the event occurred |
| `gardenId` | string (optional) | Deprecated; planter ID for planter-wide events |
| `instanceId` | string (optional) | Specific plant instance |
| `note` | string (optional, max 500 chars) | User note |
| `scope` | "plant" \| "planter" \| "area" | What the event targets |
| `areaId` | string (optional) | Area identifier |
| `planterName` | string (optional) | Human-readable planter name |
| `areaName` | string (optional) | Human-readable area name |
| `suggestionType` | SuggestionType (optional) | Original suggestion type if from suggestion completion |
| `suggestionDescription` | string (optional, max 500 chars) | Display text from completed suggestion |
| `suggestionSource` | "rules" \| "ai" \| "static" (optional) | Source of the suggestion |
| `profileId` | string | Default: "default" |

### Event Types (11 total)
| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `planted` | 🌱 | Green | Plant placed in grid |
| `watered` | 💧 | Blue | Watering performed |
| `composted` | 📦 | Amber | Fertilizer/compost applied |
| `weeded` | ✂️ | Orange | Weeding performed |
| `harvested` | 🍃 | Purple | Plant harvested |
| `sown` | 🌱 | Blue | Seeds sown (indoor or direct) |
| `sprouted` | 🌱 | Teal | Seedling status change (germinating → growing) |
| `removed` | 🗑️ | Red | Plant removed (not harvested) |
| `pest` | 🐛 | Red | Pest observation logged |
| `treatment` | ✨ | Emerald | Treatment applied |
| `observation` | 📅 | Teal | Freeform observation note |

---

## Sub-Features

### 4.1 Event Creation Sources
Events are created from multiple interaction points:
- **Plant placement** (click-to-place): automatic "planted" event
- **Plant removal** (context menu → RemovalConfirmDialog): "harvested" or "removed" event
- **Quick actions** (planter/area buttons): "watered", "composted", "weeded" events
- **Observation notes** (quick action with text): "observation" event with note
- **Seedling sowing** (SowSeedsDialog): "sown" event
- **Seedling status transition**: "sprouted" event
- **Pest/treatment logging** (PlantDetailsDialog, TreatmentOptionsDialog): "pest" or "treatment" event
- **Suggestion completion** (EventsBar checkmark): maps suggestion type to event type
- **Health state changes**: logged as events

### 4.2 Suggestion → Event Type Mapping
When a suggestion is completed, it creates an event:
| Suggestion Type | Event Type |
|----------------|------------|
| water | watered |
| harvest | harvested |
| treatment | treatment |
| fertilize / compost / mulch | composted |
| weed | weeded |
| sow / succession_sow | sown |
| pest_alert | pest |

### 4.3 Event Scoping
- **Plant scope** (default): Event relates to a specific plant instance (instanceId set)
- **Planter scope**: Event applies to an entire planter (gardenId/areaId set, no instanceId)
- **Area scope**: Event applies to all planters in an area (areaId set)
- Area-level quick actions create synthetic per-planter scoped events for correct cooldown tracking

### 4.4 Events Bar Display
- **Reverse chronological** listing (newest first)
- Color-coded event type icons
- Event details: date, plant icon + name, event note, scope indicator, location label (area → planter)
- "Load more" pagination
- **Responsive**: Full sidebar on desktop, bottom sheet on mobile (triggered by floating action button)

### 4.5 Events on Calendar
- Events displayed as colored chips on their corresponding day cells
- Click for day-detail view with all events for that date

---

## Persistence
- Events stored in Dexie `events` table, indexed by `id`, `date`, `profileId`
- Retrieved in newest-first order (sorted by date descending)
- Dexie v11 migration backfilled `event.scope` based on presence of `plant` / `gardenId` fields
- Server sync: events included in full garden state sync via `POST /api/garden/sync`
- SQLite backend table mirrors Dexie schema (plant field stored as JSON blob)
