import type enUI from "./locales/en/ui.json";
import type enPlants from "./locales/en/plants.json";
import type enCalendar from "./locales/en/calendar.json";
import type enErrors from "./locales/en/errors.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "ui";
    resources: {
      ui: typeof enUI;
      plants: typeof enPlants;
      calendar: typeof enCalendar;
      errors: typeof enErrors;
    };
  }
}
