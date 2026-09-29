import Link from "next/link";
import { StateBubble } from "@/components/brand/sign";
import { Card, Label, PageTitle, ReadOnlyBadge, Table, Td, Th } from "@/components/ui";
import { api } from "@/lib/api";
import { getMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getMessages()).operations.title };
}

const ALERT_LINK: Record<string, string> = {
  no_human_reply: "/app/conversations?f=human",
  guardrail_blocks: "/app/audit",
  lang_gap: "/app/conversations?f=all",
  cost_over: "/app/config/profiles",
};

export default async function OperationsPage() {
  await requireStaff("admin");
  const [ops, counts, t] = await Promise.all([api().getOperations(), api().conversationCounts(), getMessages()]);
  const m = t.operations;
  const dash = (v: string | number | null | undefined) => v ?? "—";

  const live = [
    { state: "ai_attending" as const, label: m.liveAi, value: counts.ai, href: "/app/conversations?f=ai" },
    { state: "needs_human" as const, label: m.liveHuman, value: counts.human, href: "/app/conversations?f=human" },
    { state: "resolved" as const, label: m.liveResolved, value: counts.resolved, href: "/app/conversations?f=resolved" },
  ];

  return (
    <div className="flex flex-col gap-6 px-8 py-7">
      <PageTitle>{m.title}</PageTitle>

      <section className="grid grid-cols-3 gap-4" aria-label={m.live}>
        {live.map((l) => (
          <Link key={l.label} href={l.href} className="flex items-center gap-4 rounded-tarjeta border-[1.5px] border-linea bg-superficie px-5 py-4 hover:border-tinta">
            <StateBubble state={l.state} size={44} />
            <span className="flex grow flex-col">
              <span className="text-[14px] text-tinta-3">{l.label}</span>
              <span className="font-display text-[36px] leading-none">{l.value}</span>
            </span>
            <span className="text-[14px] font-semibold underline underline-offset-4">{t.common.view}</span>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="eval">
        <div className="flex items-center justify-between">
          <h2 id="eval" className="etiqueta">{m.evalTitle}</h2>
          {ops.sample && <ReadOnlyBadge>{m.noData}</ReadOnlyBadge>}
        </div>
        <div className="grid grid-cols-6 gap-3.5">
          {ops.kpis.map((k, i) => (
            <Card key={k.key} emphasis={i === 0} className="flex flex-col gap-1.5 px-[18px] py-4">
              <Label>{k.label}</Label>
              <span className={k.display ? "font-display text-[40px] leading-none" : "tabular text-[26px] font-bold leading-[1.5]"}>{dash(k.value)}</span>
              <span className="text-[13px] text-muted">{k.hint}</span>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_440px] items-start gap-5">
        <Card className="flex flex-col gap-2 px-6 py-5">
          <Label>{m.segmentsTitle}</Label>
          <Table>
            <thead>
              <tr>
                <Th>{m.group}</Th>
                <Th align="right">{m.n}</Th>
                <Th align="right">{m.aiResolved}</Th>
                <Th align="right">{m.withHuman}</Th>
                <Th align="right">{m.unsafe}</Th>
              </tr>
            </thead>
            <tbody>
              {ops.segments.map((s) => (
                <tr key={s.group}>
                  <Td className="font-semibold">{s.group}</Td>
                  <Td align="right" className="tabular">{dash(s.n)}</Td>
                  <Td align="right" className="tabular">{dash(s.aiResolved)}</Td>
                  <Td align="right" className="tabular">{dash(s.withHuman)}</Td>
                  <Td align="right" className="tabular">{dash(s.unsafe)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-[13px] text-muted">{m.offlineNote}</p>
        </Card>

        <Card className="flex flex-col gap-3 px-6 py-5">
          <Label>{m.alerts}</Label>
          {ops.alerts.map((a) => (
            <Link key={a.id} href={ALERT_LINK[a.id] ?? "/app/operations"} className="flex items-center gap-3 rounded-fila bg-fondo px-4 py-3 hover:ring-2 hover:ring-tinta">
              <span className={`size-2.5 shrink-0 rounded-full ${a.severe ? "bg-atencion" : "bg-punto"}`} aria-hidden="true" />
              <span className="flex grow flex-col">
                <span className="text-[15px] font-semibold">{a.title}</span>
                <span className="text-[13px] text-muted">{a.hint}</span>
              </span>
              <span className="tabular font-bold">{dash(a.value)}</span>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
