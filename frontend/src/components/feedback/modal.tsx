"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";

// Native <dialog> gives focus trapping, Escape to close and the backdrop for free.
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useMessages();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const width = { sm: "w-[440px]", md: "w-[600px]", lg: "w-[820px]" }[size];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className={`modal m-auto max-h-[calc(100dvh-48px)] max-w-[calc(100vw-32px)] ${width} overflow-hidden rounded-telefono border-2 border-tinta bg-superficie p-0 text-tinta shadow-[10px_10px_0_var(--sombra)] backdrop:bg-[var(--backdrop)]`}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-52px)] flex-col">
          <header className="flex items-start gap-4 border-b-[1.5px] border-linea px-7 py-5">
            <div className="flex grow flex-col gap-1">
              <h2 id="modal-title" className="text-[22px] font-bold leading-tight">{title}</h2>
              {description && <p className="text-[14px] text-tinta-3">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label={t.common.close} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-fondo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          <div className="min-h-0 grow overflow-y-auto px-7 py-6">{children}</div>
          {footer && <footer className="flex items-center justify-end gap-3 border-t-[1.5px] border-linea bg-fondo px-7 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
