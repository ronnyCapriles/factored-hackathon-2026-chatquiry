"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { StateBubble } from "@/components/brand/sign";
import { fmt } from "@/i18n/config";
import { useMessages } from "@/i18n/client";
import type { ConversationState } from "@/lib/api/types";

// Each toast drains a bar; hovering or focusing it pauses the countdown.

export type ToastKind = "success" | "info" | "pending" | "error";

interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  duration: number;
}

type ToastInput = Omit<Toast, "id" | "duration"> & { duration?: number };

const KIND: Record<ToastKind, { state: ConversationState; bar: string }> = {
  success: { state: "resolved", bar: "bg-tinta" },
  info: { state: "ai_attending", bar: "bg-marca" },
  pending: { state: "waiting_customer", bar: "bg-punto-2" },
  error: { state: "needs_human", bar: "bg-atencion" },
};

interface ToastApi {
  toast: (t: ToastInput) => void;
  /** Notice for actions whose UI exists but does not persist yet. */
  notImplemented: (action: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const t = useMessages();

  const dismiss = useCallback((id: string) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback((t: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((all) => [...all.slice(-3), { ...t, id, duration: t.duration ?? 5000 }]);
  }, []);

  const notImplemented = useCallback(
    (action: string) =>
      toast({ kind: "pending", title: t.toast.notImplementedTitle, message: fmt(t.toast.notImplementedMessage, { action }), duration: 6000 }),
    [toast, t],
  );

  return (
    <ToastContext.Provider value={{ toast, notImplemented }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[380px] max-w-[calc(100vw-40px)] flex-col gap-3" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const k = KIND[toast.kind];
  const t = useMessages();
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      tabIndex={0}
      className="toast group pointer-events-auto relative overflow-hidden rounded-tarjeta border-2 border-tinta bg-superficie shadow-[6px_6px_0_var(--sombra)]"
    >
      <div className="flex items-start gap-3 px-4 pb-4 pt-3.5">
        <StateBubble state={toast.kind === "error" ? "needs_human" : k.state} size={30} />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <span className="etiqueta text-[11px]">{t.toast[toast.kind]}</span>
          <span className="text-[15px] font-bold leading-snug">{toast.title}</span>
          {toast.message && <span className="text-[14px] leading-snug text-tinta-3">{toast.message}</span>}
        </div>
        <button type="button" onClick={onDone} aria-label={t.toast.close} className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-fondo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-1.5 bg-linea" aria-hidden="true">
        <span className={`toast-bar block h-full ${k.bar}`} style={{ animationDuration: `${toast.duration}ms` }} onAnimationEnd={onDone} />
      </span>
    </div>
  );
}
