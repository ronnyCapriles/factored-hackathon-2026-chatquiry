"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StateBubble } from "@/components/brand/sign";
import { Label } from "@/components/ui";
import { useLocale, useMessages } from "@/i18n/client";
import { LOCALE_HEADER, fmt } from "@/i18n/config";
import type { ChatTurnResponse, Language, Message, TraceStatus, TurnInspection } from "@/lib/api/types";

// Customer-facing copy follows the customer's language, not the staff UI language.
const COPY = {
  es: {
    online: "Banco LATAM · en línea",
    security: "Banco LATAM · seguridad",
    notice: "{ai} es la asistente virtual del banco. Puedes pedir hablar con una persona cuando quieras.",
    placeholder: "Mensaje",
    typing: "está escribiendo…",
    expired: "Tu sesión expiró por seguridad. Vuelve a ingresar para continuar.",
    error: "No pudimos enviar tu mensaje. Inténtalo de nuevo.",
  },
  pt: {
    online: "Banco LATAM · online",
    security: "Banco LATAM · segurança",
    notice: "{ai} é a assistente virtual do banco. Você pode pedir para falar com uma pessoa quando quiser.",
    placeholder: "Mensagem",
    typing: "está digitando…",
    expired: "Sua sessão expirou por segurança. Entre de novo para continuar.",
    error: "Não conseguimos enviar sua mensagem. Tente de novo.",
  },
};

const STATUS_CLS: Record<TraceStatus, string> = {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Humans don't answer instantly: pace each bubble by its length. */
const typingDelay = (text: string) => Math.min(2200, 500 + text.length * 18);

interface Props {
  customerId: string;
  language: Language;
  greeting: Message[];
  aiName: string;
  aiDisclosure: boolean;
}

export function TestChat({ customerId, language, greeting, aiName, aiDisclosure }: Props) {
  const ui = useMessages();
  const uiLocale = useLocale();
  const m = ui.testChat;
  const aiAgent = { name: aiName, initial: aiName[0] ?? "?", human: false };
  const [messages, setMessages] = useState<Message[]>(greeting);
  const [turns, setTurns] = useState<TurnInspection[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState<string | null>(null);
  const [agent, setAgent] = useState(aiAgent);
  const [notice, setNotice] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>(language);
  const endRef = useRef<HTMLDivElement>(null);
  const t = COPY[lang];
  const latest = turns.at(-1);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages, typing]);

  function restart() {
    setMessages(greeting);
    setTurns([]);
    setConversationId(null);
    setAgent(aiAgent);
    setNotice(null);
    setLang(language);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || typing) return;
    setDraft("");
    setNotice(null);
    const at = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    setMessages((m) => [...m, { id: crypto.randomUUID(), author: "customer", authorName: "Cliente", text, at }]);
    setTyping(agent.name);

    try {
      const res = await fetch("/api/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", [LOCALE_HEADER]: uiLocale },
        body: JSON.stringify({ customerId, conversationId, text }),
      });
      if (res.status === 401) {
        setNotice(COPY[lang].expired);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ChatTurnResponse;
      setConversationId(data.conversationId);
      setTurns((all) => [...all, data.inspection]);
      const replyLang = data.inspection.signals.find((s) => s.name === "language")?.value;
      if (replyLang === "es" || replyLang === "pt") setLang(replyLang);

      for (const reply of data.replies) {
        if (reply.author === "system") {
          setTyping(null);
          await sleep(900);
          setMessages((m) => [...m, reply]);
          // The system line announces the person who takes over; the header follows it.
          if (data.handedOff) setAgent({ name: data.inspection.profile, initial: data.inspection.profile[0] ?? "?", human: true });
          continue;
        }
        if (reply.author === "human") setAgent({ name: reply.authorName, initial: reply.authorName[0], human: true });
        setTyping(reply.authorName);
        await sleep(typingDelay(reply.text));
        setMessages((m) => [...m, reply]);
      }
    } catch {
      setNotice(COPY[lang].error);
    } finally {
      setTyping(null);
    }
  }

  return (
    <>
      <div className="flex justify-center">
        <div className="flex h-[min(780px,calc(100dvh-80px))] w-full max-w-[400px] flex-col overflow-hidden rounded-telefono border-2 border-tinta bg-superficie shadow-[8px_8px_0_var(--sombra)]">
          <header className="flex h-[76px] shrink-0 items-center gap-3 border-b-[1.5px] border-linea px-4">
            <span className={`flex size-[42px] items-center justify-center rounded-full text-[17px] font-bold ${agent.human ? "bg-tinta text-fondo" : "bg-marca"}`} aria-hidden="true">
              {agent.initial}
            </span>
            <div className="flex grow flex-col">
              <span className="text-[17px] font-bold">{agent.name}</span>
              <span className="text-[13px] text-muted">{agent.human ? t.security : t.online}</span>
            </div>
            <button type="button" onClick={restart} className="text-[13px] font-semibold text-tinta-3 underline underline-offset-4">
              {m.restart}
            </button>
          </header>

          <div className="flex min-h-0 grow flex-col gap-2 overflow-y-auto px-4 py-3.5 text-[15px] leading-[1.42]" aria-live="polite">
            {aiDisclosure && <p className="mx-auto mb-1.5 max-w-[290px] text-center text-[12px] text-muted">{fmt(t.notice, { ai: aiName })}</p>}
            {messages.map((m, i) => {
              if (m.author === "system") {
                return (
                  <p key={m.id} className="self-center py-1.5 text-[12px] text-muted">
                    {m.text} · {m.at}
                  </p>
                );
              }
              const mine = m.author === "customer";
              const continued = messages[i - 1]?.author === m.author;
              return (
                <p
                  key={m.id}
                  className={`max-w-[80%] px-3.5 py-2.5 ${
                    mine ? "self-end rounded-[18px_18px_4px_18px] bg-tinta text-fondo" : `self-start bg-fondo ${continued ? "rounded-[4px_18px_18px_4px]" : "rounded-[18px_18px_18px_4px]"}`
                  }`}
                >
                  {m.text}
                </p>
              );
            })}
            {typing && (
              <div className="flex items-center gap-2 pl-0.5">
                <span className="flex gap-[5px] rounded-[18px] bg-fondo px-3.5 py-3" aria-hidden="true">
                  <span className="typing-dot size-[7px] rounded-full bg-muted" />
                  <span className="typing-dot size-[7px] rounded-full bg-punto-2" />
                  <span className="typing-dot size-[7px] rounded-full bg-punto" />
                </span>
                <span className="text-[13px] text-muted">
                  {typing} {t.typing}
                </span>
              </div>
            )}
            {notice && (
              <p className="self-center py-1.5 text-center text-[13px] font-semibold text-atencion" role="alert">
                {notice}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="flex shrink-0 items-center gap-2.5 border-t-[1.5px] border-linea px-3.5 pb-5 pt-2.5">
            <label htmlFor="msg" className="sr-only">{t.placeholder}</label>
            <input id="msg" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.placeholder} autoComplete="off" maxLength={2000} className="h-12 grow rounded-full border-[1.5px] border-linea bg-fondo px-4 text-[15px]" />
            <button type="submit" aria-label="Enviar" disabled={!draft.trim() || !!typing} className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-tinta bg-marca disabled:opacity-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      <aside className="flex h-[min(780px,calc(100dvh-80px))] flex-col overflow-hidden rounded-tarjeta border-2 border-tinta bg-superficie" aria-label={m.inspector}>
        <div className="flex flex-col gap-3 border-b-[1.5px] border-linea px-5 py-4">
          <span className="etiqueta">{m.inspector}</span>
          {latest ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5">
                <StateBubble state={latest.state} size={34} />
                <span className="flex flex-col leading-tight">
                  <span className="text-[12px] text-muted">{m.state}</span>
                  <span className="text-[14px] font-bold">{ui.states[latest.state]}</span>
                </span>
              </div>
              <span className="flex flex-col leading-tight">
                <span className="text-[12px] text-muted">{m.department}</span>
                <span className="text-[14px] font-bold">{latest.department}</span>
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[12px] text-muted">{m.attending}</span>
                <span className="text-[14px] font-bold">{latest.profile}</span>
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[12px] text-muted">{m.rule}</span>
                <span className="text-[14px] font-bold">{latest.rule ? `${latest.rule.id} · ${latest.rule.name}` : "—"}</span>
              </span>
            </div>
          ) : (
            <p className="text-[14px] text-tinta-3">{m.empty}</p>
          )}
        </div>

        <ol className="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-5 py-4">
          {[...turns].reverse().map((turn, idx) => (
            <li key={turns.length - idx} className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label>{fmt(m.turn, { n: turns.length - idx })}</Label>
                <span className="tabular text-[12px] text-muted">{(turn.totalMs / 1000).toFixed(2)} s</span>
              </div>
              <p className="rounded-fila bg-tinta px-3 py-2 text-[13px] text-fondo">“{turn.customerText}”</p>
              <div className="flex flex-wrap gap-1.5">
                {turn.signals.map((s) => (
                  <span key={s.name} className="tabular inline-flex h-6 items-center rounded-full border-[1.5px] border-linea bg-fondo px-2 text-[12px]">
                    {s.name}={s.value}
                    {typeof s.confidence === "number" && <span className="ml-1 text-muted">({s.confidence.toFixed(2)})</span>}
                  </span>
                ))}
              </div>
              <ol className="flex flex-col border-l-2 border-linea pl-3">
                {turn.steps.map((s, i) => (
                  <li key={i} className="flex flex-col gap-1 py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="tabular grow text-[13px] font-bold">{s.step}</span>
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLS[s.status]}`}>{ui.traces.status[s.status]}</span>
                      <span className="tabular w-14 text-right text-[12px] text-muted">{s.ms} ms</span>
                    </span>
                    <span className="text-[13px] leading-snug text-tinta-3">{s.detail}</span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>

        <div className="border-t-[1.5px] border-linea px-5 py-3 text-[13px] text-muted">
          {conversationId ? (
            <span>
              {fmt(m.conversation, { id: conversationId })} ·{" "}
              <Link href="/app/traces/CNV-7A31" className="font-semibold text-tinta underline underline-offset-4">
                {m.sampleTrace}
              </Link>
            </span>
          ) : (
            m.idle
          )}
        </div>
      </aside>
    </>
  );
}
