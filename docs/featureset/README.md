# Garden Planner — Feature Set Documentation

> Comprehensive inventory of all features currently implemented in the Garden Planner application.
> Generated from codebase analysis on 2026-03-15. Codebase is the source of truth.

---

## Purpose

This document provides a high-level overview of every feature currently active in the Garden Planner application. Each feature section explains **what it does** and **why it exists**, with links to detailed sub-documents for implementation specifics.

Use this documentation to:
- Understand the full scope of the application
- Identify features that may be outdated, redundant, or candidates for removal
- Onboard new contributors with a clear feature map
- Plan future work with awareness of existing capabilities

---

## Feature Overview

| # | Feature | Status | Why It Exists | Details |
|---|---------|--------|---------------|---------|
| 1 | [Garden Layout Management](#1-garden-layout-management) | Active | Users need to model their physical garden — areas, beds, and containers — to plan plantings spatially | [Detail](./01-garden-layout-management.md) |
| 2 | [Plant Catalogue](#2-plant-catalogue) | Active | Users need a searchable library of plants with growing data to make informed planting decisions | [Detail](./02-plant-catalogue.md) |
| 3 | [Plant Placement & Grid Interaction](#3-plant-placement--grid-interaction) | Active | Users need to visually place and manage plants within their planters to plan layouts | [Detail](./03-plant-placement-and-grid.md) |
| 4 | [Garden Event Logging](#4-garden-event-logging) | Active | Users need to record gardening activities to track care history and inform smart suggestions | [Detail](./04-garden-event-logging.md) |
| 5 | [Seedling Batch Tracking](#5-seedling-batch-tracking) | Active | Users starting seeds indoors need to track batches through germination to transplant-readiness | [Detail](./05-seedling-batch-tracking.md) |
| 6 | [Smart Suggestions Engine](#6-smart-suggestions-engine) | Active | Users benefit from automated, context-aware care reminders instead of guessing when to water, sow, or harvest | [Detail](./06-smart-suggestions-engine.md) |
| 7 | [Weather Integration](#7-weather-integration) | Active | Weather data makes care suggestions accurate — watering after rain is wasteful, frost alerts save crops | [Detail](./07-weather-integration.md) |
| 8 | [Calendar View](#8-calendar-view) | Active | Users need a temporal view of their garden — past events, upcoming tasks, and harvest windows on a timeline | [Detail](./08-calendar-view.md) |
| 9 | [Plant Health & Growth Tracking](#9-plant-health--growth-tracking) | Active | Users need to monitor individual plant progress and health to catch issues early and plan harvests | [Detail](./09-plant-health-and-growth.md) |
| 10 | [AI Integration](#10-ai-integration) | Active | AI augments the user's knowledge — filling plant data, generating treatment plans, and enhancing suggestions | [Detail](./10-ai-integration.md) |
| 11 | [Settings & User Preferences](#11-settings--user-preferences) | Active | Users need to configure their location, climate, language, and measurement units for a personalized experience | [Detail](./11-settings-and-preferences.md) |
| 12 | [Internationalization (i18n)](#12-internationalization) | Active | Users in non-English-speaking regions need the application in their own language | [Detail](./12-internationalization.md) |
| 13 | [Data Persistence & Sync](#13-data-persistence--sync) | Active | All garden data must survive page reloads; optional server sync enables multi-device access and backup | [Detail](./13-data-persistence-and-sync.md) |
| 14 | [Deployment & Infrastructure](#14-deployment--infrastructure) | Active | The application needs a reliable, self-hostable deployment model with backend API support | [Detail](./14-deployment-and-infrastructure.md) |

---

## 1. Garden Layout Management

**What**: Users create named **Areas** (garden zones like "Backyard" or "Balcony") containing one or more **Planters** (raised beds, containers, rows). Each planter is a configurable grid with customizable dimensions, colors, virtual sections, and layout types.

**Why**: A garden is a physical space. Users need a digital model of their garden's structure to plan what goes where. Without spatial organization, plant placement is just a list — the grid layout enables companion planting analysis, spacing validation, and visual planning.

**Key capabilities**:
- Create, rename, reorder, and delete areas
- Add planters with configurable grid dimensions (rows × columns, 1–20 each)
- Set physical cell dimensions (metric or imperial presets, or custom)
- Choose planter layout type: grid beds or pot containers
- Customize planter and area appearance (background colors)
- Define virtual sections within planters (named row/column bands with colors)
- Area-level and planter-level quick actions (water all, fertilize all, weed all)
- Edit mode vs. view mode toggle

[Detailed documentation →](./01-garden-layout-management.md)

---

## 2. Plant Catalogue

**What**: A searchable library of plant species/varieties with comprehensive growing metadata. Ships with 10 bundled plants and supports unlimited user-added custom plants. Optional AI-powered data lookup fills in plant details automatically.

**Why**: Users need reliable growing data — sowing windows, harvest timing, spacing, companion relationships — to make good planting decisions. The catalogue is the knowledge base that powers the entire planning experience.

**Key capabilities**:
- 10 bundled plants with full metadata (Tomato, Carrot, Lettuce, Pepper, Broccoli, Cucumber, Corn, Pumpkin, Eggplant, Radish)
- Add custom plants with comprehensive fields (name, latin name, variety, icon, color, sowing windows, harvest months, companions, antagonists, frost tolerance, sun requirement, spacing, growing tips)
- Track seed stock (amount, infinite option, seed vs. plant distinction)
- Search and filter by name, variety, latin name
- Filter tabs: All / Plants / Seeds with live counts
- "Sow This Month" featured section highlighting timely plantings
- Edit and delete custom plants; bundled plants are read-only
- AI-powered plant data lookup via "Ask AI" button

[Detailed documentation →](./02-plant-catalogue.md)

---

## 3. Plant Placement & Grid Interaction

**What**: Interactive grid where users click to place plants from the catalogue into specific planter cells. Supports plant movement between cells, planters, and areas. Provides context menus for per-plant actions.

**Why**: The core interaction model — users build their garden plan by placing plants on a visual grid. This enables spatial awareness (companion/antagonist proximity), capacity planning, and a tangible view of the garden layout.

**Key capabilities**:
- Click-to-place: select a plant from the toolbar, click a grid cell to plant it
- Plant toolbar with horizontal scrolling, stock badges, low-stock warnings, and depleted states
- Context menu (right-click) on planted cells: view details, move, remove/harvest, log pest event
- Plant movement between cells (drag), between planters, and between areas via MovePlantPicker dialog
- Remove plants with harvest/removal distinction (logs appropriate event type)
- Metaplant grouping: 8-connected same-plant regions treated as groups
- Multi-select harvesting via click-and-drag
- Visual display: plant icon, abbreviated name, planter color, cell dimensions, virtual section overlays

[Detailed documentation →](./03-plant-placement-and-grid.md)

---

## 4. Garden Event Logging

**What**: A chronological journal of all garden activities — planting, watering, composting, weeding, harvesting, pest observations, treatments, and freeform observations. Events are scoped to individual plants, planters, or entire areas.

**Why**: The event log creates a historical record that serves two purposes: (1) users can review what they did and when, and (2) the suggestion engine uses event history to calculate cooldowns, detect overdue care, and personalize recommendations.

**Key capabilities**:
- 11 event types: planted, watered, composted, weeded, harvested, sown, sprouted, removed, pest, treatment, observation
- Three event scopes: plant-specific, planter-wide, area-wide
- Quick-action buttons on planters and areas for common actions (water, compost, weed)
- Events displayed in reverse-chronological sidebar (EventsBar) with color-coded icons
- Location labels (area → planter) on each event
- Optional notes on events (up to 500 characters)
- Events persisted to IndexedDB; synced to server when available
- Suggestion completion automatically creates corresponding events

[Detailed documentation →](./04-garden-event-logging.md)

---

## 5. Seedling Batch Tracking

**What**: Track indoor seed-starting batches through their lifecycle — from sowing through germination, growing, hardening off, and readiness for transplant. Includes sowing method choice (indoor start vs. direct sow) and batch size tracking.

**Why**: Indoor seed starting is a common gardening practice that requires timing and tracking. Users need to know when seedlings were sown, how many survived, when to harden off, and when they're ready to plant out — all coordinated with outdoor conditions.

**Key capabilities**:
- Sow seeds from catalogue (decrements seed stock, creates seedling batch)
- Track batch lifecycle: germinating → growing → hardening → ready
- Record sowing location (indoor tray, greenhouse, cold frame, etc.)
- Track batch size (seed count)
- Status transition buttons at each stage
- "Plant from batch" action to transplant ready seedlings to garden grid
- Seedling count badge in toolbar for quick access
- Grouped display: Ready (featured cards), then Hardening/Growing/Germinating (compact lists)
- Delete batches that fail or are no longer tracked

[Detailed documentation →](./05-seedling-batch-tracking.md)

---

## 6. Smart Suggestions Engine

**What**: A 4-tier degradation system that generates prioritized, actionable care suggestions based on garden state, weather data, and optional AI enhancement. Ranges from AI + weather (richest) to static tips (simplest fallback).

**Why**: New and experienced gardeners alike forget tasks or miss timing windows. Automated, context-aware suggestions remove guesswork — telling users when to water (based on rain and evapotranspiration), when to harvest (based on planting date), and when to protect plants (based on frost forecasts).

**Key capabilities**:
- **8 deterministic rules**: watering, sowing, harvesting, fertilization, weeding, no-watering (rain forecast), frost protection, treatment follow-up
- **10 AI-exclusive suggestion types**: companion conflict, succession sowing, pest alert, disease risk, seedling thinning, seedling hardening, frost protect, end of season, mulch, prune
- Cooldown system prevents duplicate suggestions (7–30 day windows per action type)
- Priority levels: high (red), medium (orange), low (blue)
- Suggestion deduplication and aggregation (plant → planter → area promotion)
- Capped at 7 suggestions maximum to avoid overwhelm
- Source mode badges: AI+Weather, Rules+Weather, Rules, Static
- Mark suggestions as complete (creates corresponding event)
- 15-minute background refresh cycle
- Combined display in EventsBar sidebar and CalendarView

[Detailed documentation →](./06-smart-suggestions-engine.md)

---

## 7. Weather Integration

**What**: Live weather data from Open-Meteo (free, no API key required) providing current conditions, 48-hour hourly forecast, and 7-day daily forecast. Cached for 3 hours in IndexedDB.

**Why**: Weather is the most critical external factor in gardening. Watering suggestions without rain data are guesses. Frost alerts without temperature forecasts are impossible. Weather integration transforms the suggestion engine from calendar-based to condition-based.

**Key capabilities**:
- Current conditions: temperature, humidity, precipitation, weather code
- 48-hour hourly forecast: precipitation probability, evapotranspiration (ET₀)
- 9-day daily forecast (2 past + today + 6 future): max/min temp, precipitation, rain
- 3-hour cache TTL in Dexie (avoids excessive API calls)
- Stale-while-revalidate: serves cached data if fresh fetch fails
- Cache key based on rounded lat/lng (avoids GPS noise churn)
- No API key required (Open-Meteo is free)
- Graceful degradation: suggestions fall back to rules-only mode if weather is unavailable

[Detailed documentation →](./07-weather-integration.md)

---

## 8. Calendar View

**What**: A monthly calendar that overlays garden events, care suggestions, and harvest forecasts onto a day grid. Provides temporal context that the area/planter view cannot — showing when things happened and when things need doing.

**Why**: Gardening is inherently time-based. Users need to see the rhythm of their garden — planting dates, watering frequency, upcoming harvests — at a glance. The calendar turns scattered events and suggestions into a coherent timeline.

**Key capabilities**:
- Monthly grid with navigation (previous/next month)
- Event chips on day cells (color-coded by type with icons)
- Suggestion chips on day cells (color-coded by priority with source badges)
- Harvest forecasting with status indicators: ready (green), upcoming (lime), overdue (amber)
- Sowing window indicators for indoor and direct sowing
- Day-detail view with events and suggestions for a specific date
- Locale-aware month and day formatting
- Responsive layout

[Detailed documentation →](./08-calendar-view.md)

---

## 9. Plant Health & Growth Tracking

**What**: Per-plant-instance tracking of growth stages (sprouting → vegetative → flowering → fruiting → dormant) and health states (healthy, stressed, damaged, diseased, dead). Includes a pest and treatment event log per plant.

**Why**: Individual plant monitoring enables targeted care. A diseased tomato needs different attention than a healthy one. Growth stage tracking enables harvest readiness predictions. Pest/treatment logs create accountability and inform AI suggestions.

**Key capabilities**:
- Automatic growth stage derivation from planting date + days-to-harvest data
- Manual growth stage override when auto-derivation is inaccurate
- Health state tracking per plant instance
- Pest event logging (date, type: pest/treatment, description up to 500 chars)
- Treatment options dialog with AI-generated suggestions (biological, mechanical, cultural, monitor, synthetic methods)
- Pest/treatment history displayed in PlantDetailsDialog
- Growth stage and health state affect suggestion engine behavior
- Health state change logging as garden events

[Detailed documentation →](./09-plant-health-and-growth.md)

---

## 10. AI Integration

**What**: Optional AI capabilities powered by OpenRouter (BYOK — bring your own key). Three AI functions: plant data lookup (auto-fills catalogue entries), treatment plan generation (pest/disease response options), and suggestion enhancement (10 AI-exclusive suggestion types).

**Why**: AI extends the application's knowledge beyond its bundled data. Users can add any plant and get accurate growing data automatically. Pest identification and treatment suggestions leverage broad horticultural knowledge that no static rules engine can match. AI suggestions add nuanced, context-aware advice.

**Key capabilities**:
- **Plant AI Lookup**: "Ask AI ✨" button in PlantDefinitionDialog — fills sowing windows, harvest timing, spacing, companions, frost tolerance, etc. with confidence indicators
- **Treatment Options**: AI-generated treatment plans for pest/disease observations — ranked by method type (biological preferred over synthetic), with pros/cons
- **Suggestion Enhancement**: 10 AI-exclusive suggestion types added to rules engine output
- Server-side API key storage (key never exposed to browser)
- Backend proxy at `/api/ai/chat` (all AI requests routed through server)
- Model fallback chain: Gemini 2.0 Flash → Mistral Small → Llama 3.3 70B
- Client-side rate limiter: 10 requests/minute for plant lookup, 3 requests/10 min for suggestions
- 30-day AI plant data cache (two-tier: in-memory + Dexie)
- AI suggestion cache with per-type TTL (6h for frost/pest, 24h for harvesting, 72h for mulch/prune)
- Confidence scoring with thresholds (0.85 high, 0.7 medium, 0.5 low, 0.3 reject)
- Exponential backoff retry (3 attempts, retryable HTTP statuses)

[Detailed documentation →](./10-ai-integration.md)

---

## 11. Settings & User Preferences

**What**: Configuration panel for location, climate zone, AI provider, language, and measurement units. Location is geocoded via Open-Meteo with automatic Köppen climate zone derivation.

**Why**: Garden planning is location-dependent. Sowing windows, frost dates, and climate assumptions vary dramatically. Users need to set their location and see the application adapt. AI and language preferences make the tool personal.

**Key capabilities**:
- Location input with geocoding verification (city/region/coordinates)
- Automatic Köppen-Geiger climate zone derivation from 10-year historical climate data
- Manual climate zone override (full classification list: Tropical, Arid, Temperate, Continental, Polar)
- OpenRouter API key entry with server-side validation
- AI model selector (default: google/gemini-2.0-flash)
- Language selection (en, nl)
- Unit system selection (metric, imperial) — affects planter dimension defaults
- Verified location display (lat/lng/zone)
- Settings persisted to IndexedDB and synced to server
- Edit mode toggle persisted across sessions

[Detailed documentation →](./11-settings-and-preferences.md)

---

## 12. Internationalization

**What**: Full i18n infrastructure using react-i18next with 4 translation namespaces (ui, plants, calendar, errors). Ships with English and Dutch translations. Plant names, UI labels, dates, and numbers are all locale-aware.

**Why**: The application targets gardeners globally. Dutch was the first additional language to validate the i18n architecture. The infrastructure supports adding new languages with minimal effort (documented process).

**Key capabilities**:
- 2 supported languages: English (en), Dutch (nl)
- 4 translation namespaces: ui, plants, calendar, errors
- ~373 UI translation keys per language
- ~68 plant name translations per language
- Browser language auto-detection on first visit
- Locale-aware date formatting (via Intl.DateTimeFormat)
- Locale-aware month abbreviations (narrow/short)
- Localized plant names with resolution chain: locale bundle → English bundle → AI override → fallback
- Plant name aliases (zucchini↔courgette, eggplant↔aubergine, etc.)
- Localized plant content (description, watering, growing tips) via localizedContent field
- Documented process for adding new languages

[Detailed documentation →](./12-internationalization.md)

---

## 13. Data Persistence & Sync

**What**: Local-first persistence via IndexedDB (Dexie v4) with optional server sync. Includes automatic migration from legacy localStorage format, Zod schema validation on all reads, and multi-table caching (weather, AI plants, AI suggestions, plant name overrides).

**Why**: The application is designed for self-hosting — data must survive without a server. IndexedDB provides robust client-side storage. Server sync adds multi-device access and backup. The migration path ensures existing users don't lose data when the storage layer changes.

**Key capabilities**:
- Primary store: IndexedDB via Dexie v4 (8 tables: areas, customPlants, seedlings, settings, events, aiPlantCache, weatherCache, aiSuggestionsCache, plantNameOverrides)
- Automatic one-time migration from localStorage → Dexie (idempotent, corruption-safe)
- Schema versioning: 12 migration versions with automatic upgrades
- Zod validation on all data reads (safeParse for collections, parseWithDefaults for settings)
- Legacy LocalStorageRepository kept for testing/fallback
- ServerRepository: wraps Dexie locally + syncs mutations to backend via POST /api/garden/sync
- Full-state sync model (not incremental — entire garden state shipped on each sync)
- Graceful degradation: if server unavailable, local Dexie remains authoritative
- Cache tables with TTL: weather (3h), AI plant data (30d), AI suggestions (6h–72h per type)

[Detailed documentation →](./13-data-persistence-and-sync.md)

---

## 14. Deployment & Infrastructure

**What**: Containerized deployment using Docker Compose with an nginx frontend, Express.js backend, and SQLite database. The backend provides API endpoints for settings management, garden data sync, location geocoding, and AI proxy.

**Why**: Self-hosting is a core product value. Docker Compose provides a one-command deployment for users who want their own instance. The nginx reverse proxy handles static asset serving, SPA routing, and API proxying. The backend centralizes sensitive operations (API key storage, geocoding) that cannot safely run in the browser.

**Key capabilities**:
- Two-container architecture: nginx (frontend) + Node.js/Express (backend)
- Backend API: health check, settings CRUD, AI key management, location geocoding, garden sync, AI chat proxy
- SQLite database with automatic schema initialization and column migration
- Docker Compose orchestration with health checks and dependency ordering
- nginx: SPA routing, static asset caching (1 year, immutable), gzip compression, API reverse proxy
- 50MB request body limit (backend), 20MB (nginx)
- Graceful shutdown on SIGTERM/SIGINT
- External Docker network support (pangolin) for reverse proxy integration
- Named volume for SQLite persistence across container restarts
- Multi-stage Docker builds for minimal image size

[Detailed documentation →](./14-deployment-and-infrastructure.md)

---

## Cross-Cutting Concerns

These capabilities span multiple features and are not tied to a single feature area:

| Concern | Description | Where |
|---------|-------------|-------|
| Error Handling | Global async error toast system with named error IDs; AppErrorBoundary for render crashes with retry/reload options | `app/lib/asyncErrors.ts`, `app/components/AppErrorBoundary.tsx` |
| Mobile Responsiveness | Floating action button for events on mobile; bottom sheet overlays; toolbar visibility controls; touch interactions | `App.tsx`, `EventsBar.tsx` |
| Keyboard Navigation | Escape to close dialogs, Enter to confirm, context menus, focus management | All dialog components |
| Abort/Timeout Handling | Composable timeout + abort signal handling for all async operations; AbortError filtering | `app/lib/abortTimeout.ts` |
| Plant Name Normalization | Alias resolution, canonical slug format, reference list deduplication | `app/lib/plantReferences.ts` |
| Image Fallback | Utility component for graceful image loading failure (SVG placeholder) | `app/components/figma/ImageWithFallback.tsx` |

---

## Review Notes

### Not Implemented (Despite Roadmap References)

| Feature | Roadmap Status | Codebase Status | Notes |
|---------|---------------|-----------------|-------|
| JSON Export/Import | Listed as completed in `todo.md` | **Not found in codebase** | No user-facing export/import functionality exists. No download triggers, file dialogs, or JSON serialization for user data export. |

### Dead Code Candidates

These files exist in the repository but are **not referenced** by the active application:

| File | Purpose | Recommendation |
|------|---------|----------------|
| `index-static.html` | Pre-React HTML prototype | Safe to remove |
| `style.css` | Prototype stylesheet | Safe to remove |
| `script.js` | Prototype JavaScript | Safe to remove |
| `figma-prompts.md` | Design notes for Figma integration | Review — design artifact, not runtime code |

### Deprecated Data Fields

| Entity | Field | Status | Notes |
|--------|-------|--------|-------|
| GardenEvent | `gardenId` | Deprecated | Replaced by `scope` + `areaId` (Dexie v11 migration). Kept for backward compatibility. |
