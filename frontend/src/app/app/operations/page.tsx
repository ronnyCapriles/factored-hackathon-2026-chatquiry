import Link from "next/link";
import { StateBubble } from "@/components/brand/sign";
import { Card, Label, PageTitle, ReadOnlyBadge, Table, Td, Th } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { api } from "@/lib/api";
import type { EvalRun } from "@/lib/api/types";
import { fmt } from "@/i18n/config";
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

const RUN_FILTERS = ["all", "failed", "person"] as const;
const SCENARIOS_PER_PAGE = 10;
type RunFilter = (typeof RUN_FILTERS)[number];

function byScenario(runs: EvalRun[]) {
  const groups = new Map<string, EvalRun[]>();
  for (const r of runs) groups.set(r.scenario, [...(groups.get(r.scenario) ?? []), r]);
  return [...groups.values()].map((attempts) => attempts.sort((a, b) => a.attempt - b.attempt));
}

export default async function OperationsPage({ searchParams }: PageProps<"/app/operations">) {
  await requireStaff("admin");
  const [ops, counts, t, sp] = await Promise.all([api().getOperations(), api().conversationCounts(), getMessages(), searchParams]);
  const m = t.operations;
  const dash = (v: string | number | null | undefined) => v ?? "—";
  const filter: RunFilter = RUN_FILTERS.includes(sp.runs as RunFilter) ? (sp.runs as RunFilter) : "all";
  const scenarios = byScenario(ops.runs);
  const matches = {
    all: scenarios,
    failed: scenarios.filter((g) => g.some((r) => !r.passed)),
    person: scenarios.filter((g) => g[0].expected === "person"),
  };
  const pages = Math.max(1, Math.ceil(matches[filter].length / SCENARIOS_PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const shown = matches[filter].slice((page - 1) * SCENARIOS_PER_PAGE, page * SCENARIOS_PER_PAGE);

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

      <section className="flex flex-col gap-3" aria-labelledby="runs">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[760px] flex-col gap-1">
            <h2 id="runs" className="etiqueta scroll-mt-6">{m.runs.title}</h2>
            <p className="text-[14px] text-tinta-3">
              {m.runs.lead}
              {ops.runAt && <span className="text-muted"> {fmt(m.runs.runAt, { at: ops.runAt.replace("T", " ").slice(0, 16), n: ops.runs.length })}</span>}
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-superficie p-1 ring-[1.5px] ring-linea" role="tablist">
            {RUN_FILTERS.map((f) => (
              <Link
                key={f}
                href={`?runs=${f}#runs`}
                scroll={false}
                role="tab"
                aria-selected={filter === f}
                className={`flex h-9 items-center rounded-full px-4 text-[13px] font-semibold ${filter === f ? "bg-tinta text-fondo" : "hover:bg-fondo"}`}
              >
                {m.runs[f]} · {matches[f].length}
              </Link>
            ))}
          </div>
        </div>
        <Card className="px-6 py-3">
          {ops.runs.length === 0 ? (
            <p className="py-4 text-[14px] text-muted">{m.runs.empty}</p>
          ) : shown.length === 0 ? (
            <p className="py-4 text-[14px] text-muted">{m.runs.none}</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{m.runs.scenario}</Th>
                  <Th className="w-[110px]">{m.runs.language}</Th>
                  <Th className="w-[150px]">{m.runs.expected}</Th>
                  <Th className="w-[150px]">{m.runs.ended}</Th>
                  <Th className="w-[260px]">{m.runs.attempts}</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((attempts) => {
                  const first = attempts[0];
                  const withPerson = attempts.filter((r) => r.handedOff).length;
                  const known = attempts.some((r) => r.handedOff != null);
                  return (
                    <tr key={first.scenario}>
                      <Td>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-semibold">{first.title ?? first.scenario}</span>
                          {first.firstMessage && <span className="truncate text-[13px] text-tinta-3">“{first.firstMessage}”</span>}
                          {first.title && <span className="tabular text-[12px] text-muted">{first.scenario}</span>}
                        </span>
                      </Td>
                      <Td>{first.language && first.language in t.languages ? t.languages[first.language as keyof typeof t.languages] : "—"}</Td>
                      <Td>{first.expected === "person" ? m.runs.expectedPerson : first.expected === "ai" ? m.runs.expectedAi : "—"}</Td>
                      <Td className="tabular text-[13px]">
                        {known
                          ? [
                              attempts.length - withPerson > 0 && fmt(m.runs.endedAi, { n: attempts.length - withPerson, of: attempts.length }),
                              withPerson > 0 && fmt(m.runs.endedPerson, { n: withPerson, of: attempts.length }),
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : "—"}
                      </Td>
                      <Td>
                        <span className="flex flex-wrap gap-1.5">
                          {attempts.map((r) => {
                            const label = r.unsafe ? m.runs.unsafeTitle : r.passed ? m.runs.passedTitle : m.runs.failedTitle;
                            return (
                              <Link
                                key={r.conversation}
                                href={`/app/operations/evaluation/${r.conversation}`}
                                title={`${fmt(label, { n: r.attempt })}${r.handedOff ? ` · ${m.runs.handedOff}` : ""}`}
                                aria-label={fmt(label, { n: r.attempt })}
                                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold hover:ring-2 hover:ring-tinta ${
                                  r.passed ? "border-[1.5px] border-linea bg-fondo" : "bg-atencion"
                                }`}
                              >
                                <span aria-hidden="true">{r.unsafe ? "!" : r.passed ? "✓" : "✗"}</span>#{r.attempt}
                                {r.handedOff && <StateBubble state="with_human" size={16} />}
                              </Link>
                            );
                          })}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          {pages > 1 && (
            <div className="border-t-[1.5px] border-linea pb-1 pt-3">
              <Pagination page={page} pageSize={SCENARIOS_PER_PAGE} total={matches[filter].length} params={{ runs: filter }} basePath="/app/operations" anchor="runs" />
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
