import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { ui: enUI, plants: enPlants, calendar: enCalendar, errors: enErrors },
      nl: { ui: nlUI, plants: nlPlants, calendar: nlCalendar, errors: nlErrors },
    },
    fallbackLng: "en",
    defaultNS: "ui",
    ns: ["ui", "plants", "calendar", "errors"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "gp_locale",
      caches: ["localStorage"],
    },
  });

export default i18n;
