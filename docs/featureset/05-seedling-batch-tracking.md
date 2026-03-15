# Feature 5: Seedling Batch Tracking

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

Seedling Batch Tracking manages the lifecycle of seeds started indoors (or direct-sown) before they are planted out into the garden grid. Users create batches, track them through germination stages, and eventually transplant ready seedlings into planters. This bridges the gap between the plant catalogue (available seeds) and the garden grid (planted instances).

---

## Components

| Component | File | Role |
|-----------|------|------|
| Seedlings Tab | `app/App.tsx` (Seedlings tab) | Browse and manage seedling batches |
| Add Seedling Dialog | `app/components/AddSeedlingDialog.tsx` | Create a new seedling batch |
| Sow Seeds Dialog | `app/components/SowSeedsDialog.tsx` | Sow seeds from catalogue |
| Seedling Manager Hook | `app/hooks/useSeedlingManager.ts` | Seedling CRUD and lifecycle |

---

## Data Model

### Seedling
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `plant` | Plant | The species being grown (full nested object) |
| `plantedDate` | ISO 8601 datetime | When seeds were sown |
| `seedCount` | integer (>0) | Number of seeds in batch |
| `location` | string (max 200 chars) | Where stored ("Indoor Tray", "Greenhouse", etc.) |
| `method` | "indoor" \| "direct-sow" (optional) | Sowing method |
| `status` | enum | Current lifecycle stage |

### Seedling Status Lifecycle
```
germinating → growing → hardening → ready
```

| Status | Meaning | Transition Action |
|--------|---------|-------------------|
| `germinating` | Seeds sown, awaiting emergence | "Sprouted" button → growing |
| `growing` | Seedlings emerged, developing | "Harden Off" button → hardening |
| `hardening` | Gradually introducing to outdoor conditions | "Mark Ready" button → ready |
| `ready` | Ready for transplant to garden | "Use Batch" button → plant in grid |

---

## Sub-Features

### 5.1 Sow Seeds from Catalogue
- Triggered from: PlantPickerDialog "Sow Seeds" button, or Plant Catalogue "Sow Seeds" action
- **SowSeedsDialog** workflow:
  - Displays plant icon, name, variety
  - Number input: seeds to sow (1 to available amount)
  - Location input (default: "Indoor Tray", customizable)
  - Confirmation info box: "You're sowing X seeds of [Plant]"
- On sow:
  - Creates new Seedling batch with status "germinating"
  - Decrements plant `amount` by seed count
  - Logs a "sown" garden event

### 5.2 Add Seedling Batch (Direct)
- **AddSeedlingDialog** workflow:
  - Plant selection from catalogue (grid of plant buttons with search)
  - Sowing method radio: Indoor Start / Direct Sow (auto-updates location)
  - Seed count input
  - Location text input (auto-set by method)
  - Planted date (date picker, defaults to today)
  - Status: always "germinating" on creation

### 5.3 Seedling Lifecycle Transitions
Each batch has a single status button that advances it to the next stage:
- **germinating → growing**: "Sprouted" button (logs "sprouted" event)
- **growing → hardening**: "Harden Off" button
- **hardening → ready**: "Mark Ready" button

### 5.4 Plant from Batch
When a seedling batch reaches "ready" status:
- "Use Batch" button available on the batch card
- Transitions the seedling into the garden placement flow
- The ready batch can be used alongside the normal plant placement toolbar

### 5.5 Seedling Display
**Grouped by status (tab layout)**:
1. **Ready** (featured): Large 3-column cards with icon, name, days old, batch count, "Use Batch" button
2. **Hardening / Growing / Germinating** (compact): Horizontal list items with icon, name, metadata ("Xd · Yx · Location"), status transition button, delete button

**Toolbar badge**: Seedling count badge in toolbar for quick access to seedlings tab

### 5.6 Delete Batch
- Remove button on each seedling batch
- Deletes batch without restoring seed stock (seeds are consumed at sow time)
- No confirmation dialog — immediate deletion

---

## Persistence
- Seedlings stored in Dexie `seedlings` table, indexed by `id`
- All mutations go through `GardenRepository.saveSeedling()` / `deleteSeedling()`
- Included in server sync payload via `POST /api/garden/sync`
- Plant field stored as full nested object (not a reference ID)
