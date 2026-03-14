type AIResponseLocale = "en" | "nl";

const AI_RESPONSE_LANGUAGE_NAMES: Record<AIResponseLocale, string> = {
  en: "English",
  nl: "Dutch",
};

export function getAIResponseLanguage(locale?: string): {
  locale: AIResponseLocale;
  languageName: string;
} {
  const base = locale?.split("-")[0]?.toLowerCase();
  const normalized: AIResponseLocale = base === "nl" ? "nl" : "en";

  return {
    locale: normalized,
    languageName: AI_RESPONSE_LANGUAGE_NAMES[normalized],
  };
}