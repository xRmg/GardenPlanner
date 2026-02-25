# Garden Planner: i18n & Shared Plant Library Architecture

## Table of Contents

- [A. i18n Framework Comparison](#a-i18n-framework-comparison)
- [B. i18n Architecture Design](#b-i18n-architecture-design)
- [C. Plant Data Localization Strategy](#c-plant-data-localization-strategy)
- [D. Shared Plant Library Architecture](#d-shared-plant-library-architecture)

---

## A. i18n Framework Comparison

### Candidates

| Criteria                   | **react-i18next**                                                                                                             | **react-intl** (FormatJS)                                                                     | **next-intl**                                              | **Lingui**                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Bundle size** (min+gz)   | ~12 kB (i18next core + react-i18next)                                                                                         | ~14 kB                                                                                        | ~12 kB, but designed for Next.js                           | ~5 kB (core + react)                                                                               |
| **TypeScript support**     | Excellent — full generic typing for `t()`, typed namespaces, key autocomplete via `i18next.d.ts` augmentation                 | Good — typed `intl.formatMessage()`, but message IDs are plain strings unless you add tooling | Good — typed keys via namespace generics                   | Excellent — compile-time extraction produces typed catalogs; `msg()` macro gives full autocomplete |
| **Plural / ICU**           | ICU-like plurals via i18next syntax (`_one`, `_other` suffixes) or ICU plugin. Simpler than full ICU but covers 95% of cases. | Full ICU MessageFormat (gold standard for plurals, select, selectordinal)                     | Full ICU (uses FormatJS under the hood)                    | Full ICU MessageFormat                                                                             |
| **Namespace support**      | First-class — split translations into `ui`, `plants`, `errors`, etc., and load independently                                  | No built-in namespaces; you structure by message ID prefixes                                  | Namespace via file-based routing                           | Catalogs per domain; achievable but less ergonomic than i18next                                    |
| **Lazy loading**           | Built-in `i18next-http-backend` or dynamic `import()` with Vite. Trivial to lazy-load per namespace.                          | Manual — you load message bundles and pass to `<IntlProvider>`                                | Automatic via Next.js route segments (not applicable here) | Lazy-loadable catalogs via dynamic `import()`                                                      |
| **Date/Number formatting** | Delegates to `Intl.*` APIs via lightweight wrappers (`t('key', { val: date, formatParams: {…} })`)                            | Best-in-class — `formatDate`, `formatNumber`, `formatRelativeTime` all built-in               | Inherits FormatJS formatters                               | Uses `Intl.*` APIs directly; no built-in formatting helpers                                        |
| **Interpolation**          | `{{variable}}` syntax, nesting, context                                                                                       | ICU `{variable}` syntax                                                                       | ICU `{variable}` syntax                                    | ICU `{variable}` syntax                                                                            |
| **React integration**      | `useTranslation()` hook, `<Trans>` component for JSX interpolation                                                            | `useIntl()` hook, `<FormattedMessage>` component                                              | `useTranslations()` hook                                   | `useLingui()` hook, `<Trans>` macro (compile-time)                                                 |
| **Ecosystem & community**  | Largest — most tutorials, plugins, editor extensions                                                                          | Large — backed by Yahoo/FormatJS                                                              | Growing — tied to Next.js ecosystem                        | Smaller but active; backed by Crowdin                                                              |
| **Extraction tooling**     | `i18next-parser` extracts keys from code                                                                                      | `formatjs extract` CLI                                                                        | Built-in with Next.js                                      | `@lingui/cli extract` — best-in-class compile-time extraction                                      |
| **Vite compatibility**     | Excellent — works out of the box                                                                                              | Excellent                                                                                     | Requires adapters (designed for Next.js)                   | Excellent — has a Vite plugin                                                                      |

### Recommendation: **react-i18next**

**Justification:**

1. **Namespace support is critical** for this app. Plant data translations, UI labels, and error messages are fundamentally different concerns. i18next's first-class namespace support (`useTranslation('plants')`, `useTranslation('ui')`) maps perfectly to this.

2. **Lazy loading per namespace** — the plant translation catalog will grow large over time (especially with a shared library). i18next lets you load the `plants` namespace on demand without loading the full `ui` namespace, and vice versa.

3. **Largest ecosystem** — VS Code extensions for key autocomplete, many backend plugins (for future server-side use), mature HTTP backend for loading translations from CDN/API.

4. **Vite-native** — no framework coupling. next-intl requires Next.js shims. This app is pure React + Vite.

5. **TypeScript key safety** — via module augmentation of `i18next`, you get compile-time key checking and autocomplete:

```typescript
// src/i18n/i18next.d.ts
import "i18next";
import type ui from "./locales/en/ui.json";
import type plants from "./locales/en/plants.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "ui";
    resources: {
      ui: typeof ui;
      plants: typeof plants;
    };
  }
}
```

6. **Migration effort is low** — the current app has ~50-80 hardcoded strings across `App.tsx`, `AddSeedlingDialog.tsx`, `PlantDefinitionDialog.tsx`, `SowSeedsDialog.tsx`, and `ToolBar.tsx`. Wrapping these in `t()` calls is mechanical.

**Runner-up: Lingui** — if bundle size were the top priority and you wanted compile-time safety. However, the namespace story is weaker, and the ecosystem is smaller.

---

## B. i18n Architecture Design

### B.1 File & Folder Structure

```
src/
  i18n/
    config.ts              # i18next initialization
    i18next.d.ts           # TypeScript augmentation for key safety
    locales/
      en/
        ui.json            # UI labels, buttons, tooltips, errors
        plants.json        # Plant-specific translations (names, varieties, descriptions)
        calendar.json      # Month names, date-related strings
        errors.json        # Validation and error messages
      nl/
        ui.json
        plants.json
        calendar.json
        errors.json
    utils/
      formatting.ts        # Date/number formatting helpers wrapping Intl APIs
      plantTranslation.ts  # Helper to resolve plant name for current locale
```

### B.2 i18next Configuration

```typescript
// src/i18n/config.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Static imports for shipped languages (small enough to bundle)
import enUI from "./locales/en/ui.json";
import enPlants from "./locales/en/plants.json";
import enCalendar from "./locales/en/calendar.json";
import enErrors from "./locales/en/errors.json";
import nlUI from "./locales/nl/ui.json";
import nlPlants from "./locales/nl/plants.json";
import nlCalendar from "./locales/nl/calendar.json";
import nlErrors from "./locales/nl/errors.json";

export const supportedLocales = ["en", "nl"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

i18n.use(initReactI18next).init({
  resources: {
    en: { ui: enUI, plants: enPlants, calendar: enCalendar, errors: enErrors },
    nl: { ui: nlUI, plants: nlPlants, calendar: nlCalendar, errors: nlErrors },
  },
  lng: localStorage.getItem("gp_locale") ?? navigator.language.split("-")[0],
  fallbackLng: "en",
  defaultNS: "ui",
  ns: ["ui", "plants", "calendar", "errors"],
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export default i18n;
```

> **When to switch to lazy loading:** Once you exceed 3-4 languages or the plant catalog > 200 entries, switch from static imports to `i18next-http-backend` or Vite dynamic `import()` to keep the initial bundle lean.

### B.3 Translation File Examples

**`locales/en/ui.json`**

```json
{
  "app": {
    "title": "Garden Planner",
    "tabs": {
      "garden": "My Garden",
      "seedlings": "Seedlings",
      "companions": "Companions",
      "climate": "Climate",
      "settings": "Settings"
    }
  },
  "toolbar": {
    "selectedPlant": "Selected Plant",
    "growingMonth": "Growing Month",
    "noPlantSelected": "No plant selected"
  },
  "planter": {
    "addArea": "Add Area",
    "addPlanter": "Add Planter",
    "editPlanter": "Edit Planter",
    "deletePlanter": "Delete Planter",
    "confirmDelete": "This will remove the planter and all planted items.",
    "rows": "Rows",
    "cols": "Columns"
  },
  "seedling": {
    "addSeedling": "Start Seedling",
    "seedCount": "Seed Count",
    "location": "Location",
    "plantedDate": "Planted Date",
    "method": "Method",
    "methodIndoor": "Indoor Start",
    "methodDirectSow": "Direct Sow",
    "status": "Status",
    "statusGerminating": "Germinating",
    "statusGrowing": "Growing",
    "statusHardening": "Hardening Off",
    "statusReady": "Ready to Plant Out",
    "searchPlaceholder": "Search plants and seeds…",
    "locationPlaceholder": "e.g. Propagator"
  },
  "plant": {
    "addPlant": "Add Plant",
    "editPlant": "Edit Plant",
    "name": "Name",
    "variety": "Variety",
    "description": "Description",
    "daysToHarvest": "Days to Harvest",
    "spacing": "Spacing (cm)",
    "frostHardy": "Frost Hardy",
    "sunRequirement": "Sun Requirement",
    "sunFull": "Full Sun",
    "sunPartial": "Partial Shade",
    "sunShade": "Shade",
    "companions": "Companions",
    "antagonists": "Antagonists",
    "sowIndoor": "Sow Indoors",
    "sowDirect": "Sow Direct",
    "harvest": "Harvest"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "search": "Search",
    "close": "Close",
    "confirm": "Are you sure?"
  },
  "settings": {
    "location": "Location",
    "locationPlaceholder": "e.g. London, UK",
    "growthZone": "USDA Growth Zone",
    "language": "Language"
  }
}
```

**`locales/en/plants.json`**

```json
{
  "tomato": {
    "name": "Tomato",
    "variety_cherry": "Cherry",
    "variety_beefsteak": "Beefsteak",
    "description": "Indeterminate climber. Pinch out side shoots. Stake early."
  },
  "carrot": {
    "name": "Carrot",
    "variety_nantes": "Nantes",
    "description": "Needs deep, stone-free soil. Thin to 8cm to avoid forking."
  },
  "courgette": {
    "name": "Courgette",
    "variety_defender": "Defender",
    "description": "Harvest at 15–20cm to keep the plant cropping. One plant feeds a family."
  }
}
```

**`locales/nl/plants.json`**

```json
{
  "tomato": {
    "name": "Tomaat",
    "variety_cherry": "Cherry",
    "variety_beefsteak": "Biefstuk",
    "description": "Doorgroeiende klimmer. Knip dieven uit. Stok vroeg op."
  },
  "carrot": {
    "name": "Wortel",
    "variety_nantes": "Nantes",
    "description": "Heeft diepe, steenvrije grond nodig. Dun uit tot 8cm."
  },
  "courgette": {
    "name": "Courgette",
    "variety_defender": "Defender",
    "description": "Oogst bij 15–20cm om de plant te laten doorproduceren."
  }
}
```

### B.4 Handling "Courgette" vs "Zucchini" (Locale-Specific Plant Names)

Some plants have different names depending on regional locale (not just language). Strategy:

```json
// locales/en/plants.json — default English (British)
{
  "courgette": {
    "name": "Courgette"
  }
}

// locales/en-US/plants.json — American English override
{
  "courgette": {
    "name": "Zucchini"
  }
}
```

**i18next handles this natively** with its fallback chain:

```
en-US → en → (key)
```

Configure the fallback:

```typescript
i18n.init({
  fallbackLng: {
    "en-US": ["en"],
    "en-GB": ["en"],
    "nl-BE": ["nl"],
    default: ["en"],
  },
});
```

This means `en-US/plants.json` only needs entries that differ from `en/plants.json`. Everything else falls through.

### B.5 Translating Dynamic / AI-Generated Content

When a user creates a custom plant via AI lookup, the AI returns English text. Strategy:

| Approach                          | When to use                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Store raw + translate on read** | For the future shared library. AI or human translators fill in a `translations` table server-side. The app pulls the user's locale.             |
| **Store as-is, don't translate**  | For user-custom (private) plants. The user typed "My Special Basil" — don't auto-translate personal names.                                      |
| **On-demand AI translation**      | When a user shares a custom plant to the shared library, trigger an AI translation pass for all supported locales, then queue for human review. |

In the UI, distinguish between translatable and non-translatable content:

```typescript
function getPlantName(plant: Plant, t: TFunction): string {
  // Try the i18n catalog first (shared library plants have translation keys)
  const translated = t(`${plant.id}.name`, { ns: "plants", defaultValue: "" });
  if (translated) return translated;
  // Fall back to the raw name stored on the plant object (user-custom plants)
  return plant.name;
}
```

### B.6 Date & Number Formatting

Don't reinvent — use the `Intl` APIs with a thin wrapper:

```typescript
// src/i18n/utils/formatting.ts
import i18n from "../config";

export function formatDate(
  date: Date | string,
  style: "short" | "long" = "short",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(i18n.language, {
    dateStyle: style,
  }).format(d);
}

export function formatMonthName(month: number): string {
  // month is 1-indexed (1 = January)
  const date = new Date(2024, month - 1, 1);
  return new Intl.DateTimeFormat(i18n.language, { month: "short" }).format(
    date,
  );
}

export function formatMonthRange(months: number[]): string {
  if (!months?.length) return "";
  const sorted = [...months].sort((a, b) => a - b);
  const first = formatMonthName(sorted[0]);
  const last = formatMonthName(sorted[sorted.length - 1]);
  if (sorted.length === 1) return first;
  return `${first}–${last}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(i18n.language).format(value);
}

export function formatSpacing(cm: number): string {
  return new Intl.NumberFormat(i18n.language, {
    style: "unit",
    unit: "centimeter",
  }).format(cm);
}
```

This replaces the current hardcoded `MONTH_ABBR` array in `App.tsx` and gives locale-correct month names automatically.

### B.7 Language Switcher UX

Add to the Settings tab (already exists in the app):

```tsx
import { useTranslation } from "react-i18next";
import { supportedLocales, type SupportedLocale } from "@/i18n/config";

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  nl: "Nederlands",
};

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleChange = (locale: SupportedLocale) => {
    i18n.changeLanguage(locale);
    localStorage.setItem("gp_locale", locale);
    document.documentElement.lang = locale;
  };

  return (
    <div>
      <label>{t("settings.language")}</label>
      <select
        value={i18n.language}
        onChange={(e) => handleChange(e.target.value as SupportedLocale)}
      >
        {supportedLocales.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}
```

**UX notes:**

- Display language names in their own language ("Nederlands", not "Dutch") — users scanning for their language need to recognize it.
- Persist to `localStorage` and restore on init.
- Set `document.documentElement.lang` for accessibility.
- Place in Settings tab, not in the main toolbar (language switching is infrequent).

### B.8 Migration Checklist (Current Codebase)

Files with hardcoded English strings that need `t()` wrapping:

| File                         | Approximate string count                                                             | Key namespace |
| ---------------------------- | ------------------------------------------------------------------------------------ | ------------- |
| `App.tsx`                    | ~40 strings (tab labels, area names, month formatting, button text, settings labels) | `ui`          |
| `AddSeedlingDialog.tsx`      | ~12 strings (labels, placeholders, status values)                                    | `ui`          |
| `PlantDefinitionDialog.tsx`  | ~15 strings (form labels, sun requirement options)                                   | `ui`          |
| `SowSeedsDialog.tsx`         | ~8 strings (labels, placeholders)                                                    | `ui`          |
| `PlanterGrid.tsx`            | ~6 strings (confirm dialogs, tooltips)                                               | `ui`          |
| `PlanterDialog.tsx`          | ~8 strings (dialog labels, section config)                                           | `ui`          |
| `ToolBar.tsx`                | ~4 strings (labels)                                                                  | `ui`          |
| `EventsBar.tsx`              | ~5 strings (event labels)                                                            | `ui`          |
| `PlantDetailsDialog.tsx`     | ~10 strings (detail labels)                                                          | `ui`          |
| Plant `DEFAULT_PLANTS` array | 12 plants × 3 fields (name, variety, description) = ~36                              | `plants`      |

**Total: ~140 strings for v1.**

---

## C. Plant Data Localization Strategy

### C.1 Schema Design — Local App (Current)

The current `Plant` interface stores English strings directly:

```typescript
interface Plant {
  id: string; // Stable key: "tomato", "carrot", etc.
  name: string; // Display name — currently English
  variety?: string;
  description?: string;
  // ... other fields
}
```

**After i18n, the `Plant` interface stays the same** — it represents the raw/fallback data. Translations live in the i18n catalog, not on the object.

Resolution order:

```
i18n catalog (user's locale) → i18n catalog (English) → plant.name (raw field)
```

```typescript
// Usage in components:
const { t } = useTranslation("plants");

function PlantLabel({ plant }: { plant: Plant }) {
  // t() returns the translated name, or falls back to plant.name
  const name = t(`${plant.id}.name`, { defaultValue: plant.name });
  const variety = plant.variety
    ? t(`${plant.id}.variety_${plant.variety.toLowerCase().replace(/\s+/g, "_")}`, {
        defaultValue: plant.variety,
      })
    : undefined;

  return (
    <span>
      {plant.icon} {name} {variety && `(${variety})`}
    </span>
  );
}
```

### C.2 User-Custom Plants

When a user creates a custom plant (e.g., "My Grandmother's Heirloom Tomato"):

- **Do not add to the i18n catalog.** User-entered names are personal and should not be translated.
- Store as-is in `localStorage` / future backend.
- The resolution function already handles this: `t()` returns `defaultValue: plant.name` when no catalog entry exists.
- If/when the user shares this to the shared library, a translation job is triggered (see Section D).

### C.3 Companion/Antagonist References

Currently `companions: ["basil", "carrot"]` — these are plant IDs. Good. No change needed.

When displaying companions, resolve each ID to a translated name:

```typescript
const companionNames = plant.companions?.map((id) =>
  t(`${id}.name`, { ns: "plants", defaultValue: id }),
);
```

### C.4 Schema for Multi-Language Plant Data (Database)

For the future shared library, use a **separate translation table** (not inline):

```sql
-- Core plant data (language-independent)
CREATE TABLE plants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,   -- "tomato", "carrot"
  icon        TEXT NOT NULL,          -- emoji
  color       TEXT NOT NULL,          -- hex
  spacing_cm  INT,
  days_to_harvest INT,
  frost_hardy BOOLEAN DEFAULT false,
  sun_requirement TEXT CHECK (sun_requirement IN ('full', 'partial', 'shade')),
  sow_indoor_months  INT[],
  sow_direct_months  INT[],
  harvest_months     INT[],
  companion_ids      UUID[],
  antagonist_ids     UUID[],
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Translations (one row per plant per locale)
CREATE TABLE plant_translations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id    UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  locale      TEXT NOT NULL,          -- "en", "nl", "en-US"
  name        TEXT NOT NULL,
  variety     TEXT,
  description TEXT,
  UNIQUE (plant_id, locale)
);

CREATE INDEX idx_plant_translations_locale ON plant_translations(plant_id, locale);
```

**Why a separate table (not inline JSON)?**

| Approach                                                  | Pros                                                                                                                 | Cons                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Separate table**                                        | Query by locale efficiently; easy to add languages; standard pattern; can grant translator access to just this table | Extra JOIN                                                                      |
| **Inline JSON** (`names: { en: "Tomato", nl: "Tomaat" }`) | Fewer tables; single read                                                                                            | Hard to query by locale; grows unbounded; no per-field indexing; awkward in SQL |

**Verdict: Separate table.** The JOIN cost is negligible; the querying and maintenance benefits are significant at scale.

### C.5 Fallback Chain Implementation

```typescript
// API-side (pseudo-code for a PostgreSQL query)
async function getPlantWithTranslation(
  plantId: string,
  locale: string,
): Promise<PlantDTO> {
  // Try exact locale, then base language, then English
  const fallbackChain = [locale, locale.split("-")[0], "en"];

  const result = await db.query(
    `
    SELECT p.*, pt.name, pt.variety, pt.description
    FROM plants p
    LEFT JOIN LATERAL (
      SELECT *
      FROM plant_translations pt
      WHERE pt.plant_id = p.id
        AND pt.locale = ANY($2)
      ORDER BY array_position($2, pt.locale)
      LIMIT 1
    ) pt ON true
    WHERE p.id = $1
  `,
    [plantId, fallbackChain],
  );

  return result.rows[0];
}
```

Client-side fallback (for offline / bundled data) is handled by i18next's `fallbackLng` configuration as shown in B.4.

---

## D. Shared Plant Library Architecture (Future)

### D.1 Database Schema

```sql
-- Extends the schema from C.4

-- Versioning: track who contributed and when
CREATE TABLE plant_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id    UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  version     INT NOT NULL,
  changed_by  UUID REFERENCES users(id),
  change_type TEXT CHECK (change_type IN ('create', 'update', 'translate')),
  diff        JSONB,                  -- What changed
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (plant_id, version)
);

-- Moderation queue
CREATE TABLE plant_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id    UUID REFERENCES plants(id),           -- NULL for new plants
  submitted_by UUID NOT NULL REFERENCES users(id),
  status      TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  data        JSONB NOT NULL,         -- Proposed plant data + translations
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- User-custom plants (private, not in shared library)
CREATE TABLE user_plants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  data        JSONB NOT NULL,         -- Full Plant object (same shape as shared)
  source      TEXT CHECK (source IN ('manual', 'ai-generated', 'forked')),
  forked_from UUID REFERENCES plants(id),  -- If derived from shared library
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, slug)
);
```

### D.2 API Design

**Recommendation: REST** for v1.

| Reason                         | Details                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------- |
| Simpler to implement and cache | Plant data is read-heavy with predictable shapes                                  |
| CDN-friendly                   | GET endpoints can be edge-cached aggressively                                     |
| GraphQL adds complexity        | Over-engineering for a domain with few relationships and no deeply nested queries |
| Migration to GraphQL           | Easy later — add a `/graphql` endpoint alongside REST                             |

**Endpoints:**

```
GET    /api/v1/plants?locale=nl&page=1&limit=50
GET    /api/v1/plants/:slug?locale=nl
GET    /api/v1/plants/:slug/translations
POST   /api/v1/plants/search?q=tomato&locale=nl

# User's custom plants
GET    /api/v1/me/plants
POST   /api/v1/me/plants
PUT    /api/v1/me/plants/:id
DELETE /api/v1/me/plants/:id

# Community contributions
POST   /api/v1/submissions            # Submit new or updated plant
GET    /api/v1/submissions/:id/status  # Check submission status

# Bulk sync (for offline-first apps)
GET    /api/v1/plants/sync?since=2026-01-15T00:00:00Z&locale=nl
  → Returns all plants updated since the given timestamp
```

**Response shape:**

```json
// GET /api/v1/plants/tomato?locale=nl
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "slug": "tomato",
  "icon": "🍅",
  "color": "#ef4444",
  "spacingCm": 60,
  "daysToHarvest": 75,
  "frostHardy": false,
  "sunRequirement": "full",
  "sowIndoorMonths": [2, 3, 4],
  "sowDirectMonths": [],
  "harvestMonths": [7, 8, 9],
  "companions": ["basil", "carrot", "onion"],
  "antagonists": ["fennel", "broccoli"],
  "name": "Tomaat",
  "variety": "Cherry",
  "description": "Doorgroeiende klimmer. Knip dieven uit. Stok vroeg op.",
  "locale": "nl",
  "version": 3,
  "updatedAt": "2026-02-10T14:30:00Z"
}
```

The translated fields (`name`, `variety`, `description`) are inlined into the response — the server resolves the fallback chain. The client doesn't need to know about the translation table.

### D.3 Versioning & Moderation Workflow

```
User submits change
       │
       ▼
 ┌─────────────┐
 │  Submission  │  status: "pending"
 │   Queue      │
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │  Moderator   │  Reviews diff against current version
 │   Review     │
 └──────┬──────┘
        │
   ┌────┴────┐
   │         │
   ▼         ▼
Approved   Rejected
   │         │
   ▼         ▼
 Version++  Notify user
 Publish    with reason
```

**Rules:**

- Translations can be submitted by any authenticated user.
- New plant data submissions require moderator approval.
- Translation-only changes can be auto-approved if the submitter has "trusted translator" status (earned after N approved translations).
- Each approval increments the plant's `version` and stores a diff in `plant_versions`.
- The API's `sync` endpoint uses `updatedAt` (which updates on each new version) so clients pull only changes.

### D.4 Local vs Shared Plant Coexistence

```
┌────────────────────────────────────┐
│         Client App                  │
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ Shared Plant │  │ User-Custom  │ │
│  │   Cache      │  │   Plants     │ │
│  │ (IndexedDB)  │  │ (IndexedDB)  │ │
│  └──────┬──────┘  └──────┬──────┘ │
│         │                │         │
│         └───────┬────────┘         │
│                 │                  │
│          Merged Plant List          │
│     (shared + custom, deduped)     │
└────────────────────────────────────┘
```

**Merge strategy:**

```typescript
interface ResolvedPlant extends Plant {
  source: "shared" | "custom" | "forked";
  sharedVersion?: number; // For forked plants: which shared version it was based on
}

function mergePlantLists(shared: Plant[], custom: Plant[]): ResolvedPlant[] {
  const result = new Map<string, ResolvedPlant>();

  // Shared plants first
  for (const p of shared) {
    result.set(p.id, { ...p, source: "shared" });
  }

  // Custom plants override or add
  for (const p of custom) {
    if (result.has(p.id)) {
      // User has customized a shared plant — their version wins locally
      result.set(p.id, { ...p, source: "forked" });
    } else {
      result.set(p.id, { ...p, source: "custom" });
    }
  }

  return Array.from(result.values());
}
```

**UX indicators:**

- Shared library plants get a "🌍" badge.
- User-custom plants get a "👤" badge.
- Forked plants get a "🔀" badge with an option to "Update from library" when the shared version has changed.

### D.5 Sync Strategy

**Offline-first with background sync:**

```typescript
// On app startup and every 24 hours
async function syncPlantLibrary() {
  const lastSync =
    localStorage.getItem("gp_lastPlantSync") ?? "1970-01-01T00:00:00Z";
  const locale = i18n.language;

  try {
    const response = await fetch(
      `/api/v1/plants/sync?since=${lastSync}&locale=${locale}`,
    );
    const { plants, syncTimestamp } = await response.json();

    if (plants.length > 0) {
      // Upsert into IndexedDB
      const db = await openPlantDB();
      const tx = db.transaction("sharedPlants", "readwrite");
      for (const plant of plants) {
        await tx.store.put(plant);
      }
      await tx.done;
    }

    localStorage.setItem("gp_lastPlantSync", syncTimestamp);
  } catch {
    // Offline — use cached data, retry later
  }
}
```

**Key design decisions:**

| Decision            | Choice                                            | Reasoning                                                  |
| ------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| Storage             | IndexedDB (via `idb` library)                     | Structured data, large capacity, async, supports cursors   |
| Sync trigger        | App startup + 24h interval                        | Plants change infrequently; no need for real-time          |
| Conflict resolution | Server wins for shared plants                     | The shared library is the source of truth                  |
| Locale handling     | Sync pulls translations for user's current locale | Switch locale → re-sync to pull new translations           |
| Initial load        | Bundle top ~50 plants in the app as seed data     | So the app works instantly without network on first launch |
| Delta sync          | `?since=` timestamp parameter                     | Avoids re-downloading the full catalog every time          |

---

## Implementation Priority

| Phase                | Scope                                                                                    | Effort   |
| -------------------- | ---------------------------------------------------------------------------------------- | -------- |
| **Phase 1**          | Install react-i18next, set up config, extract UI strings, ship `en` + `nl`               | 2–3 days |
| **Phase 2**          | Extract `DEFAULT_PLANTS` into `plants.json`, translate to Dutch, add `PlantLabel` helper | 1 day    |
| **Phase 3**          | Replace hardcoded `MONTH_ABBR` with `Intl.DateTimeFormat`, add formatters                | 0.5 day  |
| **Phase 4**          | Language switcher in Settings, persist preference, `<html lang>`                         | 0.5 day  |
| **Phase 5**          | TypeScript augmentation for key safety, CI lint for missing keys                         | 0.5 day  |
| **Phase 6** (future) | Shared plant library backend, API, IndexedDB sync                                        | Weeks    |

### Quick-Start Commands

```bash
npm install i18next react-i18next
# Optional, for lazy loading later:
# npm install i18next-http-backend i18next-browser-languagedetector
```

Then create the folder structure from B.1 and initialize as shown in B.2.
