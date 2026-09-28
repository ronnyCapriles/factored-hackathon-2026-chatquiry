"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale, Messages } from "./config";

const I18nContext = createContext<{ locale: Locale; messages: Messages } | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, messages }}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useMessages must be used inside <I18nProvider>");
  return ctx;
}

export const useMessages = () => useI18n().messages;
export const useLocale = () => useI18n().locale;
