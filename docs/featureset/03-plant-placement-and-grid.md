# Feature 3: Plant Placement & Grid Interaction

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

The grid is the core interaction surface. Users place plants from their catalogue into specific cells of a planter grid, building a visual representation of their physical garden. The grid supports click-to-place, drag-to-move, context menus, and multi-select operations. Plants placed in the grid become **PlantInstances** — trackable entities with planting dates, health states, and event histories.

---

## Components

| Component | File | Role |
|-----------|------|------|
| Planter Grid | `app/components/PlanterGrid.tsx` | Interactive grid rendering and interaction |
| Plant Toolbar | `app/components/ToolBar.tsx` | Plant selection for placement |
| Move Plant Picker | `app/components/MovePlantPicker.tsx` | Cross-planter/area movement dialog |
| Removal Confirm Dialog | `app/components/RemovalConfirmDialog.tsx` | Harvest vs. remove choice |
| Plant Movement Service | `app/services/plantMovement.ts` | Cross-location plant swapping logic |
| Garden State Service | `app/services/gardenState.ts` | Adjacency maps, placed plant extraction |

---

## Data Model

### PlantInstance
| Field | Type | Description |
|-------|------|-------------|
| `instanceId` | string | Unique per-planter identifier |
| `plant` | Plant | Full nested plant definition |
| `plantingDate` | ISO 8601 datetime (optional) | When planted in grid |
| `harvestDate` | ISO 8601 datetime (optional) | When harvested |
| `variety` | string (optional, max 80 chars) | Specific cultivar |
| `pestEvents` | PestEvent[] | Pest/treatment log |
| `growthStage` | enum (nullable) | sprouting, vegetative, flowering, fruiting, dormant |
| `growthStageOverride` | boolean | User-forced stage vs. auto-derived |
| `healthState` | enum (nullable) | healthy, stressed, damaged, diseased, dead |

### PlanterSquare
| Field | Type | Description |
|-------|------|-------------|
| `plantInstance` | PlantInstance \| null | Occupant or empty |

---

## Sub-Features

### 3.1 Plant Selection Toolbar
- **Filter tabs**: "All", "Plants", "Seeds" with live counts
- **Horizontal scrolling**: Left/right scroll arrows for large catalogues
- **Plant buttons display**: Emoji icon, plant name, seed count badge (blue), low stock warning (red when < 5)
- **Depleted state**: Disabled, grayed-out plant button when stock = 0
- **Hover tooltip**: Full name + availability info
- **"Add" button**: Quick access to create new plant in catalogue
- **Search**: Filter within current tab by name

### 3.2 Click-to-Place
- Select a plant from the toolbar → click an empty grid cell → plant is placed
- Automatically creates a PlantInstance with:
  - `instanceId`: `crypto.randomUUID()`
  - `plantingDate`: current ISO 8601 datetime
  - `pestEvents`: empty array
  - `growthStage`: null (auto-derived later)
  - `healthState`: null
- Decrements seed stock if plant `isSeed = true`
- Logs a "planted" garden event

### 3.3 Grid Display
- Each cell shows: plant emoji icon + abbreviated name
- Planter header: name, grid dimensions (rows × cols), cell dimensions (e.g., "30cm × 30cm")
- Planter background color applied to grid
- Layout type badge: "Grid" or "Pot Container"
- Virtual section overlays with colored bands and section names
- Pot container layout renders cells as circles instead of squares

### 3.4 Context Menu (Right-Click on Planted Cell)
- **View plant details**: Opens PlantDetailsDialog with growth stage, health state, pest log
- **Move plant**: Opens MovePlantPicker to relocate to another cell/planter/area
- **Remove/harvest**: Opens RemovalConfirmDialog with choice between "Mark Harvested" and "Remove"
- **Log pest event**: Quick pest observation entry

### 3.5 Plant Movement
- **Within planter**: Drag a plant cell to another cell within the same grid
- **Cross-planter/cross-area**: Via MovePlantPicker dialog
  - Source display: current plant info and location (area → planter → row, col)
  - Target selection: dropdown of all planters, row/col selectors
  - Swap preview: shows what plant (if any) occupies the target cell
  - Confirm performs a swap (both plants exchange positions)
- **Movement service** (`plantMovement.ts`): `movePlantBetweenLocations(areas, source, target)` — handles bounds checking and instance swapping
- Mobile: Dialog layout; uses Sheet instead of Dialog on small screens

### 3.6 Removal and Harvesting
- **RemovalConfirmDialog**: Two options when removing a plant
  - "Mark Harvested": Logs a "harvested" event (plant was ready, user collected)
  - "Remove": Logs a "removed" event (early removal, failed plant, cleanup)
- Cell is cleared after either action

### 3.7 Metaplant Grouping
- **8-connected adjacency**: Same-plant cells touching horizontally, vertically, or diagonally are grouped
- **Group operations**: Multi-select harvesting via click-and-drag across group members
- **Group size display**: Shown in PlantDetailsDialog

### 3.8 Quick Actions (View Mode)
Per-planter quick action buttons available in view mode:
- **Watered** (💧): Logs "watered" event scoped to planter
- **Composted/Fertilised** (📦): Logs "composted" event
- **Weeded** (✂️): Logs "weeded" event
- **Observation** (📅): Logs "observation" event with optional text note

### 3.9 Adjacency Analysis
- `buildAdjacentPlants()`: 4-directional neighborhood analysis (up/down/left/right)
- `buildPlacedPlants()`: Extracts flat list of all placed instances with adjacent plant refs
- `buildPlantLocationLookup()`: Reverse index from instanceId → location in grid
- Used by suggestion engine for companion/antagonist conflict detection

---

## Persistence
- Plant instances are stored as nested data within `Planter.squares` → `Area.planters` → Dexie `areas` table
- Every grid mutation triggers `GardenRepository.saveArea(area)` to persist the updated area
- Plant placement/removal also triggers event logging via `useGardenEvents`
