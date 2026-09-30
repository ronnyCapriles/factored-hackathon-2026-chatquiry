"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PendingAction } from "@/components/crud";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui";
import { useMessages } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { replyToCustomer, resolveConversation, returnConversationToAi } from "@/lib/actions";
import type { Conversation, ConversationUpdates, Message } from "@/lib/api/types";

const POLL_MS = 4000;

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
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const lastId = useRef<string | null>(conversation.messages.at(-1)?.id ?? null);
  const endRef = useRef<HTMLDivElement>(null);
  const humanActive = !readOnly && (conversation.state === "with_human" || conversation.state === "needs_human");
  const aiName = conversation.handoff?.fromProfile;

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages]);

  useEffect(() => {
    const onSuggestion = (e: Event) => setDraft((e as CustomEvent<string>).detail);
    window.addEventListener("cq:use-suggestion", onSuggestion);
    return () => window.removeEventListener("cq:use-suggestion", onSuggestion);
  }, []);

  function append(incoming: Message[]) {
    if (!incoming.length) return;
    lastId.current = incoming.at(-1)!.id;
    setMessages((current) => {
      const seen = new Set(current.map((m) => m.id));
      return [...current, ...incoming.filter((m) => !seen.has(m.id))];
    });
  }

  // New customer messages and state changes show up without reloading while the conversation is open.
  useEffect(() => {
    if (conversation.state === "resolved") return;
    const timer = setInterval(async () => {
      try {
        const after = lastId.current ? `?after=${encodeURIComponent(lastId.current)}` : "";
        const res = await fetch(`/api/conversations/${conversation.id}/updates${after}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ConversationUpdates;
        append(data.messages);
        if (data.state !== conversation.state) router.refresh();
      } catch {
        // A missed poll is retried on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [conversation.id, conversation.state, router]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const message = await replyToCustomer(conversation.id, text);
      if (!message) return;
      append([message]);
      setDraft("");
      toast({ kind: "success", title: c.sentTitle, message: c.sentMessage, duration: 3000 });
      if (conversation.state !== "with_human") router.refresh();
    } catch {
      toast({ kind: "error", title: c.actionFailed, duration: 5000 });
    } finally {
      setSending(false);
    }
  }

  async function act(run: (id: string) => Promise<void>, title: string) {
    try {
      await run(conversation.id);
      toast({ kind: "success", title, duration: 3500 });
      router.refresh();
    } catch {
      toast({ kind: "error", title: c.actionFailed, duration: 5000 });
    }
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
              confirm={aiName ? fmt(c.returnConfirm, { ai: aiName }) : c.returnGeneric}
              onConfirm={() => act(returnConversationToAi, fmt(c.returnedToast, { ai: aiName ?? "" }))}
            >
              {aiName ? fmt(c.returnTo, { ai: aiName }) : c.returnGeneric}
            </PendingAction>
            <PendingAction action={c.resolveAction} variant="ink" confirm={c.resolveConfirm} onConfirm={() => act(resolveConversation, c.resolvedToast)}>
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
            void send();
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
          <Button type="submit" disabled={!draft.trim() || sending}>{c.send}</Button>
        </form>
      )}
    </section>
  );
}
