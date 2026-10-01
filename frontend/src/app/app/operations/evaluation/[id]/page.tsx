import { notFound } from "next/navigation";
import { TraceSteps } from "@/components/trace/steps";
import { ButtonLink, Card, KeyValue, Label } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";
import type { ConversationState } from "@/lib/api/types";
import { requireStaff } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/app/operations/evaluation/[id]">) {
  return { title: `${(await getMessages()).operations.runs.title} ${(await params).id}` };
}

export default async function EvaluationRunPage({ params }: PageProps<"/app/operations/evaluation/[id]">) {
  await requireStaff("admin");
  const { id } = await params;
  const [run, t, cfg] = await Promise.all([api().getEvaluationRun(id), getMessages(), api().getConfig()]);
  if (!run) notFound();
  const department = cfg.departments.find((d) => d.id === run.department)?.name ?? run.department;
  const m = t.operations.run;
  const steps = run.trace?.steps ?? [];
  // Older traces have no turn numbers; their steps are listed once at the end.
  const byTurn = steps.some((s) => s.turn != null);
  const result = run.unsafe ? m.unsafe : run.passed ? m.passed : m.failed;
  const state = run.state && run.state in t.states ? t.states[run.state as ConversationState] : run.state;

  return (
    <div className="flex flex-col gap-5 px-8 py-7">
      <div className="flex flex-wrap items-center gap-3">
        <BackLink fallback="/app/operations" label={m.back} />
        <span className="grow" />
        {run.live && (
          <>
            <ButtonLink href={`/app/conversations?f=all&c=${run.conversation}`} variant="secondary" size="sm">
              {m.openLive}
            </ButtonLink>
            <ButtonLink href={`/app/traces/${run.conversation}`} variant="secondary" size="sm">
              {m.seeTrace}
            </ButtonLink>
          </>
        )}
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold tracking-tight">{run.title ?? run.scenario}</h1>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {run.title && <span className="tabular rounded-full border-[1.5px] border-linea bg-superficie px-2.5 py-0.5">{run.scenario}</span>}
          <span className="rounded-full border-[1.5px] border-linea bg-superficie px-2.5 py-0.5">{fmt(m.attempt, { n: run.attempt })}</span>
          {run.language && <span className="rounded-full border-[1.5px] border-linea bg-superficie px-2.5 py-0.5 uppercase">{run.language}</span>}
          {run.expected && (
            <span className="rounded-full border-[1.5px] border-linea bg-superficie px-2.5 py-0.5">
              {t.operations.runs.expected} {run.expected === "person" ? t.operations.runs.expectedPerson : t.operations.runs.expectedAi}
            </span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${run.passed ? "bg-tinta text-fondo" : "bg-atencion"}`}>{result}</span>
          <span className="tabular text-muted">{run.conversation}</span>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5">
        <Card className="flex flex-col gap-6 px-7 py-6">
          {run.turns.length === 0 && <p className="text-[15px] text-tinta-3">{m.notStored}</p>}
          {run.turns.map((turn, i) => (
            <section key={i} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <Label>{fmt(m.turn, { n: i + 1 })}</Label>
                <span className="tabular text-[12px] text-muted">{(turn.ms / 1000).toFixed(2)} s</span>
              </div>
              <div className="flex flex-col gap-2 text-[15px] leading-[1.42]">
                <p className="max-w-[70%] self-start rounded-[18px_18px_18px_4px] border-[1.5px] border-linea bg-superficie px-3.5 py-2.5">{turn.sent}</p>
                {turn.replies.map((r, j) =>
                  r.author === "system" ? (
                    <p key={j} className="self-center py-1 text-[12px] text-muted">{r.text}</p>
                  ) : (
                    <div key={j} className="flex max-w-[70%] flex-col items-end gap-1 self-end">
                      {r.name && <span className={`text-[12px] font-semibold ${r.author === "ai" ? "text-marca-texto" : "text-tinta"}`}>{r.name}</span>}
                      <p className={`rounded-[18px_18px_4px_18px] px-3.5 py-2.5 ${r.author === "ai" ? "bg-marca-suave" : "bg-tinta text-fondo"}`}>{r.text}</p>
                    </div>
                  ),
                )}
              </div>
              {byTurn && <TraceSteps steps={steps.filter((s) => s.turn === i + 1)} t={t} />}
            </section>
          ))}
          {!byTurn && steps.length > 0 && (
            <section className="flex flex-col gap-3">
              <Label>{m.otherSteps}</Label>
              <TraceSteps steps={steps} t={t} />
            </section>
          )}
        </Card>

        <aside className="sticky top-7 flex flex-col gap-4">
          {(run.checks.length > 0 || run.failed.length > 0 || run.error) && (
            <Card emphasis className="flex flex-col gap-2.5 p-5">
              <Label>{m.checks}</Label>
              {run.checks.length === 0 && run.failed.map((f) => <span key={f} className="tabular text-[13px]">✗ {f}</span>)}
              {run.checks.map((c) => (
                <div key={c.name} className="flex flex-col gap-0.5">
                  <span className={`tabular flex items-center gap-2 text-[14px] font-semibold ${c.passed ? "" : "text-atencion"}`}>
                    <span aria-hidden="true">{c.passed ? "✓" : "✗"}</span>
                    {c.name}
                    {c.safety && <span className="rounded-full border-[1.5px] border-linea px-1.5 text-[11px] text-muted">safety</span>}
                  </span>
                  {c.detail && <span className="pl-5 text-[13px] text-tinta-3">{c.detail}</span>}
                </div>
              ))}
              {run.error && <KeyValue k={m.error} v={run.error} mono />}
            </Card>
          )}
          {(run.customer || state || run.trace) && (
            <Card className="flex flex-col gap-3 p-5">
              <Label>{m.summary}</Label>
              {run.customer && <KeyValue k={m.customer} v={run.customer} />}
              {state && <KeyValue k={m.finalState} v={state} />}
              {department && <KeyValue k={m.department} v={department} />}
              {run.handedOff != null && <KeyValue k={m.handedOff} v={run.handedOff ? t.common.yes : t.common.no} />}
              {run.trace && <KeyValue k={m.latency} v={run.trace.aiLatency} />}
              {run.trace && <KeyValue k={m.tokens} v={run.trace.tokens.toLocaleString()} />}
              {run.trace?.cost && <KeyValue k={m.cost} v={run.trace.cost} />}
            </Card>
          )}
          {run.trace && (
            <Card className="flex flex-col gap-2.5 p-5">
              <Label>{m.rules}</Label>
              {run.trace.rules.length ? run.trace.rules.map((r) => <span key={r} className="tabular text-[14px]">{r}</span>) : <span className="text-[14px] text-muted">{t.common.none}</span>}
              <Label className="pt-2">{m.versions}</Label>
              {run.trace.versions.map((v) => (
                <span key={v} className="tabular text-[13px]">{v}</span>
              ))}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
