import "server-only";
import { redirect } from "next/navigation";
import { LOCALE_HEADER } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { getStaffSession } from "../session";
import type { ChatquiryApi, ConversationFilter } from "./client";
import type {
  AuditEntry,
  ChatTurnResponse,
  Config,
  Conversation,
  ConversationSummary,
  ConversationUpdates,
  CustomerRecord,
  Dispute,
  EvalRunDetail,
  IntakeQuestions,
  Integrations,
  Message,
  Operations,
  Page,
  RolePermission,
  StaffProfile,
  StaffUser,
  TestCustomer,
  Trace,
} from "./types";

const BASE = (process.env.CHATQUIRY_API_URL || "http://127.0.0.1:8010").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`Chatquiry API ${status}: ${code}`);
  }
}

/** Calls the backend with the staff token and the UI locale. Pass a token only when the session cookie is not set yet. */
export function liveApi(explicitToken?: string): ChatquiryApi {
  async function call<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
    const token = auth ? (explicitToken ?? (await getStaffSession())?.token) : undefined;
    const headers = new Headers(init.headers);
    headers.set(LOCALE_HEADER, await getLocale());
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");

    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
    } catch (cause) {
      throw new Error(`Chatquiry API unreachable at ${BASE}`, { cause });
    }
    // The cookie and the token expire together, so a 401 here means the session is gone.
    if (res.status === 401 && token) redirect("/session/expired");
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
      throw new ApiError(res.status, typeof body?.detail === "string" ? body.detail : res.statusText);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** Not found is an expected answer for lookups by id. */
  async function find<T>(path: string): Promise<T | null> {
    try {
      return await call<T>(path);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  const id = encodeURIComponent;

  return {
    async authenticateStaff(email, password) {
      try {
        return await call<{ user: StaffUser; token: string; expiresAt: string }>(
          "/v1/auth/login",
          { method: "POST", body: JSON.stringify({ email, password }) },
          false,
        );
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 422)) return null;
        throw e;
      }
    },

    listConversations: (filter) => call<ConversationSummary[]>(`/v1/conversations?filter=${filter}`),
    conversationCounts: () => call<Record<ConversationFilter, number>>("/v1/conversations/counts"),
    getConversation: (cid) => find<Conversation>(`/v1/conversations/${id(cid)}`),
    conversationUpdates: (cid, after) =>
      call<ConversationUpdates>(`/v1/conversations/${id(cid)}/updates${after ? `?after=${encodeURIComponent(after)}` : ""}`),
    replyAsAgent: (cid, text) => call<Message>(`/v1/conversations/${id(cid)}/reply`, { method: "POST", body: JSON.stringify({ text }) }),
    resolveConversation: (cid) => call<void>(`/v1/conversations/${id(cid)}/resolve`, { method: "POST" }),
    returnToAi: (cid) => call<void>(`/v1/conversations/${id(cid)}/return`, { method: "POST" }),
    runHumanAction: (cid, actionId) => call<void>(`/v1/conversations/${id(cid)}/human-actions/${id(actionId)}`, { method: "POST" }),
    listCustomers: () => call<CustomerRecord[]>("/v1/customers"),
    getCustomer: (cid) => find<CustomerRecord>(`/v1/customers/${id(cid)}`),
    listDisputes: () => call<Dispute[]>("/v1/disputes"),
    getTrace: (tid) => find<Trace>(`/v1/traces/${id(tid)}`),

    getOperations: () => call<Operations>("/v1/operations"),
    getEvaluationRun: (cid) => find<EvalRunDetail>(`/v1/operations/evaluation/${id(cid)}`),
    getConfig: () => call<Config>("/v1/config"),
    saveIntakeQuestions: (questions) => call<IntakeQuestions>("/v1/config/intake/questions", { method: "PUT", body: JSON.stringify({ questions }) }),
    restoreIntakeQuestions: () => call<IntakeQuestions>("/v1/config/intake/questions", { method: "DELETE" }),
    listAudit(query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") params.set(k, String(v));
      return call<Page<AuditEntry>>(`/v1/audit?${params}`);
    },
    auditActors: () => call<string[]>("/v1/audit/actors"),
    listStaff: () => call<StaffProfile[]>("/v1/staff"),
    rolePermissions: () => call<RolePermission[]>("/v1/role-permissions"),
    getIntegrations: () => call<Integrations>("/v1/integrations"),

    // The backend reads the user from the token, so the id is not sent.
    getProfile: () => find<StaffProfile>("/v1/me/profile"),
    updateProfile: (_userId, update) => call<StaffProfile>("/v1/me/profile", { method: "PATCH", body: JSON.stringify(update) }),

    listTestCustomers: () => call<TestCustomer[]>("/v1/test-chat/customers"),
    testChatGreeting: (cid) => call<Message[]>(`/v1/test-chat/customers/${id(cid)}/greeting`),
    testChatTurn: (customerId, conversationId, text) =>
      call<ChatTurnResponse>("/v1/test-chat/turns", { method: "POST", body: JSON.stringify({ customerId, conversationId, text }) }),
  };
}
