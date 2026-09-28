"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PendingAction } from "@/components/crud";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui";
import { useMessages } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import type { Conversation, Message } from "@/lib/api/types";

export function ConversationPanel({
  conversation,
  agentName,
  readOnly = false,
  assignee,
}: {
  conversation: Conversation;
  agentName: string;
  readOnly?: boolean;
  assignee?: string;
}) {
  const t = useMessages();
  const c = t.conversations;
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const humanActive = !readOnly && (conversation.state === "with_human" || conversation.state === "needs_human");
  const aiName = conversation.handoff?.fromProfile;

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages]);

  useEffect(() => {
    const onSuggestion = (e: Event) => setDraft((e as CustomEvent<string>).detail);
    window.addEventListener("cq:use-suggestion", onSuggestion);
    return () => window.removeEventListener("cq:use-suggestion", onSuggestion);
  }, []);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const at = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    setMessages((m) => [...m, { id: crypto.randomUUID(), author: "human", authorName: agentName, text, at }]);
    setDraft("");
    toast({ kind: "info", title: c.sentTitle, message: c.sentMessage, duration: 3500 });
  }

  const meta = [
    t.languages[conversation.language],
    conversation.country,
    t.channels[conversation.channel],
    conversation.handedOffAt && aiName ? fmt(c.handedOff, { ai: aiName, time: conversation.handedOffAt }) : null,
    assignee ? fmt(c.attendedBy, { name: assignee }) : null,
  ].filter(Boolean);

  return (
    <section className="flex min-h-0 flex-col" aria-label={fmt(c.withCustomer, { name: conversation.customerName })}>
      <div className="flex h-16 shrink-0 items-center gap-3.5 border-b-[1.5px] border-linea bg-superficie px-[22px]">
        <div className="flex min-w-0 grow flex-col">
          <span className="text-[17px] font-bold">{conversation.customerName}</span>
          <span className="truncate text-[13px] text-muted">{meta.join(" · ")}</span>
        </div>
        <Link href={`/app/customers/${conversation.customerId}`} className="text-[14px] font-semibold underline underline-offset-4">
          {t.common.customerFile}
        </Link>
        <Link href={`/app/traces/${conversation.traceId}`} className="text-[14px] font-semibold underline underline-offset-4">
          {t.common.seeTrace}
        </Link>
        {humanActive && (
          <>
            <PendingAction
              action={aiName ? fmt(c.returnAction, { ai: aiName }) : c.returnGeneric}
              confirm={aiName ? fmt(c.returnConfirm, { ai: aiName }) : undefined}
            >
              {aiName ? fmt(c.returnTo, { ai: aiName }) : c.returnGeneric}
            </PendingAction>
            <PendingAction action={c.resolveAction} variant="ink" confirm={c.resolveConfirm}>
              {c.resolve}
            </PendingAction>
          </>
        )}
      </div>

      <div className="flex min-h-0 grow flex-col gap-2 overflow-y-auto px-[26px] py-[18px] text-[15px] leading-[1.42]" aria-live="polite">
        <span className="grow" />
        {messages.map((m) =>
          m.author === "system" ? (
            <p key={m.id} className="self-center py-1.5 text-[12px] text-muted">
              {m.text} · {m.at}
            </p>
          ) : (
            <div key={m.id} className={`flex max-w-[70%] flex-col gap-1 ${m.author === "customer" ? "self-start" : "items-end self-end"}`}>
              <span className={`text-[12px] font-semibold ${m.author === "ai" ? "text-marca-texto" : m.author === "human" ? "text-tinta" : "text-muted"}`}>
                {m.author === "ai" ? `${m.authorName} · ${c.aiTag}` : m.author === "human" && m.authorName === agentName ? c.you : m.authorName}
              </span>
              <p
                className={
                  m.author === "customer"
                    ? "rounded-[18px_18px_18px_4px] border-[1.5px] border-linea bg-superficie px-3.5 py-2.5"
                    : m.author === "ai"
                      ? "rounded-[18px_18px_4px_18px] bg-marca-suave px-3.5 py-2.5"
                      : "rounded-[18px_18px_4px_18px] bg-tinta px-3.5 py-2.5 text-fondo"
                }
              >
                {m.text}
              </p>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      {readOnly && <p className="shrink-0 border-t-[1.5px] border-linea bg-superficie px-[22px] py-4 text-[14px] text-muted">{c.supervision}</p>}
      {humanActive && (
        <form
          className="flex shrink-0 gap-2.5 border-t-[1.5px] border-linea bg-superficie px-[22px] pb-[18px] pt-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="reply" className="sr-only">{c.replyLabel}</label>
          <input
            id="reply"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={c.replyPlaceholder}
            className="h-12 grow rounded-full border-[1.5px] border-linea bg-fondo px-[18px] text-[15px]"
          />
          <Button type="submit" disabled={!draft.trim()}>{c.send}</Button>
        </form>
      )}
    </section>
  );
}
