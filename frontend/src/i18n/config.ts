import en from "./locales/en.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";

export const LOCALES = ["es", "en", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const LOCALE_COOKIE = "cq_locale";
export const THEME_COOKIE = "cq_theme";
/** Sent on every backend call so dynamic content comes back translated. */
export const LOCALE_HEADER = "X-Chatquiry-Locale";

/** Spanish is the source catalog; the others must match its shape (see scripts/check-i18n.mjs). */
export type Messages = typeof es;

export const CATALOGS: Record<Locale, Messages> = { es, en: en as Messages, pt: pt as Messages };

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);
export const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);

/** Replaces {name} placeholders. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
