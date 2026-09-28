import { PendingAction } from "@/components/crud";
import { Card, PageTitle, Table, Td, Th } from "@/components/ui";
import { FilterBar, FilterSelect } from "@/components/ui/filters";
import { Pagination } from "@/components/ui/pagination";
import { api } from "@/lib/api";
import type { AuditEntry, AuditOutcome } from "@/lib/api/types";
import { getMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getMessages()).audit.title };
}

const PAGE_SIZE = 25;
const OUTCOME_CLS: Record<AuditOutcome, string> = {
  allowed: "border-[1.5px] border-linea bg-fondo",
  verified: "bg-tinta text-fondo",
  flagged: "bg-marca",
  denied: "bg-atencion",
};
const PERIOD_DAYS: Record<string, number> = { today: 0, "7d": 6, "14d": 13 };
const TODAY = "2026-09-28";

function fromDate(days: number) {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default async function AuditPage({ searchParams }: PageProps<"/app/audit">) {
  await requireStaff("admin");
  const [sp, t] = await Promise.all([searchParams, getMessages()]);
  const m = t.audit;
  const periodLabel: Record<string, string> = { today: m.today, "7d": m.last7, "14d": m.last14 };
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const page = Math.max(1, Number(str("page")) || 1);
  const period = str("period");

  const [result, actors] = await Promise.all([
    api().listAudit({
      q: str("q"),
      actorKind: str("kind") as AuditEntry["actorKind"] | undefined,
      outcome: str("outcome") as AuditOutcome | undefined,
      actor: str("actor"),
      from: period && period in PERIOD_DAYS ? fromDate(PERIOD_DAYS[period]) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    api().auditActors(),
  ]);

  return (
    <div className="flex flex-col gap-5 px-8 py-7">
      <PageTitle
        aside={
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-muted">{m.retention}</span>
            <PendingAction action={m.exportAction}>{m.export}</PendingAction>
          </div>
        }
      >
        {m.title}
      </PageTitle>

      <FilterBar search searchPlaceholder={m.searchPlaceholder}>
        <FilterSelect name="period" label={m.period} value={period} options={Object.keys(PERIOD_DAYS).map((value) => ({ value, label: periodLabel[value] }))} />
        <FilterSelect name="kind" label={m.type} value={str("kind")} options={Object.entries(m.kinds).map(([value, label]) => ({ value, label }))} />
        <FilterSelect name="actor" label={m.actor} value={str("actor")} options={actors.map((a) => ({ value: a, label: a }))} />
        <FilterSelect name="outcome" label={m.outcome} value={str("outcome")} options={Object.entries(m.outcomes).map(([value, label]) => ({ value, label }))} />
      </FilterBar>

      <Card className="flex flex-col gap-4 px-6 py-4">
        <Table>
          <thead>
            <tr>
              <Th className="w-[120px]">{m.date}</Th>
              <Th className="w-[90px]">{m.time}</Th>
              <Th className="w-[140px]">{m.actor}</Th>
              <Th className="w-[90px]">{m.type}</Th>
              <Th>{m.action}</Th>
              <Th className="w-[140px]">{m.object}</Th>
              <Th className="w-[130px]">{m.outcome}</Th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((e) => (
              <tr key={e.id}>
                <Td className="tabular text-[13px]">{e.date === TODAY ? m.todayShort : e.date}</Td>
                <Td className="tabular">{e.at}</Td>
                <Td className={e.actorKind === "ai" ? "font-semibold text-marca-texto" : "font-semibold"}>{e.actor}</Td>
                <Td className="text-muted">{m.kinds[e.actorKind]}</Td>
                <Td>{e.action}</Td>
                <Td className="tabular text-[13px]">{e.target}</Td>
                <Td>
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ${OUTCOME_CLS[e.outcome]}`}>{m.outcomes[e.outcome]}</span>
                </Td>
              </tr>
            ))}
            {result.items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-tinta-3">
                  {m.empty}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={result.total}
          basePath="/app/audit"
          params={{ q: str("q"), period, kind: str("kind"), actor: str("actor"), outcome: str("outcome") }}
        />
      </Card>
    </div>
  );
}
