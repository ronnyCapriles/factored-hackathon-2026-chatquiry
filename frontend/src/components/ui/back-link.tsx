"use client";

import { useRouter } from "next/navigation";
import { useMessages } from "@/i18n/client";

/** Returns to the previous page, or to `fallback` when opened directly. */
export function BackLink({ fallback, label }: { fallback: string; label?: string }) {
  const router = useRouter();
  const t = useMessages();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="inline-flex h-10 items-center gap-2 self-start rounded-full border-[1.5px] border-linea bg-superficie pl-3 pr-4 text-[14px] font-semibold hover:border-tinta"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {label ?? t.common.back}
    </button>
  );
}
