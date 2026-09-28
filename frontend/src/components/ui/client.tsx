"use client";

import type { ReactNode } from "react";
import { StateBubble } from "@/components/brand/sign";
import { useMessages } from "@/i18n/client";
import type { ConversationState } from "@/lib/api/types";

export function StateChip({ state, suffix, small }: { state: ConversationState; suffix?: string; small?: boolean }) {
  const t = useMessages();
  const alert = state === "needs_human";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-full font-semibold ${
        small ? "h-7 pl-1 pr-3 text-[12px]" : "h-9 pl-1.5 pr-4 text-[14px]"
      } ${alert ? "bg-atencion" : "border-[1.5px] border-linea bg-superficie text-tinta"}`}
    >
      <StateBubble state={state} size={small ? 20 : 26} inverse={alert} />
      {t.states[state]}
      {suffix ? ` · ${suffix}` : ""}
    </span>
  );
}

export function ReadOnlyBadge({ children }: { children?: ReactNode }) {
  const t = useMessages();
  return (
    <span className="inline-flex h-8 items-center rounded-full border-[1.5px] border-dashed border-punto bg-superficie px-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
      {children ?? t.common.readOnly}
    </span>
  );
}
