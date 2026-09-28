import Link from "next/link";
import { VerifiedMark } from "@/components/brand/sign";
import { KeyValue, Label, Perforado } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";
import type { Conversation } from "@/lib/api/types";
import { HumanActionButton, UseSuggestionButton } from "./copilot-actions";

export async function CopilotPanel({ conversation, readOnly = false }: { conversation: Conversation; readOnly?: boolean }) {
  const [customer, t] = await Promise.all([api().getCustomer(conversation.customerId), getMessages()]);
  const c = t.copilot;
  const h = conversation.handoff;

  return (
    <aside className="flex min-h-0 flex-col gap-3.5 overflow-y-auto border-l-[1.5px] border-linea bg-superficie px-5 py-[18px]" aria-label={c.label}>
      {h ? (
        <>
          <div className="flex items-center gap-2.5">
            <VerifiedMark size={30} />
            <div className="flex flex-col">
              <span className="text-[16px] font-bold">{fmt(c.handoffFrom, { ai: h.fromProfile })}</span>
              <span className="text-[12px] text-muted">
                {h.reason} · {c.rule} <span className="tabular">{h.policyRule}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{c.facts}</Label>
            {h.facts.map((f) => (
              <KeyValue key={f.label} k={f.label} v={f.source} mono />
            ))}
          </div>
          <Perforado />

          <div className="flex flex-col gap-1.5">
            <Label>{c.done}</Label>
            {h.actions.length ? (
              h.actions.map((a) => (
                <p key={a.description} className="text-[14px]">
                  <span className="tabular mr-2 text-[12px] text-muted">{a.at}</span>
                  {a.description}
                </p>
              ))
            ) : (
              <p className="text-[14px] text-muted">{c.noneYet}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{readOnly ? c.pending : c.pendingForYou}</Label>
            {h.pending.map((p) => (
              <p key={p} className="text-[14px]">{p}</p>
            ))}
            {!readOnly && h.humanActions.map((a) => <HumanActionButton key={a.id} label={a.label} />)}
          </div>

          {h.suggestion && !readOnly && (
            <div className="flex flex-col gap-2 rounded-fila bg-fondo p-3.5">
              <Label className="text-marca-texto">{c.suggestion}</Label>
              <p className="text-[14px]">“{h.suggestion}”</p>
              <UseSuggestionButton text={h.suggestion} />
            </div>
          )}
          <Perforado />
        </>
      ) : (
        <p className="text-[14px] text-muted">{c.noHandoff}</p>
      )}

      {customer && (
        <div className="flex flex-col gap-1.5">
          <Label>{c.customer}</Label>
          <KeyValue k={c.segment} v={customer.segment} />
          <KeyValue k={c.since} v={customer.customerSince} />
          {customer.contactHistory.slice(0, 2).map((x) => (
            <KeyValue key={x.label} k={x.label} v={x.value} />
          ))}
          <Link href={`/app/customers/${customer.id}`} className="mt-1 text-[14px] font-semibold underline underline-offset-4">
            {c.fullFile}
          </Link>
        </div>
      )}
    </aside>
  );
}
