import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { CATALOGS, DEFAULT_LOCALE, LOCALE_COOKIE, THEME_COOKIE, isLocale, isTheme, type Locale, type Theme } from "./config";

/** Cookie first, then the browser's Accept-Language, then Spanish. */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  const match = accept
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase())
    .find(isLocale);
  return match ?? DEFAULT_LOCALE;
});

export const getTheme = cache(async (): Promise<Theme> => {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : "system";
});

export async function getMessages() {
  return CATALOGS[await getLocale()];
}
