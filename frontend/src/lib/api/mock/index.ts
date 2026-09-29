import type { ChatquiryApi, ConversationFilter } from "../client";
import { HUMAN_STATES } from "../client";
import type { ConversationSummary, StaffProfile } from "../types";
import { chatTurn, greeting } from "./chat-engine";
import * as f from "./fixtures";

const byFilter = (filter: ConversationFilter) => (c: ConversationSummary) => {
  switch (filter) {
    case "human":
      return HUMAN_STATES.includes(c.state);
    case "ai":
      return c.state === "ai_attending" || c.state === "waiting_customer";
    case "resolved":
      return c.state === "resolved";
    default:
      return true;
  }
};

const summary = (c: (typeof f.conversations)[number]): ConversationSummary => ({
  id: c.id,
  customerId: c.customerId,
  customerName: c.customerName,
  customerInitials: c.customerInitials,
  language: c.language,
  channel: c.channel,
  state: c.state,
  lastMessage: c.lastMessage,
  lastAt: c.lastAt,
  assignedTo: c.assignedTo,
});

/** In-memory profile edits. */
const profiles: Map<string, StaffProfile> = ((globalThis as { __cqProfiles?: Map<string, StaffProfile> }).__cqProfiles ??= new Map(
  f.staff.map((s) => [s.id, structuredClone(s)]),
));

export const mockApi: ChatquiryApi = {
  async authenticateStaff(email, password) {
    const p = f.staff.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!p || password !== f.DEMO_PASSWORD) return null;
    const { id, name, initials, role, specialty } = p;
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    return { user: { id, name, initials, email: p.email, role, specialty }, token: `mock.${id}`, expiresAt };
  },

  async listConversations(filter) {
    return f.conversations.map(summary).filter(byFilter(filter));
  },
  async conversationCounts() {
    const all = f.conversations.map(summary);
    return {
      human: all.filter(byFilter("human")).length,
      ai: all.filter(byFilter("ai")).length,
      resolved: all.filter(byFilter("resolved")).length,
      all: all.length,
    };
  },
  async getConversation(id) {
    return f.conversations.find((c) => c.id === id) ?? null;
  },
  async listCustomers() {
    return f.customers;
  },
  async getCustomer(id) {
    return f.customers.find((c) => c.id === id) ?? null;
  },
  async listDisputes() {
    return f.disputes;
  },
  async getTrace(id) {
    const known = f.traces.find((t) => t.id === id);
    if (known) return known;
    const conv = f.conversations.find((c) => c.traceId === id);
    if (!conv) return null;
    const escalated = HUMAN_STATES.includes(conv.state);
    return {
      id,
      conversationId: conv.id,
      outcome: escalated ? "Traspaso a persona" : conv.state === "resolved" ? "Resuelta por IA" : "En curso",
      aiLatency: "—",
      tokens: 0,
      cost: null,
      steps: [
        { t: "0.000", step: "intake.guardrail", detail: "Bedrock Guardrails · sin hallazgos", status: "allowed", ms: 0 },
        { t: "0.100", step: "intake.laya", detail: `idioma ${conv.language}`, status: "classified", ms: 0 },
        ...(conv.handoff
          ? [{ t: "—", step: "handoff.create", detail: `${conv.handoff.id} · ${conv.handoff.reason}`, status: "escalated" as const, ms: 0 }]
          : []),
      ],
      rules: conv.handoff ? [conv.handoff.policyRule] : [],
      versions: ["modelo mistral-large-3", "prompt lia@v0.3"],
    };
  },

  async getOperations() {
    return f.operations;
  },
  async getConfig() {
    return f.config;
  },
  async listAudit(query) {
    const q = query.q?.toLowerCase();
    const rows = f.audit.filter(
      (e) =>
        (!q || `${e.action} ${e.target} ${e.actor} ${e.id}`.toLowerCase().includes(q)) &&
        (!query.actorKind || e.actorKind === query.actorKind) &&
        (!query.outcome || e.outcome === query.outcome) &&
        (!query.actor || e.actor === query.actor) &&
        (!query.from || e.date >= query.from) &&
        (!query.to || e.date <= query.to),
    );
    const start = (query.page - 1) * query.pageSize;
    return { items: rows.slice(start, start + query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize };
  },
  async auditActors() {
    return [...new Set(f.audit.map((e) => e.actor))].sort();
  },
  async listStaff() {
    return [...profiles.values()];
  },
  async rolePermissions() {
    return f.rolePermissions;
  },
  async getIntegrations() {
    return f.integrations;
  },

  async getProfile(userId) {
    const stored = profiles.get(userId);
    const defaults = f.staff.find((s) => s.id === userId);
    // Stored edits can predate newer fields, so fill the gaps from the fixture.
    return stored && defaults ? { ...defaults, ...stored } : (stored ?? null);
  },
  async updateProfile(userId, update) {
    const current = await mockApi.getProfile(userId);
    if (!current) throw new Error("unknown user");
    const next = { ...current, ...update, avatarUrl: update.avatarUrl === "" ? undefined : (update.avatarUrl ?? current.avatarUrl) };
    profiles.set(userId, next);
    return next;
  },

  async listTestCustomers() {
    return f.testCustomers.map(({ customerId, firstName, fullName, country, language, hint }) => ({
      customerId,
      firstName,
      fullName,
      country,
      language,
      hint,
    }));
  },
  async testChatGreeting(customerId) {
    return greeting(customerId);
  },
  async testChatTurn(customerId, conversationId, text) {
    return chatTurn(customerId, conversationId, text);
  },
};
