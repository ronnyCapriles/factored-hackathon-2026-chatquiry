"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/feedback/modal";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui";
import { useMessages } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { restoreIntakeQuestions, saveIntakeQuestions } from "@/lib/actions";
import type { IntakeQuestion, IntakeQuestions } from "@/lib/api/types";

type Tab = "questions" | "request";

const field = "w-full rounded-fila border-[1.5px] border-linea bg-superficie px-3.5 text-[14px] focus:border-tinta";

/** Shows the exact request the intake classifier receives and lets an admin reword its questions. */
export function IntakeQuestionsCard({ intake, thresholds }: { intake: IntakeQuestions; thresholds: Record<string, string> }) {
  const t = useMessages();
  const m = t.routing.jev;
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("questions");
  const [draft, setDraft] = useState<Record<string, IntakeQuestion>>(intake.questions);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const changed = JSON.stringify(draft) !== JSON.stringify(intake.questions);
  const request = JSON.stringify({ ...JSON.parse(intake.request), questions: draft }, null, 2);
  const feeds = m.feeds as Record<string, string>;
  const count = Object.keys(intake.questions).length;

  function show(which: Tab) {
    setDraft(intake.questions);
    setError(null);
    setTab(which);
    setOpen(true);
  }

  function edit(key: string, change: Partial<IntakeQuestion>) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...change } }));
  }

  async function run(action: () => Promise<{ error?: string; ok?: boolean }>, done: string) {
    setSaving(true);
    setError(null);
    try {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      toast({ kind: "success", title: done, duration: 3500 });
      setOpen(false);
      router.refresh();
    } catch {
      toast({ kind: "error", title: m.failed, duration: 5000 });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <span className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[16px] font-bold">{intake.provider}</span>
            <span className="tabular text-[13px] text-tinta-3">{intake.model}</span>
          </span>
          <span
            className={`inline-flex h-7 items-center rounded-full px-3 text-[12px] font-semibold ${intake.active ? "bg-tinta text-fondo" : "border-[1.5px] border-dashed border-punto"}`}
          >
            {intake.active ? m.active : fmt(m.fallback, { name: intake.fallback })}
          </span>
        </span>
        <span className="tabular truncate text-[12px] text-muted" title={intake.endpoint}>
          POST {intake.endpoint}
        </span>
        <span className="text-[13px] leading-snug text-tinta-3">
          {fmt(m.summary, { n: count })}{" "}
          {intake.isDefault ? m.defaultWording : fmt(m.customWording, { v: intake.version ?? 1, who: intake.updatedBy ?? "—", at: intake.updatedAt ?? "" })}
        </span>
        <span className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => show("request")}>
            {m.seeRequest}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => show("questions")}>
            {m.edit}
          </Button>
        </span>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={m.title}
        description={m.lead}
        size="lg"
        footer={
          <>
            {!intake.isDefault && (
              <Button variant="tertiary" size="sm" disabled={saving} onClick={() => run(restoreIntakeQuestions, m.restored)} className="mr-auto">
                {m.restore}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button size="sm" disabled={!changed || saving} onClick={() => run(() => saveIntakeQuestions(draft), m.saved)}>
              {saving ? m.saving : m.save}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex gap-1 self-start rounded-full bg-fondo p-1" role="tablist">
            {(["questions", "request"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`h-9 rounded-full px-4 text-[14px] font-semibold ${tab === k ? "bg-tinta text-fondo" : "hover:bg-superficie"}`}
              >
                {m.tabs[k]}
              </button>
            ))}
          </div>

          {error && (
            <p className="rounded-fila border-2 border-atencion px-4 py-3 text-[14px] font-semibold" role="alert">
              {fmt(m.rejected, { reason: error })}
            </p>
          )}

          {tab === "questions" ? (
            <div className="flex flex-col gap-4">
              <p className="text-[13px] text-muted">{m.shapeNote}</p>
              {Object.entries(draft).map(([key, q]) => (
                <section key={key} className="flex flex-col gap-2.5 rounded-fila border-[1.5px] border-linea p-4">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="tabular text-[15px] font-bold">{key}</span>
                    <span className="tabular rounded-full bg-fondo px-2 py-0.5 text-[12px] font-semibold">{q.type}</span>
                    <span className="text-[13px] text-tinta-3">{fmt(feeds[key] ?? "", thresholds)}</span>
                  </span>
                  <label className="sr-only" htmlFor={`q-${key}`}>{fmt(m.instructionsFor, { key })}</label>
                  <textarea id={`q-${key}`} value={q.instructions} rows={2} maxLength={1000} onChange={(e) => edit(key, { instructions: e.target.value })} className={`${field} resize-y py-2.5`} />
                  {q.criteria && (
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
                      {Object.entries(q.criteria).map(([choice, text]) => (
                        <label key={choice} className="contents">
                          <span className="tabular text-[13px] font-semibold">{choice}</span>
                          <input value={text} maxLength={300} onChange={(e) => edit(key, { criteria: { ...q.criteria, [choice]: e.target.value } })} className={`${field} h-10`} />
                        </label>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="flex items-center justify-between gap-3">
                <span className="tabular text-[13px] text-tinta-3">POST {intake.endpoint}</span>
                <Button size="sm" variant="tertiary" onClick={() => navigator.clipboard?.writeText(request).then(() => toast({ kind: "success", title: m.copied, duration: 2500 }))}>
                  {m.copy}
                </Button>
              </span>
              <pre className="tabular max-h-[52dvh] overflow-auto whitespace-pre-wrap break-words rounded-fila bg-panel px-5 py-4 text-[12.5px] leading-[1.6] text-panel-texto">{request}</pre>
              <p className="text-[13px] text-muted">{m.requestNote}</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
