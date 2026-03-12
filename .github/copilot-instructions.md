# Copilot Instructions for Garden Planner

## Project Overview

Garden Planner is a client-side React + TypeScript single-page application for planning and managing a home garden. Users can:
- Define plant species/varieties in a catalogue (with companion planting data, sowing windows, etc.)
- Create **Areas** containing one or more **Planters** (raised beds, containers, rows)
- Place plants in a grid-based planter layout
- Log garden events (planted, watered, harvested, etc.)
- Track seedling batches germinated indoors
- Receive care suggestions based on garden state

All data is stored in **IndexedDB via Dexie v4**, accessed through the `GardenRepository` interface. On first load the app auto-migrates any existing `localStorage` data. The app is designed to be self-hosted with no mandatory backend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 5.7 |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| UI components | Radix UI primitives + shadcn/ui (see `components.json`) |
| Icons | Lucide React |
| Schema & validation | Zod v4 |
| Forms | react-hook-form + `@hookform/resolvers/zod` |
| Persistence | **Dexie v4** (IndexedDB) — auto-migrates from `localStorage` on first load |
| Testing | **Vitest** — unit tests in `app/data/__tests__/` |

---

## Repository Structure

```
/
├── app/
│   ├── App.tsx                  # Root component — top-level state and orchestration
│   ├── components/              # Feature-level React components
│   │   ├── PlanterGrid.tsx      # Interactive grid for placing plants in a planter
│   │   ├── EventsBar.tsx        # Sidebar for garden events and suggestions
│   │   ├── ToolBar.tsx          # Top navigation and global actions
│   │   ├── PlanterDialog.tsx    # Create/edit a planter (size, virtual sections)
│   │   ├── PlantDefinitionDialog.tsx  # Create/edit a plant in the catalogue
│   │   ├── PlantPickerDialog.tsx      # Search and select a plant
│   │   ├── SowSeedsDialog.tsx         # Log a seed sowing batch
│   │   ├── AddSeedlingDialog.tsx      # Track a seedling tray
│   │   ├── PlantDetailsDialog.tsx     # View plant details
│   │   ├── figma/               # Figma-exported/prototype components (not for production use)
│   │   └── ui/                  # shadcn/ui base components (button, dialog, tabs, etc.)
│   └── data/
│       ├── schema.ts                  # Zod schemas + inferred TypeScript types (single source of truth)
│       ├── repository.ts              # Abstract GardenRepository interface
│       ├── dexieRepository.ts         # Active implementation (IndexedDB via Dexie v4)
│       ├── localStorageRepository.ts  # Legacy bridge implementation (kept for fallback/testing)
│       ├── migration.ts               # One-time auto-migration: localStorage → Dexie
│       └── __tests__/
│           ├── schema.test.ts
│           └── localStorageRepository.test.ts
├── src/
│   └── main.tsx                 # Vite entry point — mounts <App />
├── styles/                      # Global CSS (Tailwind base + custom properties)
├── docs/                        # Architecture design documents
│   ├── ai-integration-design.md      # OpenRouter/AI integration plan
│   └── i18n-and-plant-library-architecture.md  # i18n + shared library plan
├── index.html                   # Vite HTML entry
├── vite.config.ts
├── tsconfig.app.json
└── package.json
```

---

## Data Model

All types live in `app/data/schema.ts` as Zod schemas with inferred TypeScript types. **Do not create separate interface files** — always derive types from schemas.

Key types:
- **`Plant`** — a species/variety in the catalogue (name, icon, color, sowing months, companions, etc.)
- **`PlantInstance`** — a `Plant` placed in a specific grid cell, with planting date and pest log
- **`Planter`** — a raised bed or container (rows × cols grid of `PlanterSquare[][]`)
- **`Area`** — a named garden zone containing multiple planters
- **`Seedling`** — a batch of seeds being germinated indoors
- **`GardenEvent`** — a logged action (planted, watered, harvested…)
- **`Settings`** — user preferences (locale, location, AI provider, growth zone)

Month arrays (e.g. `sowIndoorMonths`, `harvestMonths`) use **1-indexed integers** (1 = January, 12 = December).

---

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:5173 (bound to 0.0.0.0)
npm run build        # TypeScript check + Vite production build → dist/
npm run preview      # Preview production build locally
```

Tests use **Vitest** (`npx vitest run`). Test files live in `app/data/__tests__/`. Linting uses ESLint (config in `eslint.config.js`).

---

## Architecture Patterns

### State Management
Top-level state lives in `App.tsx` using `useState`/`useEffect`. State is passed down as props to dialogs and components. There is no global state library (no Redux, Zustand, etc.).

### Repository Pattern
Data access goes through the `GardenRepository` interface (`app/data/repository.ts`). The active implementation is `DexieRepository` (IndexedDB via Dexie v4). `LocalStorageRepository` is kept as a bridge for testing and fallback. When adding new persistence logic, add methods to the interface and implement them in `dexieRepository.ts`.

On first load, `migration.ts` auto-migrates any existing `localStorage` data into Dexie — safe to call on every startup (idempotent).

### Path Alias
The `@` alias resolves to the project root. Use `@/app/...`, `@/styles/...`, etc. for imports.

### Component Conventions
- Feature dialogs are in `app/components/` and control their own open/close state via props
- shadcn/ui base components live in `app/components/ui/` — do not modify these unless necessary
- Use Tailwind utility classes for all styling; avoid inline styles
- Use Radix UI primitives (via shadcn/ui) for interactive widgets (dialogs, dropdowns, tabs, etc.)

### Zod Usage
- Validate all external/persisted data through the Zod schemas in `schema.ts`
- Use `safeParse` for data that may be missing or corrupt (e.g., loading from localStorage)
- Use `parseWithDefaults` for `Settings` so partial/corrupt data is merged with defaults

---

## Feature Status (see `todo.md` for full roadmap)

**Working now**
- Garden areas, planters, grid-based plant placement — all saved to IndexedDB
- Event logging (planted, watered, harvested, etc.)
- Seedling batch tracking
- Custom plant catalogue (defaults + user additions)
- Settings (location, growth zone, AI provider)

**Immediate next — Phase 1 remaining**
- **State refactoring** ⚠️ BLOCKER — decompose `App.tsx` into custom hooks before starting AI work (task 1.6)
- **JSON export/import** — data portability safety net (task 1.5)
- **AI plant lookup** — OpenRouter BYOK, "Ask AI ✨" in `PlantDefinitionDialog` (tasks 1.7–1.8); see `docs/ai-integration-design.md`
- **Rules engine + weather** — frost alerts, harvest reminders, Open-Meteo (tasks 1.9–1.10)
- **i18n infrastructure** — react-i18next, string extraction (tasks 1.13–1.15); see `docs/i18n-and-plant-library-architecture.md`

**Future phases**
- Shared community plant library (Phase 2 — Hono backend + Cloudflare D1)
- Multi-user / family sharing with per-area roles (Phase 3 — Supabase auth + sync)
- Dutch (nl) translations (Phase 3)

---

## Code Style

- Use TypeScript strictly — avoid `any`; use types inferred from Zod schemas
- Prefer named exports over default exports for components
- Keep components focused; extract sub-components when a component exceeds ~200 lines
- Format dates as ISO 8601 strings with timezone offset (matching Zod `.datetime({ offset: true })`)
- Use `crypto.randomUUID()` for generating new entity IDs
