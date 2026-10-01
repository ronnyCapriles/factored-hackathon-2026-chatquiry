"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { StateBubble } from "@/components/brand/sign";
import { TRACE_STATUS_CLS } from "@/components/trace/steps";
import type { Messages } from "@/i18n/config";
import type { ConversationState, TraceStatus } from "@/lib/api/types";

type Copy = Messages["landing"]["hero"]["demo"];
type Tag = { key: keyof Copy; status: TraceStatus };

type Item =
  | { id: number; kind: "customer" | "ai" | "human" | "system"; text: string }
  | { id: number; kind: "tags"; tags: Tag[] };

type Step =
  | { kind: "type"; text: keyof Copy }
  | { kind: "say"; who: "ai" | "human" | "system"; text: keyof Copy; typing?: number }
  | { kind: "tags"; tags: Tag[] }
  | { kind: "state"; state: ConversationState }
  | { kind: "wait"; ms: number };

// One unrecognized purchase, from the first message to the person who takes over.
const SCRIPT: Step[] = [
  { kind: "wait", ms: 700 },
  { kind: "type", text: "c1" },
  { kind: "tags", tags: [{ key: "guard", status: "allowed" }, { key: "intent", status: "classified" }] },
  { kind: "tags", tags: [{ key: "find", status: "ok" }] },
  { kind: "say", who: "ai", text: "a1", typing: 1400 },
  { kind: "state", state: "waiting_customer" },
  { kind: "wait", ms: 900 },
  { kind: "type", text: "c2" },
  { kind: "state", state: "ai_attending" },
  { kind: "tags", tags: [{ key: "policy", status: "decision" }, { key: "yes", status: "verified" }] },
  { kind: "tags", tags: [{ key: "opened", status: "verified" }] },
  { kind: "say", who: "ai", text: "a2", typing: 1600 },
  { kind: "tags", tags: [{ key: "handoff", status: "escalated" }] },
  { kind: "state", state: "needs_human" },
  { kind: "wait", ms: 1200 },
  { kind: "say", who: "system", text: "joined" },
  { kind: "state", state: "with_human" },
  { kind: "say", who: "human", text: "h1", typing: 1500 },
];

const FINAL = (() => {
  const items: Item[] = [];
  const trail: ConversationState[] = ["ai_attending"];
  for (const step of SCRIPT) {
    if (step.kind === "type") items.push({ id: items.length, kind: "customer", text: step.text });
    if (step.kind === "say") items.push({ id: items.length, kind: step.who, text: step.text });
    if (step.kind === "tags") items.push({ id: items.length, kind: "tags", tags: step.tags });
    if (step.kind === "state") trail.push(step.state);
  }
  return { items, trail };
})();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REDUCED = "(prefers-reduced-motion: reduce)";

function onMotionChange(listener: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function SampleChat({ copy, states, label }: { copy: Copy; states: Messages["states"]; label: string }) {
  const reduced = useSyncExternalStore(
    onMotionChange,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
  const [played, setPlayed] = useState<Item[]>([]);
  const [path, setPath] = useState<ConversationState[]>(["ai_attending"]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState<"ai" | "human" | null>(null);
  const [fading, setFading] = useState(false);
  // Without motion the whole conversation shows at once.
  const items = reduced ? FINAL.items : played;
  const trail = reduced ? FINAL.trail : path;
  const state = trail.at(-1)!;
  const human = state === "with_human";

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    let id = 0;
    const push = (item: Item) => setPlayed((all) => [...all, item]);

    (async () => {
      while (alive) {
        setPlayed([]);
        setPath(["ai_attending"]);
        setFading(false);
        for (const step of SCRIPT) {
          if (!alive) return;
          if (step.kind === "wait") await sleep(step.ms);
          if (step.kind === "state") setPath((t) => [...t, step.state]);
          if (step.kind === "tags") {
            await sleep(450);
            push({ id: id++, kind: "tags", tags: step.tags });
            await sleep(550);
          }
          if (step.kind === "type") {
            const text = copy[step.text];
            for (let i = 1; i <= text.length && alive; i++) {
              setDraft(text.slice(0, i));
              await sleep(32);
            }
            await sleep(350);
            setDraft("");
            push({ id: id++, kind: "customer", text: step.text });
          }
          if (step.kind === "say") {
            if (step.typing) {
              setTyping(step.who === "human" ? "human" : "ai");
              await sleep(step.typing);
              setTyping(null);
            }
            push({ id: id++, kind: step.who, text: step.text });
            await sleep(500);
          }
        }
        await sleep(5000);
        setFading(true);
        await sleep(600);
      }
    })();
    return () => {
      alive = false;
    };
  }, [copy, reduced]);

  return (
    <figure className="flex flex-col gap-3" aria-label={label}>
      <div className="flex flex-col overflow-hidden rounded-telefono border-2 border-tinta bg-superficie shadow-[8px_8px_0_var(--sombra)]">
        <header className="flex items-center gap-3 border-b-[1.5px] border-linea px-5 py-3.5">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-[16px] font-bold transition-colors duration-500 ${human ? "bg-tinta text-fondo" : "bg-marca"}`}
            aria-hidden="true"
          >
            {human ? "A" : <StateBubble state="resolved" size={24} onBrand />}
          </span>
          <span className="flex min-w-0 grow flex-col leading-tight">
            <span className="text-[16px] font-bold">{copy.bank}</span>
            <span className="truncate text-[13px] text-muted">{human ? copy.agent : copy.online}</span>
          </span>
          <span key={state} className="rise">
            <StateBubble state={state} size={30} />
          </span>
        </header>

        <div
          aria-hidden="true"
          className={`flex h-[380px] flex-col justify-end gap-2 overflow-hidden px-5 py-4 text-[15px] leading-[1.4] transition-opacity duration-500 [mask-image:linear-gradient(to_bottom,transparent,black_56px)] ${fading ? "opacity-0" : "opacity-100"}`}
        >
          {items.map((item) => {
            if (item.kind === "tags") {
              return (
                <div key={item.id} className="rise flex flex-wrap gap-1.5 self-start">
                  {item.tags.map((tag) => (
                    <span key={tag.key} className={`tabular inline-flex h-6 items-center rounded-full px-2 text-[11.5px] font-semibold ${TRACE_STATUS_CLS[tag.status]}`}>
                      {copy[tag.key]}
                    </span>
                  ))}
                </div>
              );
            }
            if (item.kind === "system") {
              return (
                <p key={item.id} className="rise flex items-center gap-2 self-center py-1 text-[12px] text-muted">
                  <StateBubble state="with_human" size={16} />
                  {copy[item.text as keyof Copy]}
                </p>
              );
            }
            const mine = item.kind === "customer";
            return (
              <p
                key={item.id}
                className={`rise max-w-[84%] px-3.5 py-2.5 ${
                  mine
                    ? "self-end rounded-[18px_18px_4px_18px] bg-tinta text-fondo"
                    : item.kind === "human"
                      ? "self-start rounded-[18px_18px_18px_4px] border-[1.5px] border-tinta bg-superficie"
                      : "self-start rounded-[18px_18px_18px_4px] bg-marca-suave"
                }`}
              >
                {copy[item.text as keyof Copy]}
              </p>
            );
          })}
          {typing && (
            <span className="rise flex items-center gap-2 self-start">
              <span className={`flex gap-[5px] rounded-[18px] px-3.5 py-3 ${typing === "human" ? "border-[1.5px] border-tinta" : "bg-marca-suave"}`}>
                <span className="typing-dot size-[7px] rounded-full bg-muted" />
                <span className="typing-dot size-[7px] rounded-full bg-punto-2" />
                <span className="typing-dot size-[7px] rounded-full bg-punto" />
              </span>
              <span className="text-[12px] text-muted">{copy.typing}</span>
            </span>
          )}
        </div>

        <div aria-hidden="true" className="flex items-center gap-2.5 border-t-[1.5px] border-linea px-4 py-3">
          <span className="flex h-11 min-w-0 grow items-center overflow-hidden rounded-full border-[1.5px] border-linea bg-fondo px-4 text-[14px]">
            {draft ? (
              <span className="truncate">
                {draft}
                <span className="caret ml-px inline-block h-4 w-[2px] translate-y-[3px] bg-tinta" />
              </span>
            ) : (
              <span className="text-muted">{copy.composer}</span>
            )}
          </span>
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-tinta bg-marca transition-transform ${draft ? "scale-105" : "opacity-60"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>

        <div aria-hidden="true" className="flex items-center gap-2 border-t-[1.5px] border-dashed border-linea bg-fondo px-5 py-2.5">
          <span className="etiqueta text-[11px]">{copy.trail}</span>
          <span key={state} className="rise grow truncate text-[13px] font-semibold">{states[state]}</span>
          <span className="flex shrink-0 items-center gap-1">
            {trail.map((s, i) => (
              <span key={i} className="rise flex items-center gap-1">
                {i > 0 && <span className="h-[2px] w-3 rounded-full bg-punto" />}
                <span title={states[s]} className={i === trail.length - 1 ? "" : "opacity-50"}>
                  <StateBubble state={s} size={20} />
                </span>
              </span>
            ))}
          </span>
        </div>
      </div>

      <figcaption className="px-1 text-[13px] leading-snug text-muted">{copy.legend}</figcaption>

      <ol className="sr-only">
        {FINAL.items.map((item) =>
          item.kind === "tags" ? (
            <li key={item.id}>{item.tags.map((tag) => copy[tag.key]).join(", ")}</li>
          ) : (
            <li key={item.id}>{copy[item.text as keyof Copy]}</li>
          ),
        )}
      </ol>
    </figure>
  );
}
