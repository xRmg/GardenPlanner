# Feature 1: Garden Layout Management

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

Garden Layout Management is the spatial foundation of the application. Users model their physical garden as a hierarchy: **Areas** contain **Planters**, and planters contain a grid of cells where plants are placed. This mirrors real-world garden organization — a backyard with multiple raised beds, a balcony with several containers, etc.

---

## Components

| Component | File | Role |
|-----------|------|------|
| Area Management | `app/App.tsx` (Areas tab) | Area CRUD, reordering, color/tagline editing |
| Planter Grid | `app/components/PlanterGrid.tsx` | Grid rendering, cell interaction, quick actions |
| Planter Dialog | `app/components/PlanterDialog.tsx` | Planter creation and editing form |
| Area Manager Hook | `app/hooks/useAreaManager.ts` | Area/planter state management and persistence |

---

## Data Model

### Area
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (UUID) |
| `name` | string | Display name (e.g., "Backyard", "Balcony") |
| `tagline` | string (optional) | Subtitle or description |
| `backgroundColor` | string (optional) | Hex color for UI accent |
| `planters` | Planter[] | Nested array of planters in this area |
| `profileId` | string | Default: "default" (forward-compatibility) |

### Planter
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `rows` | integer (1–20) | Grid height |
| `cols` | integer (1–20) | Grid width |
| `squares` | PlanterSquare[][] (optional) | 2D array of plant cells |
| `virtualSections` | VirtualSection[] | Named row/column bands |
| `backgroundColor` | string (optional) | Hex color |
| `tagline` | string (optional) | Subtitle |
| `cellDimensions` | CellDimensions (optional) | Physical cell size |
| `layout` | "grid" \| "pot-container" | Render style |

### VirtualSection
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string (1–80 chars) | Section name ("North Side", "May Row") |
| `type` | "rows" \| "columns" | Band orientation |
| `start` | integer (≥1) | 1-based start index (inclusive) |
| `end` | integer (≥1) | 1-based end index (inclusive) |
| `color` | string (optional) | Hex color for highlighting |

### CellDimensions
| Field | Type | Description |
|-------|------|-------------|
| `width` | number | Cell width |
| `depth` | number | Cell depth |
| `unit` | "feet" \| "inches" \| "cm" \| "m" | Measurement unit |

---

## Sub-Features

### 1.1 Area Creation and Management
- **Create area**: "New Area" button (visible in edit mode) creates an area with a default name
- **Edit area**: Inline editing of name, tagline, and background color
- **Delete area**: Red trash button removes area and all contained planters; confirmation required
- **Reorder areas**: Move up/down buttons change display order
- **Area-level quick actions**: In view mode, water/compost/weed all planters in the area at once (logs events for each planter)

### 1.2 Planter Creation and Configuration
- **Add planter**: "+" button within an area creates a new planter
- **Planter name**: Required text input
- **Grid dimensions**: Row and column spinners (1–50 in dialog, constrained to 1–20 in schema)
- **Layout type**: Grid (standard raised bed) or Pot Container (renders cells as circles)
- **Cell dimension presets**: 1 ft × 1 ft (imperial), 30 cm × 30 cm (metric), 25 cm × 25 cm, or custom
- **Background color**: Color picker with palette
- **Virtual sections**: Named sub-regions with start/end ranges and colors; used for organizing larger beds (e.g., "Sunny Side", "Shade Row")

### 1.3 Planter Editing and Deletion
- **Edit planter**: Opens PlanterDialog pre-filled with current configuration
- **Delete planter**: Removes planter and cascades deletion to all linked events
- **Reorder planters**: Move up/down within the area

### 1.4 Edit Mode vs. View Mode
- **View mode** (default): Shows planters read-only with quick-action buttons (water, compost, weed, observation)
- **Edit mode**: Enables plant placement, planter management buttons, area editing; toggled via eye icon button
- **Persisted**: Edit mode state saved to settings and survives page reload

### 1.5 Area-Level Quick Actions (View Mode)
- **Watered**: Logs a "watered" event scoped to each planter in the area
- **Composted/Fertilised**: Logs a "composted" event
- **Weeded**: Logs a "weeded" event
- These actions create individual events per planter for cooldown tracking in the suggestion engine

---

## Validation Rules
- Area name: required, non-empty
- Planter name: required, non-empty
- Grid dimensions: rows and cols between 1 and 20 (schema), dialog allows up to 50
- Virtual section name: required, 1–80 characters
- Virtual section range: start ≤ end, within grid bounds
- Cell dimensions: positive numbers required

---

## Persistence
- Areas (with nested planters) are stored in Dexie `areas` table, indexed by `id` and `profileId`
- Planter `squares` field persists plant placement data within the area record
- All mutations go through `GardenRepository.saveArea()` → upsert by ID
- When a planter is removed, `useAreaManager` cascades event deletion for orphaned planter events
