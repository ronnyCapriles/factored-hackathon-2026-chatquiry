"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";

/** From lg up, the sidebar and the page side by side. Below it, a top bar with a menu button that slides the sidebar in. */
export function StaffFrame({ brand, sidebar, children }: { brand: ReactNode; sidebar: ReactNode; children: ReactNode }) {
  const t = useMessages();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] lg:min-h-[640px] lg:grid-cols-[256px_minmax(0,1fr)] lg:grid-rows-1">
      <header className="flex h-14 items-center gap-2 border-b-[1.5px] border-linea bg-superficie px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="staff-nav"
          aria-label={t.nav.openMenu}
          className="flex size-10 items-center justify-center rounded-full hover:bg-fondo"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        {brand}
      </header>

      {open && <div className="fixed inset-0 z-30 bg-[var(--backdrop)] lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div
        id="staff-nav"
        // Picking a page closes the drawer.
        onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[85vw] transition-transform lg:static lg:z-auto lg:min-h-0 lg:w-auto lg:max-w-none lg:translate-x-0 lg:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </div>

      {children}
    </div>
  );
}
