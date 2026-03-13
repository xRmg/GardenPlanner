# Adding a New Language to Garden Planner

This guide explains how to add a new locale to Garden Planner's i18n infrastructure.

> **Architecture overview**: `docs/i18n-and-plant-library-architecture.md`  
> **Translation files**: `app/i18n/locales/`

---

## Prerequisites

- Read `docs/i18n-and-plant-library-architecture.md` for the overall i18n design.
- Translations are managed in four namespaces: `ui`, `plants`, `calendar`, `errors`.
- Garden Planner uses [i18next](https://www.i18next.com/) with React bindings via `react-i18next`.

---

## Step-by-Step Guide

### 1. Create locale files

Copy the English locale folder as a starting point:

```bash
cp -r app/i18n/locales/en app/i18n/locales/<locale>
```

Replace `<locale>` with the [BCP 47](https://www.ietf.org/rfc/bcp/bcp47.txt) language tag (e.g. `de`, `fr`, `es`, `pt-BR`).

The four files you need to translate:

| File | Contents |
|------|----------|
| `ui.json` | All UI labels, buttons, headings, hints (~373 keys) |
| `plants.json` | Plant display names (~68 built-in plants) |
| `calendar.json` | Calendar navigation, empty states |
| `errors.json` | Validation and async error messages |

### 2. Translate the files

Open each JSON file and translate every value. Keep:
- JSON keys **unchanged** (only values change)
- Interpolation placeholders unchanged: `{{count}}`, `{{name}}`, `{{date}}`
- Emoji intact (they are not translated)

Example (`ui.json`):
```json
// Before (English)
"common": {
  "save": "Save",
  "cancel": "Cancel"
}

// After (German example)
"common": {
  "save": "Speichern",
  "cancel": "Abbrechen"
}
```

#### Interpolation variables

Some strings contain dynamic values. Keep `{{ }}` placeholders verbatim:

| Placeholder | Meaning |
|-------------|---------|
| `{{count}}` | A numeric count (e.g. number of seeds) |
| `{{name}}` | A plant or area name |
| `{{date}}` | A formatted date string |
| `{{model}}` | AI model identifier |

Example:
```json
// English
"daysOld": "{{count}}d old"

// Dutch
"daysOld": "{{count}}d oud"

// German
"daysOld": "{{count}}T alt"
```

#### Plural forms

i18next supports [plural keys](https://www.i18next.com/translation-function/plurals) via `_one`, `_other`, etc. Currently Garden Planner uses simple count interpolation. If your language needs plural forms, add them:

```json
// English (simple)
"seedCount": "{{count}} seeds"

// Polish (complex plural rules)
"seedCount_one": "{{count}} nasiono",
"seedCount_few": "{{count}} nasiona",
"seedCount_many": "{{count}} nasion"
```

### 3. Register the locale in the i18n config

Open `app/i18n/config.ts` and add your locale:

```typescript
// 1. Add imports at the top
import deUI from "./locales/de/ui.json";
import dePlants from "./locales/de/plants.json";
import deCalendar from "./locales/de/calendar.json";
import deErrors from "./locales/de/errors.json";

// 2. Expand the supportedLocales tuple
export const supportedLocales = ["en", "nl", "de"] as const;

// 3. Add a human-readable label (in the target language)
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  nl: "Nederlands",
  de: "Deutsch",          // ← add your language in its own script
};

// 4. Add to i18next resources
i18n.use(initReactI18next).init({
  resources: {
    en: { ui: enUI, plants: enPlants, calendar: enCalendar, errors: enErrors },
    nl: { ui: nlUI, plants: nlPlants, calendar: nlCalendar, errors: nlErrors },
    de: { ui: deUI, plants: dePlants, calendar: deCalendar, errors: deErrors }, // ← add
  },
  // ... rest unchanged
});
```

> **When to switch to lazy loading**: Once you add 4+ languages or the plant catalog
> exceeds 200 entries, consider switching from static imports to `i18next-http-backend`
> or Vite dynamic `import()` to keep the initial bundle size lean.

### 4. Update the TypeScript augmentation (optional)

The TypeScript augmentation in `app/i18n/i18next.d.ts` uses the English locale as the
source of truth for key type-safety. You do not need to change this file when adding a new
language — it only ensures `t("key")` calls are type-checked against the English keys.

### 5. Test the new language

1. Start the dev server: `npm run dev`
2. Open Settings → Language and select your new locale.
3. Verify the UI strings, plant names, and calendar labels all render correctly.
4. Check that month picker buttons in the Plant Definition dialog show correct narrow
   month letters for your locale (these are derived from `Intl.DateTimeFormat`
   automatically).
5. Test date formatting in the Calendar view (also locale-aware via `Intl.DateTimeFormat`).

### 6. Run the build

```bash
npm run build
```

Fix any TypeScript errors. Common issues:
- Missing keys in your locale file that the type system expects (add them)
- Interpolation mismatches (check `{{placeholder}}` names)

---

## File Structure Reference

```
app/i18n/
├── config.ts                  # i18next init, supportedLocales, LOCALE_LABELS
├── i18next.d.ts               # TypeScript namespace augmentation (key safety)
├── utils/
│   ├── formatting.ts          # Locale-aware date/month formatters (Intl wrappers)
│   └── plantTranslation.ts    # getPlantName() helper
└── locales/
    ├── en/                    # English (source of truth)
    │   ├── ui.json
    │   ├── plants.json
    │   └── calendar.json
    │   └── errors.json
    ├── nl/                    # Dutch
    │   ├── ui.json
    │   ├── plants.json
    │   ├── calendar.json
    │   └── errors.json
    └── <new-locale>/          # Your new language here
        ├── ui.json
        ├── plants.json
        ├── calendar.json
        └── errors.json
```

---

## Month and Date Formatting

Month labels in the app are **automatically locale-aware** via `Intl.DateTimeFormat` — you
do **not** need to add month names to your locale files. This includes:

- Narrow month letters in the Plant Definition dialog month picker buttons (`formatMonthNarrow`)
- Month abbreviations used in sowing window summaries (`formatMonthShort`)
- Full month names in the Calendar header (already uses `Intl.DateTimeFormat` directly)
- Weekday abbreviations in the Calendar grid

Date formats (short vs. long) also adapt automatically to the locale tag.

---

## Plant Name Translations

Built-in plant names are stored in `plants.json`. The `getPlantName(plantId, englishName)`
helper in `app/i18n/utils/plantTranslation.ts` resolves the display name for the current
locale, falling back to the English name if no translation exists.

**User-defined plants** (added via the catalogue) are stored in IndexedDB with the name
as entered — they are not translated.

To add a plant name translation, add an entry under `names` in `plants.json`:

```json
{
  "names": {
    "tomato": "Tomate",
    "cucumber": "Gurke"
    // ...
  }
}
```

The key must match the plant's `id` in the bundled plant catalogue
(`app/data/defaultPlants.ts` or similar).

---

## Language Detection & Persistence

On first visit, if the user has no stored locale preference, the browser's
`navigator.language` is automatically mapped to the nearest supported locale (in
`useGardenData.ts` via `detectBrowserLocale()` from `app/i18n/config.ts`). The detected
locale is saved to both Dexie (`settings.locale`) and `localStorage` (`gp_locale`).

After the user explicitly selects a language in Settings, the choice is persisted to:

1. `localStorage` under the key `gp_locale` (for fast startup before DB loads)
2. The `settings.locale` field in IndexedDB (Dexie) — survives `localStorage` clears

The `<html lang>` attribute is updated whenever the language changes, which is important
for screen readers and SEO.

---

## Checklist for a New Language

- [ ] Create `app/i18n/locales/<locale>/ui.json` (translate all ~373 keys)
- [ ] Create `app/i18n/locales/<locale>/plants.json` (translate plant names)
- [ ] Create `app/i18n/locales/<locale>/calendar.json` (translate calendar strings)
- [ ] Create `app/i18n/locales/<locale>/errors.json` (translate error messages)
- [ ] Add imports + entry to `resources` in `app/i18n/config.ts`
- [ ] Add locale to `supportedLocales` tuple in `app/i18n/config.ts`
- [ ] Add human-readable label to `LOCALE_LABELS` in `app/i18n/config.ts`
- [ ] Run `npm run build` — fix any TypeScript errors
- [ ] Manually test: Settings → Language → select new locale
- [ ] Verify month picker narrow labels are correct for the new locale
- [ ] Verify calendar date/month formatting is correct
