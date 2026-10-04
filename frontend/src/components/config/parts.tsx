import type { ReactNode } from "react";
import { StateBubble } from "@/components/brand/sign";
import { ReadOnlyBadge } from "@/components/ui";
import { getMessages } from "@/i18n/server";
import type { ConversationState, FilterStrength, RoutingAction, ToolPermission } from "@/lib/api/types";

export async function ConfigHeader({ title, lead, aside }: { title: string; lead: string; aside?: ReactNode }) {
  const t = await getMessages();
  return (
    <header className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:gap-6">
      <div className="flex max-w-[760px] flex-col gap-2">
        <h1 className="text-[30px] font-bold tracking-tight">{title}</h1>
        <p className="text-[16px] leading-normal text-tinta-3">{lead}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {aside}
        <ReadOnlyBadge>{t.common.readOnly}</ReadOnlyBadge>
      </div>
    </header>
  );
}

export function Chip({ children, tone = "neutral", mono }: { children: ReactNode; tone?: "neutral" | "brand" | "ink" | "alert"; mono?: boolean }) {
  const tones = {
    neutral: "border-[1.5px] border-linea bg-fondo text-tinta",
    brand: "bg-marca-suave text-tinta border-[1.5px] border-punto",
    ink: "bg-tinta text-fondo",
    alert: "bg-atencion",
  };
  return (
    <span className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ${tones[tone]} ${mono ? "tabular" : ""}`}>
      {children}
    </span>
  );
}

const STRENGTH_LEVEL: Record<FilterStrength, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

export function StrengthMeter({ value, label, text }: { value: FilterStrength; label: string; text: string }) {
  const level = STRENGTH_LEVEL[value];
  return (
    <span className="inline-flex items-center gap-2" aria-label={`${label}: ${text}`}>
      <span className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-2.5 w-6 rounded-full ${i <= level ? "bg-tinta" : "bg-linea"}`} />
        ))}
      </span>
      <span className="w-16 text-[13px] font-semibold">{text}</span>
    </span>
  );
}

export function ThresholdBar({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative h-2.5 w-32 rounded-full bg-linea" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full bg-marca" style={{ width: `${value * 100}%` }} />
        <span className="absolute -top-1 h-[18px] w-[3px] rounded-full bg-tinta" style={{ left: `calc(${value * 100}% - 1.5px)` }} />
      </span>
      <span className="tabular text-[13px] font-bold">{value.toFixed(2)}</span>
    </span>
  );
}

export const PERMISSION_STATE: Record<ToolPermission, ConversationState> = {
  read: "ai_attending",
  customer_confirm: "waiting_customer",
  human_only: "needs_human",
};

export function PermissionBadge({ permission, label }: { permission: ToolPermission; label: string }) {
  const alert = permission === "human_only";
  return (
    <span className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full pl-1 pr-3 text-[13px] font-semibold ${alert ? "bg-atencion" : "border-[1.5px] border-linea bg-superficie"}`}>
      <StateBubble state={PERMISSION_STATE[permission]} size={22} inverse={alert} />
      {label}
    </span>
  );
}

export const ACTION_STATE: Record<RoutingAction, ConversationState> = {
  block: "needs_human",
  human: "with_human",
  abstain: "waiting_customer",
  route: "ai_attending",
};

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="etiqueta scroll-mt-6">
      {children}
    </h2>
  );
}
