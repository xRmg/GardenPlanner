import i18n from "i18next";
import { initReactI18next } from "react-i18next";

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

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  nl: "Nederlands",
};

/**
 * Detect a supported locale from the browser's navigator.language.
 * Falls back to "en" if the browser language is not in supportedLocales.
 */
export function detectBrowserLocale(): SupportedLocale {
  const lang = navigator.language.split("-")[0].toLowerCase();
  return (supportedLocales as readonly string[]).includes(lang)
    ? (lang as SupportedLocale)
    : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { ui: enUI, plants: enPlants, calendar: enCalendar, errors: enErrors },
    nl: { ui: nlUI, plants: nlPlants, calendar: nlCalendar, errors: nlErrors },
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "ui",
  ns: ["ui", "plants", "calendar", "errors"],
  interpolation: { escapeValue: false },
});

export default i18n;
