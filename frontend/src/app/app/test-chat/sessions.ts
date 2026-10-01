import { useSyncExternalStore } from "react";
import type { ChatLanguage, Message, TurnInspection } from "@/lib/api/types";

export interface ChatAgent {
  name: string;
  initial: string;
  human: boolean;
}

export interface ChatSession {
  messages: Message[];
  turns: TurnInspection[];
  conversationId: string | null;
  agent: ChatAgent;
  lang: ChatLanguage;
  typing: string | null;
  notice: "expired" | "error" | null;
  // Last message the server sent; after a handoff the person's replies arrive by polling from here.
  lastServerId: string | null;
}

// Module state outlives client navigation but not a reload, so switching customers keeps each chat.
let sessions: Record<string, ChatSession> = {};
const listeners = new Set<() => void>();
const NONE: Record<string, ChatSession> = {};

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function agentFor(name: string, human = false): ChatAgent {
  return { name, initial: name[0] ?? "?", human };
}

export function freshSession(greeting: Message[], lang: ChatLanguage, aiName: string): ChatSession {
  return { messages: greeting, turns: [], conversationId: null, agent: agentFor(aiName), lang, typing: null, notice: null, lastServerId: null };
}

export function updateSession(id: string, base: () => ChatSession, change: (s: ChatSession) => Partial<ChatSession>) {
  const current = sessions[id] ?? base();
  sessions = { ...sessions, [id]: { ...current, ...change(current) } };
  emit();
}

export function readSession(id: string): ChatSession | undefined {
  return sessions[id];
}

export function clearSession(id: string) {
  sessions = Object.fromEntries(Object.entries(sessions).filter(([key]) => key !== id));
  emit();
}

export function useSession(id: string): ChatSession | undefined {
  return useSyncExternalStore(
    subscribe,
    () => sessions[id],
    () => undefined,
  );
}

export function useSessions(): Record<string, ChatSession> {
  return useSyncExternalStore(
    subscribe,
    () => sessions,
    () => NONE,
  );
}
