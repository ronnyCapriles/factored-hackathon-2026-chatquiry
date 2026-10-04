"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StateBubble } from "@/components/brand/sign";
import { TraceSteps } from "@/components/trace/steps";
import { Label } from "@/components/ui";
import { useLocale, useMessages } from "@/i18n/client";
import { LOCALE_HEADER, fmt } from "@/i18n/config";
import type { ChatLanguage, ChatTurnResponse, ConversationUpdates, Language, Message } from "@/lib/api/types";
import { agentFor, clearSession, freshSession, readSession, updateSession, useSession, type ChatSession } from "./sessions";

// Customer-facing copy follows the customer's language, not the staff UI language.
const COPY: Record<ChatLanguage, Record<string, string>> = {
  es: {
    online: "Banco LATAM · en línea",
    team: "Banco LATAM · equipo de atención",
    notice: "{ai} es la asistente virtual del banco. Puedes pedir hablar con una persona cuando quieras.",
    placeholder: "Mensaje",
    send: "Enviar",
    typing: "está escribiendo…",
    expired: "Tu sesión expiró por seguridad. Vuelve a ingresar para continuar.",
    error: "No pudimos enviar tu mensaje. Inténtalo de nuevo.",
  },
  pt: {
    online: "Banco LATAM · online",
    team: "Banco LATAM · equipe de atendimento",
    notice: "{ai} é a assistente virtual do banco. Você pode pedir para falar com uma pessoa quando quiser.",
    placeholder: "Mensagem",
    send: "Enviar",
    typing: "está digitando…",
    expired: "Sua sessão expirou por segurança. Entre de novo para continuar.",
    error: "Não conseguimos enviar sua mensagem. Tente de novo.",
  },
  en: {
    online: "Banco LATAM · online",
    team: "Banco LATAM · service team",
    notice: "{ai} is the bank's virtual assistant. You can ask for a person at any time.",
    placeholder: "Message",
    send: "Send",
    typing: "is typing…",
    expired: "Your session expired for security. Sign in again to continue.",
    error: "We couldn't send your message. Please try again.",
  },
};


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_MS = 3000;
/** Humans don't answer instantly: pace each bubble by its length. */
const typingDelay = (text: string) => Math.min(2200, 500 + text.length * 18);
const isChatLanguage = (v: unknown): v is ChatLanguage => v === "es" || v === "pt" || v === "en";

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
  const base = () => freshSession(greeting, language, aiName);
  const session: ChatSession = useSession(customerId) ?? base();
  const { messages, turns, conversationId, agent, typing, notice } = session;
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const t = COPY[session.lang];
  const latest = turns.at(-1);
  const latestLang = latest?.signals.find((s) => s.name === "language")?.value;

  // Scrolls the message list only; scrollIntoView would also move the page on a phone, where the chat sits below the customers.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    if (!conversationId || !agent.human) return;
    const id = customerId;
    const timer = setInterval(async () => {
      try {
        const last = readSession(id)?.lastServerId;
        const after = last ? `?after=${encodeURIComponent(last)}` : "";
        const res = await fetch(`/api/conversations/${conversationId}/updates${after}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ConversationUpdates;
        // The customer's own messages are already on screen.
        const fresh = data.messages.filter((x) => x.author !== "customer");
        const responder = data.responder || aiName;
        updateSession(id, base, (s) => ({
          lastServerId: data.messages.at(-1)?.id ?? s.lastServerId,
          messages: fresh.length ? [...s.messages, ...fresh] : s.messages,
          agent: data.human ? (data.responder ? agentFor(data.responder, true) : s.agent) : agentFor(responder),
        }));
      } catch {
        // A missed poll is retried on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
    // base only rebuilds the same greeting; the poll restarts when the conversation or its owner changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, conversationId, agent.human, aiName]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || typing) return;
    // Replies land in this customer's chat even if the person switches to another one meanwhile.
    const id = customerId;
    const update = (change: (s: ChatSession) => Partial<ChatSession>) => updateSession(id, base, change);
    setDraft("");
    const at = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    update((s) => ({
      notice: null,
      typing: s.agent.name,
      messages: [...s.messages, { id: crypto.randomUUID(), author: "customer", authorName: "Cliente", text, at }],
    }));

    try {
      const res = await fetch("/api/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", [LOCALE_HEADER]: uiLocale },
        body: JSON.stringify({ customerId: id, conversationId: readSession(id)?.conversationId ?? null, text }),
      });
      if (res.status === 401) {
        update(() => ({ notice: "expired" }));
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ChatTurnResponse;
      const replyLang = data.inspection.signals.find((s) => s.name === "language")?.value;
      update((s) => ({
        conversationId: data.conversationId,
        lastServerId: data.replies.at(-1)?.id ?? s.lastServerId,
        turns: [...s.turns, data.inspection],
        lang: isChatLanguage(replyLang) ? replyLang : s.lang,
      }));

      for (const reply of data.replies) {
        if (reply.author === "system") {
          update(() => ({ typing: null }));
          await sleep(900);
          // The system line announces the person who takes over; the header follows it.
          update((s) => ({ messages: [...s.messages, reply], agent: data.handedOff ? agentFor(data.inspection.profile, true) : s.agent }));
          continue;
        }
        update((s) => ({ typing: reply.authorName, agent: reply.author === "human" ? agentFor(reply.authorName, true) : s.agent }));
        await sleep(typingDelay(reply.text));
        update((s) => ({ messages: [...s.messages, reply] }));
      }
    } catch {
      update(() => ({ notice: "error" }));
    } finally {
      update(() => ({ typing: null }));
    }
  }

  return (
    <>
      <section className="flex h-[78dvh] min-h-0 flex-col lg:h-auto" aria-label={m.title}>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b-[1.5px] border-linea bg-superficie px-[22px]">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-[16px] font-bold ${agent.human ? "bg-tinta text-fondo" : "bg-marca"}`} aria-hidden="true">
            {agent.initial}
          </span>
          <div className="flex min-w-0 grow flex-col">
            <span className="text-[17px] font-bold">{agent.name}</span>
            <span className="truncate text-[13px] text-muted">{agent.human ? t.team : t.online}</span>
          </div>
          <span className="rounded-full border-[1.5px] border-linea px-2.5 py-0.5 text-[12px] font-semibold text-tinta-3">{ui.languages[session.lang]}</span>
          <button type="button" onClick={() => clearSession(customerId)} title={m.restartHint} className="text-[14px] font-semibold underline underline-offset-4">
            {m.restart}
          </button>
        </header>

        <div ref={listRef} className="flex min-h-0 grow flex-col gap-2 overflow-y-auto px-[26px] py-[18px] text-[15px] leading-[1.42]" aria-live="polite">
          {aiDisclosure && <p className="mx-auto mb-2 max-w-[420px] text-center text-[12px] text-muted">{fmt(t.notice, { ai: aiName })}</p>}
          <span className="grow" />
          {messages.map((msg, i) => {
            if (msg.author === "system") {
              return (
                <p key={msg.id} className="self-center py-1.5 text-[12px] text-muted">
                  {msg.text} · {msg.at}
                </p>
              );
            }
            const mine = msg.author === "customer";
            const continued = messages[i - 1]?.author === msg.author;
            return (
              <div key={msg.id} className={`flex max-w-[68%] flex-col gap-1 ${mine ? "items-end self-end" : "self-start"}`}>
                {!mine && !continued && (
                  <span className={`text-[12px] font-semibold ${msg.author === "ai" ? "text-marca-texto" : "text-tinta"}`}>{msg.authorName}</span>
                )}
                <p
                  className={`px-3.5 py-2.5 ${
                    mine
                      ? "rounded-[18px_18px_4px_18px] bg-tinta text-fondo"
                      : msg.author === "ai"
                        ? `bg-marca-suave ${continued ? "rounded-[4px_18px_18px_4px]" : "rounded-[18px_18px_18px_4px]"}`
                        : `border-[1.5px] border-linea bg-superficie ${continued ? "rounded-[4px_18px_18px_4px]" : "rounded-[18px_18px_18px_4px]"}`
                  }`}
                >
                  {msg.text}
                </p>
              </div>
            );
          })}
          {typing && (
            <div className="flex items-center gap-2 pl-0.5">
              <span className="flex gap-[5px] rounded-[18px] bg-marca-suave px-3.5 py-3" aria-hidden="true">
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
              {t[notice]}
            </p>
          )}
        </div>

        <form onSubmit={send} className="flex shrink-0 items-center gap-2.5 border-t-[1.5px] border-linea bg-superficie px-[22px] pb-[18px] pt-3.5">
          <label htmlFor="msg" className="sr-only">{t.placeholder}</label>
          <input id="msg" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.placeholder} autoComplete="off" maxLength={2000} className="h-12 grow rounded-full border-[1.5px] border-linea bg-fondo px-[18px] text-[15px]" />
          <button type="submit" aria-label={t.send} disabled={!draft.trim() || !!typing} className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-tinta bg-marca disabled:opacity-50">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      </section>

      <aside className="flex h-[70dvh] min-h-0 flex-col border-t-[1.5px] border-linea bg-superficie lg:h-auto lg:border-l-[1.5px] lg:border-t-0" aria-label={m.inspector}>
        <div className="flex shrink-0 flex-col gap-3 border-b-[1.5px] border-linea px-5 py-4">
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
                <span className="text-[12px] text-muted">{m.language}</span>
                <span className="text-[14px] font-bold">{isChatLanguage(latestLang) ? ui.languages[latestLang] : "—"}</span>
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[12px] text-muted">{m.department}</span>
                <span className="text-[14px] font-bold">{latest.department}</span>
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[12px] text-muted">{m.attending}</span>
                <span className="text-[14px] font-bold">{latest.profile}</span>
              </span>
              <span className="col-span-2 flex flex-col leading-tight">
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
              <TraceSteps steps={turn.steps} t={ui} />
            </li>
          ))}
        </ol>

        <div className="shrink-0 border-t-[1.5px] border-linea px-5 py-3 text-[13px] text-muted">
          {conversationId ? (
            <span>
              {fmt(m.conversation, { id: conversationId })} ·{" "}
              <Link href={`/app/traces/${conversationId}`} className="font-semibold text-tinta underline underline-offset-4">
                {m.fullTrace}
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
