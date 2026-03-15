# Feature 11: Settings & User Preferences

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

The Settings feature provides a configuration panel for personalizing the application to the user's location, climate, language, measurement conventions, and AI preferences. Location is the most critical setting — it drives weather integration, climate zone classification, and seasonal suggestion timing.

---

## Components

| Component | File | Role |
|-----------|------|------|
| Settings Tab | `app/App.tsx` (Settings tab) | Settings UI rendering |
| Location Settings Hook | `app/hooks/useLocationSettings.ts` | Location verification state |
| OpenRouter Settings Hook | `app/hooks/useOpenRouterSettings.ts` | AI key validation state |
| Garden Data Hook | `app/hooks/useGardenData.ts` | Settings persistence and bootstrap |

---

## Data Model

### Settings (Frontend DTO)
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `location` | string | "" | User-provided location (city/region/coordinates) |
| `growthZone` | string | "Cfb" | Köppen-Geiger climate code |
| `aiProvider` | object | `{ type: "none" }` | `{ type: "none" }` or `{ type: "server" }` |
| `aiModel` | string | "google/gemini-2.0-flash" | OpenRouter model ID |
| `locale` | string | "en" | BCP 47 language tag |
| `lat` | number (optional) | — | Latitude from geocoding |
| `lng` | number (optional) | — | Longitude from geocoding |
| `aiLastValidatedAt` | ISO 8601 (optional) | — | Last successful key validation timestamp |
| `aiValidationError` | string (optional) | — | Error from last validation attempt |
| `profileId` | string | "default" | Forward-compatibility for multi-profile |
| `isEditMode` | boolean | false | Area layout edit mode toggle |
| `lastSelectedAreaId` | string (optional) | — | Persisted UI state |
| `lastSelectedPlanterId` | string (optional) | — | Persisted UI state |
| `unitSystem` | "imperial" \| "metric" (optional) | — | Measurement unit preference |

### StoredSettings (Server-Side — includes API key)
Same as Settings, but `aiProvider` may include `{ type: "byok", key: "sk-or-v1-..." }`. Frontend never receives the key — backend redacts it to `{ type: "server" }`.

---

## Sub-Features

### 11.1 Location & Climate Configuration
- **Location input**: Text field accepting city, region, or coordinate formats
- **Verify button**: Triggers backend geocoding via `POST /api/settings/location/resolve`
- **Geocoding process**:
  1. Open-Meteo Geocoding API resolves text → lat/lng
  2. 10-year historical climate data retrieved from Open-Meteo Archive API
  3. Monthly temperature and precipitation means computed
  4. **Köppen-Geiger classification algorithm** run to derive climate zone code
- **Status indicators**: Valid (green checkmark), Invalid (red circle), Loading (spinner)
- **Verified display**: Shows resolved lat/lng and zone after successful verification
- **Fallback**: If climate derivation fails, zone defaults to "Cfb" (temperate oceanic)

### 11.2 Köppen Climate Zone Override
- Dropdown selector grouped by major climate category:
  - **Tropical**: Af, Am, Aw
  - **Arid**: BWh, BWk, BSh, BSk
  - **Temperate**: Csa, Csb, Csc, Cwa, Cwb, Cwc, Cfa, Cfb, Cfc
  - **Continental**: Dsa, Dsb, Dsc, Dsd, Dwa, Dwb, Dwc, Dwd, Dfa, Dfb, Dfc, Dfd
  - **Polar**: ET, EF
- Auto-derived from location but manually overridable for edge cases

### 11.3 AI Provider Configuration
- **API key input**: Password field with show/hide toggle
- **Validate & Save**: Server-side validation against OpenRouter auth endpoint
- **Status display**: Enabled (green badge) / Not configured
- **Last validated timestamp**: Shows when key was last checked
- **Error display**: Shows validation error message if key is invalid
- **Info link**: Direct link to OpenRouter API key page
- **Model selector**: Text input for OpenRouter model ID (default: google/gemini-2.0-flash)

### 11.4 Language Selection
- Dropdown of supported locales (en, nl)
- Changes app language immediately (via i18next)
- Updates `document.lang` attribute
- Persisted to both Dexie settings and `localStorage.gp_locale`
- Invalidates AI suggestion cache for changed locale

### 11.5 Unit System Selection
- Radio/dropdown: "Metric" (cm, m) or "Imperial" (feet, inches)
- **Auto-detection on first visit**: US locale (en-US, en_US) → imperial; all others → metric
- Affects planter cell dimension defaults:
  - Imperial: 1 ft × 1 ft
  - Metric: 30 cm × 30 cm
- Persisted to Dexie settings

### 11.6 UI State Persistence
- `isEditMode`: Survives page reload (view vs. edit mode)
- `lastSelectedAreaId` / `lastSelectedPlanterId`: Scroll restoration on areas tab
- These are settings fields, not separate storage keys

---

## Persistence
- Settings stored as singleton row in Dexie `settings` table (key: "singleton")
- Settings read via `parseWithDefaults()` — corrupt/missing fields merged with schema defaults (never null)
- Server-side: SQLite `settings` table (key: "default"), patched via `PATCH /api/settings`
- AI key stored only on server; never sent to browser
- Locale also stored in `localStorage.gp_locale` for pre-i18next-init language detection

---

## Bootstrap Sequence
1. Dexie `ready()` initializes
2. Settings loaded from Dexie (parseWithDefaults fills gaps)
3. Browser locale detected: `navigator.language.split('-')[0]`
4. If settings locale unset, auto-set from browser locale
5. Unit system bootstrapped from `navigator.language` (US → imperial, else metric)
6. i18next initialized with detected/stored locale
7. If ServerRepository: fetch settings from backend, merge
