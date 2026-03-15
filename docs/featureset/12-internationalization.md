# Feature 12: Internationalization (i18n)

> Detailed feature documentation — source: codebase analysis, 2026-03-15

---

## Overview

The i18n infrastructure enables the application to serve users in multiple languages. Built on react-i18next with 4 translation namespaces, it currently ships English and Dutch. The infrastructure supports locale-aware formatting for dates, numbers, and month names, localized plant names with fallback chains, and a documented process for adding new languages.

---

## Components

| Component | File | Role |
|-----------|------|------|
| i18n Config | `app/i18n/config.ts` | i18next initialization and resource loading |
| Type Declarations | `app/i18n/i18next.d.ts` | TypeScript key safety via module augmentation |
| Plant Name Overrides | `app/i18n/plantNameOverrides.ts` | Per-locale plant name storage |
| Formatting Utilities | `app/i18n/utils/formatting.ts` | Locale-aware formatting helpers |
| Locale Files | `app/i18n/locales/` | Translation bundles per language |
| Plant References | `app/lib/plantReferences.ts` | Name normalization and aliasing |

---

## Sub-Features

### 12.1 Supported Languages
| Language | Code | Coverage |
|----------|------|----------|
| English | en | Full (all 4 namespaces) |
| Dutch (Nederlands) | nl | Full (all 4 namespaces) |

### 12.2 Translation Namespaces
| Namespace | File | Content |
|-----------|------|---------|
| `ui` | `locales/{lang}/ui.json` | Button labels, dialog titles, tooltips, descriptions (~373 keys) |
| `plants` | `locales/{lang}/plants.json` | Plant name translations (~68 entries) |
| `calendar` | `locales/{lang}/calendar.json` | Month/day names, calendar empty states |
| `errors` | `locales/{lang}/errors.json` | Validation errors, API failure messages |

### 12.3 Language Detection & Selection
- **First visit**: Browser language auto-detected via `navigator.language.split('-')[0]`
- **Fallback**: English if browser language not supported
- **Manual selection**: Language dropdown in Settings tab
- **Persistence**: Stored in both `localStorage.gp_locale` (pre-init detection) and Dexie settings

### 12.4 Locale-Aware Formatting
Formatting utilities in `app/i18n/utils/formatting.ts`:
| Function | Description |
|----------|-------------|
| `formatDate(date, style)` | Locale-aware date (short/long) via `Intl.DateTimeFormat` |
| `formatMonthNarrow()` | Single-letter month ("J", "F", "M") |
| `formatMonthShort()` | Abbreviated month ("Jan", "Feb") — locale-aware |
| `formatMonthRange(months[])` | Comma-separated month abbreviations |
| `formatDimensions(cellDims)` | "1 ft × 1 ft" or "30 × 25 cm" |
| `detectUnitSystem(locale)` | "imperial" for US, "metric" for others |
| `defaultCellDimensions(unitSystem)` | Preset cell dimensions by unit system |

### 12.5 Plant Name Localization
**Resolution chain** (highest priority first):
1. Locale-specific plant bundle (`locales/{lang}/plants.json`)
2. English plant bundle (`locales/en/plants.json`)
3. AI-generated override (from Dexie `plantNameOverrides` table)
4. Raw English name fallback

**Storage**: `plantNameOverrides` Dexie table stores per-locale overrides:
- Source types: "bundled" (from JSON), "ai" (AI-generated), "user" (manual)
- Indexed by `id`, `locale`, `ref`, `updatedAt`

**Helper functions**:
| Function | Description |
|----------|-------------|
| `getPlantName(plantId, englishName, locale?)` | Resolve display name in current locale |
| `matchesPlantSearchQuery(plant, query, locale?)` | Search across name, display name, ID, variety |
| `hasPlantNameTranslation(plantRef, locale?)` | Check if translation exists |
| `parseLocalizedPlantReferenceList(csv, locale?)` | Parse comma-separated plant names in any language to canonical refs |
| `getKnownPlantReferences(locales?)` | All canonical refs across all locales |

### 12.6 Plant Name Aliases
Cross-language/regional aliases resolve to canonical forms:
| Alias | Canonical |
|-------|-----------|
| zucchini | courgette |
| bell pepper | pepper |
| cilantro | coriander |
| arugula | rocket |
| eggplant | aubergine |
| chili | chilli |
| scallion | spring onion |

### 12.7 Localized Plant Content
Plants support per-locale content overrides in `plant.localizedContent`:
```json
{
  "nl": {
    "description": "Dutch description...",
    "watering": "Dutch watering notes...",
    "growingTips": "Dutch growing tips..."
  }
}
```
Stored per-plant in the `localizedContent` field. Displayed in PlantDetailsDialog when locale matches.

### 12.8 AI-Aware Localization
- AI plant lookup prompts include requested response language
- AI-generated companion/antagonist labels stored with locale tag
- AI suggestion prompts include locale for response language
- Locale change invalidates AI suggestion cache (LAS.7)

### 12.9 Adding New Languages
Documented process in `docs/adding-a-new-language.md`:
1. Create locale directory under `app/i18n/locales/{code}/`
2. Add all 4 namespace JSON files (ui, plants, calendar, errors)
3. Register locale in i18n config
4. Add plant name translations
5. Test all UI strings, date formatting, and plant name resolution
