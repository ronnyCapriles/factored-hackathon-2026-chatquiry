"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import { setLocale, setTheme } from "@/i18n/actions";
import { LOCALES, type Theme } from "@/i18n/config";

/** Language and theme picker for pages without a signed-in profile. */
export function PrefsSwitcher({ theme }: { theme: Theme }) {
  const t = useMessages();
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const apply = (fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <label className="sr-only" htmlFor="pref-locale">{t.prefs.language}</label>
      <select
        id="pref-locale"
        value={locale}
        onChange={(e) => apply(() => setLocale(e.target.value))}
        className="h-9 rounded-full border-[1.5px] border-linea bg-superficie px-2.5 text-[13px] font-semibold uppercase"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>{l.toUpperCase()}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="pref-theme">{t.prefs.theme}</label>
      <select
        id="pref-theme"
        value={theme}
        onChange={(e) => apply(() => setTheme(e.target.value))}
        className="h-9 rounded-full border-[1.5px] border-linea bg-superficie px-2.5 text-[13px] font-semibold"
      >
        <option value="light">{t.prefs.light}</option>
        <option value="dark">{t.prefs.dark}</option>
        <option value="system">{t.prefs.system}</option>
      </select>
    </div>
  );
}
