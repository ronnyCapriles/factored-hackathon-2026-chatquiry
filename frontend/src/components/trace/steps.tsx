import type { Messages } from "@/i18n/config";
import type { TraceStatus, TraceStep } from "@/lib/api/types";

export const TRACE_STATUS_CLS: Record<TraceStatus, string> = {
  allowed: "border-[1.5px] border-linea bg-fondo",
  classified: "border-[1.5px] border-linea bg-fondo",
  routed: "border-[1.5px] border-linea bg-fondo",
  ok: "border-[1.5px] border-linea bg-fondo",
  decision: "bg-marca",
  pending: "border-[1.5px] border-dashed border-punto bg-fondo",
  verified: "bg-tinta text-fondo",
  escalated: "bg-atencion",
  blocked: "bg-atencion",
};

/** The steps of one turn as a compact timeline. */
export function TraceSteps({ steps, t }: { steps: TraceStep[]; t: Messages }) {
  return (
    <ol className="flex flex-col border-l-2 border-linea pl-3">
      {steps.map((s, i) => (
        <li key={i} className="flex flex-col gap-1 py-1.5">
          <span className="flex items-center gap-2">
            <span className="tabular grow text-[13px] font-bold">{s.step}</span>
            <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TRACE_STATUS_CLS[s.status]}`}>{t.traces.status[s.status]}</span>
            <span className="tabular w-14 text-right text-[12px] text-muted">{s.ms} ms</span>
          </span>
          <span className="text-[13px] leading-snug text-tinta-3">{s.detail}</span>
        </li>
      ))}
    </ol>
  );
}
