import type {
  AuditEntry,
  AuditQuery,
  ChatTurnResponse,
  Config,
  Conversation,
  ConversationState,
  ConversationSummary,
  ConversationUpdates,
  CustomerRecord,
  Dispute,
  EvalRunDetail,
  IntakeQuestion,
  IntakeQuestions,
  Integrations,
  Message,
  Operations,
  Page,
  ProfileUpdate,
  RolePermission,
  StaffProfile,
  StaffUser,
  TestCustomer,
  Trace,
} from "./types";

export type ConversationFilter = "human" | "ai" | "resolved" | "all";

export interface ChatquiryApi {
  authenticateStaff(email: string, password: string): Promise<{ user: StaffUser; token: string; expiresAt: string } | null>;

  listConversations(filter: ConversationFilter): Promise<ConversationSummary[]>;
  conversationCounts(): Promise<Record<ConversationFilter, number>>;
  getConversation(id: string): Promise<Conversation | null>;
  conversationUpdates(id: string, after: string | null): Promise<ConversationUpdates>;
  replyAsAgent(id: string, text: string): Promise<Message>;
  resolveConversation(id: string): Promise<void>;
  returnToAi(id: string): Promise<void>;
  runHumanAction(id: string, actionId: string): Promise<void>;
  listCustomers(): Promise<CustomerRecord[]>;
  getCustomer(id: string): Promise<CustomerRecord | null>;
  listDisputes(): Promise<Dispute[]>;
  getTrace(id: string): Promise<Trace | null>;

  getOperations(): Promise<Operations>;
  getEvaluationRun(conversationId: string): Promise<EvalRunDetail | null>;
  getConfig(): Promise<Config>;
  saveIntakeQuestions(questions: Record<string, IntakeQuestion>): Promise<IntakeQuestions>;
  restoreIntakeQuestions(): Promise<IntakeQuestions>;
  listAudit(query: AuditQuery): Promise<Page<AuditEntry>>;
  auditActors(): Promise<string[]>;
  listStaff(): Promise<StaffProfile[]>;
  rolePermissions(): Promise<RolePermission[]>;
  getIntegrations(): Promise<Integrations>;

  getProfile(userId: string): Promise<StaffProfile | null>;
  updateProfile(userId: string, update: Partial<ProfileUpdate>): Promise<StaffProfile>;

  listTestCustomers(): Promise<TestCustomer[]>;
  testChatGreeting(customerId: string): Promise<Message[]>;
  testChatTurn(customerId: string, conversationId: string | null, text: string): Promise<ChatTurnResponse>;
}

export const HUMAN_STATES: ConversationState[] = ["with_human", "needs_human"];
