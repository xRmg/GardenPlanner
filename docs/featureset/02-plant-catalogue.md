# Feature 2: Plant Catalogue

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

The Plant Catalogue is the knowledge base of the application. It combines a set of 10 bundled plant species with user-created custom plants. Each plant entry stores comprehensive growing metadata — sowing windows, harvest timing, spacing, companion/antagonist relationships, frost tolerance, and more. The catalogue powers plant placement, the suggestion engine, and the calendar view.

---

## Components

| Component | File | Role |
|-----------|------|------|
| Plant Catalogue Tab | `app/App.tsx` (Plants tab) | Browse, search, filter, manage plants |
| Plant Definition Dialog | `app/components/PlantDefinitionDialog.tsx` (exports `PlantDialog`) | Create/edit plant entries |
| Plant Picker Dialog | `app/components/PlantPickerDialog.tsx` | Search and select a plant |
| Plant Catalog Hook | `app/hooks/usePlantCatalog.ts` | Inventory, search, stock management |
| Bundled Plants | `app/data/bundledPlants.ts` | 10 pre-loaded plant definitions |

---

## Data Model

### Plant
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string (1–80 chars) | Display name |
| `latinName` | string (optional) | Botanical name (e.g., "Solanum lycopersicum") |
| `color` | string | Hex color for UI display |
| `icon` | string | Emoji icon (e.g., "🍅") |
| `description` | string (optional) | Plant overview |
| `variety` | string (optional, max 80 chars) | Cultivar name |
| `daysToHarvest` | number (optional) | Days from planting to harvest |
| `daysToFlower` | number (optional) | Days to flowering stage |
| `daysToFruit` | number (optional) | Days to fruiting stage |
| `isSeed` | boolean (default: false) | Seed stock vs. transplant |
| `amount` | number ≥0 (optional) | Stock count (null = infinite) |
| `spacingCm` | number (optional) | Plant spacing in centimeters |
| `frostHardy` | boolean (optional) | Survives frost |
| `frostSensitive` | boolean (optional) | Killed by frost |
| `watering` | string (optional) | Watering care instructions |
| `growingTips` | string (optional, max 500 chars) | Growing advice |
| `companions` | string[] | Compatible plant references (canonical slugs) |
| `antagonists` | string[] | Incompatible plant references |
| `sowIndoorMonths` | number[] | 1-indexed months for indoor sowing |
| `sowDirectMonths` | number[] | 1-indexed months for direct sowing |
| `harvestMonths` | number[] | 1-indexed months for harvest |
| `sunRequirement` | "full" \| "partial" \| "shade" (optional) | Light needs |
| `source` | "bundled" \| "synced" \| "custom" | Origin of plant data |
| `localizedContent` | object (optional) | Per-locale overrides for description, watering, growingTips |

---

## Sub-Features

### 2.1 Bundled Plant Library

10 pre-loaded plants available to all users:

| Plant | Icon | Color | Days to Harvest | Frost Hardy | Sow Indoor | Sow Direct | Harvest | Sun |
|-------|------|-------|-----------------|-------------|------------|------------|---------|-----|
| Tomato | 🍅 | #ef4444 | 75 | No | Feb–Apr | May | Jul–Sep | Full |
| Carrot | 🥕 | #f97316 | 70 | Yes | — | Mar–Jul | Jun–Oct | Full |
| Lettuce | 🥬 | #84cc16 | 45 | Yes | Feb–Mar | Mar–May, Aug–Sep | May–Jul, Sep–Oct | Partial |
| Pepper | 🌶️ | #22c55e | 80 | No | Feb–Apr | — | Jul–Sep | Full |
| Broccoli | 🥦 | #16a34a | 70 | Yes | Feb–Mar, Jul | Apr, Aug | Jun–Jul, Sep–Oct | Full |
| Cucumber | 🥒 | #10b981 | 60 | No | Apr | May–Jun | Jul–Sep | Full |
| Corn | 🌽 | #f59e0b | 90 | No | — | Apr–Jun | Aug–Sep | Full |
| Pumpkin | 🎃 | #fb923c | 110 | No | Apr | May–Jun | Sep–Oct | Full |
| Eggplant | 🍆 | #8b5cf6 | 80 | No | Feb–Mar | — | Jul–Sep | Full |
| Radish | 🌱 | #ec4899 | 28 | Yes | — | Mar–May, Aug–Sep | Apr–May, Sep–Oct | Full |

Bundled plants are **read-only** — users cannot edit or delete them. They can serve as a starting point for the "Sow This Month" feature.

Helper function `getBundledPlantByMatch()` provides case-insensitive, whitespace-tolerant lookup by ID or name.

### 2.2 Custom Plant Management
- **Add plant**: Opens PlantDefinitionDialog with empty form
- **Add seed**: Opens PlantDefinitionDialog with `isSeed = true` pre-set
- **Edit custom plant**: Opens PlantDefinitionDialog pre-filled with existing data
- **Delete custom plant**: Removes from catalogue (doesn't remove already-placed instances)
- **Source tracking**: Custom plants are marked `source: "custom"`

### 2.3 Plant Definition Form (PlantDialog component)
Fields grouped into sections:
- **Basic info**: Name (required), latin name, variety, icon selector (24 preset emojis), color picker (11 preset colors)
- **Growing parameters**: Days to harvest, frost hardy toggle, spacing (cm), watering notes, growing tips
- **Seed management**: Is Seed toggle, amount (quantity or "Infinite" checkbox)
- **Sowing windows**: Month checkboxes (1–12) for Indoor, Direct, and Harvest windows
- **Relationships**: Companion plants (comma-separated text), antagonist plants (comma-separated text)
- **Light requirements**: Full sun / Partial shade / Shade radio buttons
- **Description**: Free-text field (localized per language)
- **AI lookup**: "Ask AI ✨" button (conditional on AI provider being configured) — fills form fields with AI-generated data

### 2.4 Plant Search and Filtering
- **Search input**: Matches against plant name, display name, ID, variety, latin name (case-insensitive substring)
- **Filter tabs**: All / Plants / Seeds — each shows a live count
- **Plant Picker Dialog**: Modal for selecting a plant, with mode filter ("transplant" for non-seeds, "direct-sow" for seeds only)

### 2.5 Sow This Month Section
- **Featured display**: Large cards (3-column grid) for plants/seeds that can be sown this month (indoor or direct)
- **Badges**: "INDOORS NOW" (blue) for indoor sow window, "DIRECT NOW" (emerald) for direct sow window
- **Per-card info**: Icon, name, variety, days to harvest, spacing, stock count
- **Action buttons**: Sow Seeds (if seed with stock > 0), Edit (if custom), Delete (if custom)

### 2.6 Seed Stock Tracking
- **Amount field**: Tracks available seed count
- **Infinite option**: Checkbox for unlimited stock (amount = null in data)
- **Used count**: Calculated from placed plant instances across all planters
- **Available stock**: amount − used (or Infinity if unlimited)
- **Low stock warning**: Red indicator when < 5 seeds remaining
- **Depleted state**: Disabled/grayed plant button when stock = 0

### 2.7 Plant Name Normalization
- **Canonical slug format**: lowercase, hyphen-delimited (e.g., "sweet-pepper", "spring-onion")
- **Aliases**: zucchini↔courgette, bell pepper↔pepper, cilantro↔coriander, arugula↔rocket, eggplant↔aubergine, chili↔chilli, scallion↔spring onion
- **Functions**: `normalizePlantName()`, `normalizePlantReference()`, `humanizePlantReference()`

---

## Persistence
- Custom plants stored in Dexie `customPlants` table, indexed by `id` and `source`
- Bundled plants are not persisted — loaded from `bundledPlants.ts` at runtime
- All reads validated via Zod `safeParse()` — corrupt entries are dropped with logging
- Plant companion/antagonist references normalized to canonical slug form (Dexie v9 migration)
