import { StateBubble } from "@/components/brand/sign";
import { DeleteButton, EntityFormButton, PendingIcon } from "@/components/crud";
import { ruleFields } from "@/components/crud/forms";
import { IntakeQuestionsCard } from "@/components/config/intake-questions";
import { ACTION_STATE, ConfigHeader, SectionTitle, ThresholdBar } from "@/components/config/parts";
import { Card } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";

export async function generateMetadata() {
  return { title: (await getMessages()).routing.title };
}

export default async function RoutingPage() {
  const [cfg, t] = await Promise.all([api().getConfig(), getMessages()]);
  const m = t.routing;
  const fields = ruleFields(t, cfg.departments.filter((d) => d.id !== "DEP-INTAKE").map((d) => d.name).concat(t.departments.security));
  const thresholds = Object.fromEntries(cfg.intake.signals.filter((s) => typeof s.threshold === "number").map((s) => [s.name, s.threshold!.toFixed(2)]));
  const counters = ["security_strikes", "frustration_hits", "human_requests"] as const;

  return (
    <>
      <ConfigHeader title={m.title} lead={m.lead} aside={<EntityFormButton mode="create" title={m.new} action={m.createAction} fields={fields} initial={{ priority: cfg.routing.length + 1 }} />} />

      <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-5">
        <ol className="flex flex-col gap-3" aria-label={m.ordered}>
          {cfg.routing.map((r) => {
            const alert = r.action === "block";
            return (
              <li key={r.id} id={r.id} className="scroll-mt-6">
                <Card className="grid grid-cols-[56px_minmax(0,1fr)_auto_auto] items-center gap-5 px-5 py-4">
                  <span className="flex size-12 items-center justify-center rounded-full border-2 border-tinta font-display text-[22px]">{r.priority}</span>
                  <div className="flex min-w-0 flex-col gap-2">
                    <span className="flex items-baseline gap-2.5">
                      <span className="tabular text-[13px] font-bold text-muted">{r.id}</span>
                      <span className="text-[17px] font-bold">{r.name}</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                      <span className="font-semibold text-muted">{m.if}</span>
                      {r.when.map((c, i) => (
                        <span key={c.signal + i} className="flex items-center gap-1.5">
                          {i > 0 && <span className="font-semibold text-muted">{m.and}</span>}
                          <span className="tabular inline-flex h-7 items-center gap-1 rounded-full border-[1.5px] border-linea bg-fondo px-2.5">
                            {c.signal} <b>{c.op}</b> {c.value}
                          </span>
                        </span>
                      ))}
                      <span className="font-semibold text-muted">→</span>
                      <span className="font-semibold">{r.destination}</span>
                    </div>
                  </div>
                  <span className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full pl-1.5 pr-3.5 text-[14px] font-semibold ${alert ? "bg-atencion" : "border-[1.5px] border-linea"}`}>
                    <StateBubble state={ACTION_STATE[r.action]} size={26} inverse={alert} />
                    {t.config.action[r.action]}
                  </span>
                  <span className="flex gap-1.5">
                    <PendingIcon action={fmt(m.raiseAction, { id: r.id })} label={fmt(m.raise, { id: r.id })} path="M12 19V5M5 12l7-7 7 7" />
                    <PendingIcon action={fmt(m.lowerAction, { id: r.id })} label={fmt(m.lower, { id: r.id })} path="M12 5v14M5 12l7 7 7-7" />
                    <EntityFormButton
                      mode="edit"
                      title={m.editTitle}
                      action={m.saveAction}
                      iconOnly
                      fields={fields}
                      initial={{ name: r.name, priority: r.priority, signal: r.when[0]?.signal, op: r.when[0]?.op, value: r.when[0]?.value, action: t.config.action[r.action] }}
                    />
                    <DeleteButton title={m.deleteTitle} action={m.deleteAction} name={`${r.id} · ${r.name}`} consequence={m.deleteConsequence} iconOnly />
                  </span>
                </Card>
              </li>
            );
          })}
          <li className="rounded-tarjeta border-[1.5px] border-dashed border-punto px-5 py-4 text-[14px] text-tinta-3">{m.fallback}</li>
        </ol>

        <div className="flex flex-col gap-5">
          <Card className="flex scroll-mt-6 flex-col gap-3 p-6">
            <span id="intake" className="scroll-mt-6">
              <SectionTitle>{m.jev.section}</SectionTitle>
            </span>
            <IntakeQuestionsCard intake={cfg.intake.questions} thresholds={thresholds} />
          </Card>
          <Card className="flex flex-col gap-3 p-6">
            <SectionTitle>{m.signals}</SectionTitle>
            {cfg.intake.signals.map((s) => (
              <div key={s.name} className="flex flex-col gap-1 border-b border-linea-2 pb-3 last:border-0 last:pb-0">
                <span className="flex items-center justify-between gap-3">
                  <span className="tabular text-[14px] font-bold">{s.name}</span>
                  {typeof s.threshold === "number" ? <ThresholdBar value={s.threshold} /> : <span className="text-[12px] text-muted">{t.config.category}</span>}
                </span>
                <span className="text-[13px] text-tinta-3">{s.description}</span>
              </div>
            ))}
            <span className="text-[12px] text-muted">{m.thresholdsNote}</span>
          </Card>
          <Card className="flex flex-col gap-3 p-6">
            <SectionTitle>{m.counters.title}</SectionTitle>
            <p className="text-[13px] leading-snug text-tinta-3">{m.counters.lead}</p>
            {counters.map((c) => (
              <div key={c} className="flex flex-col gap-1 border-b border-linea-2 pb-3 last:border-0 last:pb-0">
                <span className="flex items-center justify-between gap-3">
                  <span className="tabular text-[14px] font-bold">{c}</span>
                  <span className="text-[12px] text-muted">{t.config.counter}</span>
                </span>
                <span className="text-[13px] text-tinta-3">{fmt(m.counters[c], thresholds)}</span>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <span className="tabular text-[14px] font-bold">guardrail</span>
              <span className="text-[13px] text-tinta-3">{m.counters.guardrail}</span>
            </div>
          </Card>
        </div>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="ex">
        <SectionTitle id="ex">{m.examples}</SectionTitle>
        <div className="grid grid-cols-2 gap-5">
          {cfg.routingExamples.map((e) => {
            const rule = cfg.routing.find((r) => r.id === e.matched);
            return (
              <Card key={e.message} className="flex flex-col gap-4 p-6">
                <p lang={e.language} className="self-start rounded-[18px_18px_18px_4px] bg-tinta px-4 py-3 text-[15px] text-fondo">{e.message}</p>
                <div className="flex flex-wrap gap-1.5">
                  {e.signals.map((s) => (
                    <span key={s.name} className="tabular inline-flex h-7 items-center rounded-full border-[1.5px] border-linea bg-fondo px-2.5 text-[13px]">
                      {s.name} = {s.value}
                      {typeof s.confidence === "number" && <span className="ml-1.5 text-muted">{fmt(m.confidence, { n: s.confidence.toFixed(2) })}</span>}
                    </span>
                  ))}
                </div>
                {rule && (
                  <a href={`#${rule.id}`} className="flex items-center gap-3 rounded-fila border-2 border-tinta bg-marca-suave px-4 py-3">
                    <StateBubble state={ACTION_STATE[rule.action]} size={28} />
                    <span className="flex flex-col">
                      <span className="text-[13px] text-muted">{m.matches}</span>
                      <span className="font-bold">
                        {rule.id} · {rule.name} → {rule.destination}
                      </span>
                    </span>
                  </a>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}
