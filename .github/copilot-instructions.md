# Copilot Instructions for Garden Planner

## Project Overview

Garden Planner is a client-side React + TypeScript single-page application for planning and managing a home garden. Users can:
- Define plant species/varieties in a catalogue (with companion planting data, sowing windows, etc.)
- Create **Areas** containing one or more **Planters** (raised beds, containers, rows)
- Place plants in a grid-based planter layout
- Log garden events (planted, watered, harvested, etc.)
- Track seedling batches germinated indoors
- Receive care suggestions based on garden state

All data is currently stored in `localStorage` via the repository layer. The app is designed to be self-hosted with no mandatory backend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 5.7 |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| UI components | Radix UI primitives + shadcn/ui (see `components.json`) |
| Icons | Lucide React |
| Schema & validation | Zod |
| Forms | react-hook-form + `@hookform/resolvers/zod` |

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
│       ├── schema.ts            # Zod schemas + inferred TypeScript types (single source of truth)
│       ├── repository.ts        # Abstract repository interface
│       └── localStorageRepository.ts  # localStorage implementation of repository
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

There is no test runner configured yet. Linting uses ESLint (config in `eslint.config.js`).

---

## Architecture Patterns

### State Management
Top-level state lives in `App.tsx` using `useState`/`useEffect`. State is passed down as props to dialogs and components. There is no global state library (no Redux, Zustand, etc.).

### Repository Pattern
Data access goes through the repository interface (`app/data/repository.ts`). The current implementation is `localStorageRepository.ts`. When adding new persistence logic, add methods to the interface and implement them in the localStorage class.

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

## Planned Features (see `docs/` and `todo.md`)

- **AI plant lookup** — OpenRouter integration (primary: `google/gemini-2.0-flash`) to auto-fill plant data from a name; see `docs/ai-integration-design.md`
- **i18n** — react-i18next with namespace support (`ui`, `plants`, `calendar`, `errors`); see `docs/i18n-and-plant-library-architecture.md`
- **Shared plant library** — community-curated plant catalogue with sync and local overrides

---

## Code Style

- Use TypeScript strictly — avoid `any`; use types inferred from Zod schemas
- Prefer named exports over default exports for components
- Keep components focused; extract sub-components when a component exceeds ~200 lines
- Format dates as ISO 8601 strings with timezone offset (matching Zod `.datetime({ offset: true })`)
- Use `crypto.randomUUID()` for generating new entity IDs
