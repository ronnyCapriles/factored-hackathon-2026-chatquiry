"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, THEME_COOKIE, isLocale, isTheme } from "./config";

const YEAR = 60 * 60 * 24 * 365;

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

export async function setTheme(theme: string) {
  if (!isTheme(theme)) return;
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
}
