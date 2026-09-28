"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";

// Filters live in the URL. Selects apply at once; the search box waits for a short pause.
export function FilterBar({ children, search, searchPlaceholder }: { children?: ReactNode; search?: boolean; searchPlaceholder?: string }) {
  const t = useMessages();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const active = [...params.keys()].some((k) => k !== "page");

  function apply(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const id = setTimeout(() => apply("q", q.trim()), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply reads the latest params on each call
  }, [q]);

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-tarjeta border-[1.5px] border-linea bg-superficie p-3"
      role="search"
      aria-busy={pending}
      onChange={(e) => {
        const el = e.target;
        if (el instanceof HTMLSelectElement) apply(el.name, el.value);
      }}
    >
      {search && (
        <label className="flex min-w-[240px] grow items-center gap-2 rounded-full border-[1.5px] border-linea bg-fondo px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <span className="sr-only">{t.common.search}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder ?? t.common.search} className="h-10 grow bg-transparent text-[14px] outline-none" />
        </label>
      )}
      {children}
      {pending && <span className="text-[13px] text-muted">{t.common.filtering}</span>}
      {active && (
        <Link href={pathname} className="ml-auto text-[14px] font-semibold underline underline-offset-4" onClick={() => setQ("")}>
          {t.common.clearFilters}
        </Link>
      )}
    </div>
  );
}

export function FilterSelect({ name, label, options, value }: { name: string; label: string; options: { value: string; label: string }[]; value?: string }) {
  const t = useMessages();
  return (
    <label className="flex items-center gap-2 text-[14px]">
      <span className="font-semibold text-tinta-3">{label}</span>
      <select name={name} defaultValue={value ?? ""} key={value ?? ""} className="h-10 rounded-full border-[1.5px] border-linea bg-superficie px-3 text-[14px] font-semibold">
        <option value="">{t.common.all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
