// Mirrors the backend schemas.

export type Language = "es" | "pt";
export type Role = "agent" | "admin";

/** Each state maps to one bubble in the state language. */
export type ConversationState =
  | "ai_attending"
  | "waiting_customer"
  | "with_human"
  | "needs_human"
  | "resolved";

export type Channel = "whatsapp" | "widget" | "api" | "test_chat";

export type Author = "customer" | "ai" | "human" | "system";

export interface StaffUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  specialty?: string;
}

export type Availability = "available" | "paused" | "offline";

export interface StaffProfile extends StaffUser {
  displayName: string;
  avatarUrl?: string;
  team: string;
  languages: string[];
  skills: string[];
  shift: string;
  timezone: string;
  maxConcurrentChats: number;
  availability: Availability;
  greeting: string;
  phoneExtension: string;
  notifications: { newHandoff: boolean; desktop: boolean; sound: boolean; dailySummary: boolean };
  locale: "es" | "en" | "pt";
  theme: "light" | "dark" | "system";
  lastLogin: string;
}

/** Fields a staff member may change about themselves; the rest is set by an admin. */
export type ProfileUpdate = Pick<
  StaffProfile,
  "displayName" | "avatarUrl" | "greeting" | "phoneExtension" | "availability" | "notifications" | "timezone" | "locale" | "theme"
>;

export interface Session {
  user: StaffUser;
  expiresAt: string;
}

export interface Message {
  id: string;
  author: Author;
  authorName: string;
  text: string;
  at: string;
}

export interface ConversationSummary {
  id: string;
  customerId: string;
  customerName: string;
  customerInitials: string;
  language: Language;
  channel: Channel;
  state: ConversationState;
  lastMessage: string;
  lastAt: string;
  assignedTo?: string;
}

export interface VerifiedFact {
  label: string;
  source: string;
}

export interface ActionTaken {
  at: string;
  description: string;
  verified: boolean;
}

export interface HumanOnlyAction {
  id: string;
  label: string;
  simulated: boolean;
}

export interface Handoff {
  id: string;
  fromProfile: string;
  reason: string;
  policyRule: string;
  facts: VerifiedFact[];
  actions: ActionTaken[];
  pending: string[];
  humanActions: HumanOnlyAction[];
  suggestion?: string;
}

export interface Conversation extends ConversationSummary {
  country: string;
  handedOffAt?: string;
  messages: Message[];
  handoff?: Handoff;
  traceId: string;
}

/** What changed in a conversation after a given message; open screens poll it. */
export interface ConversationUpdates {
  messages: Message[];
  state: ConversationState;
  responder: string;
  human: boolean;
}

export interface Product {
  id: string;
  label: string;
  masked: string;
  status: string;
}

export interface Transaction {
  id: string;
  at: string;
  description: string;
  amount: number;
  currency: string;
  status: "Approved" | "Declined" | "Pending" | "Reversed";
  fraudScore: number;
  highlighted?: boolean;
}

export interface CustomerRecord {
  id: string;
  name: string;
  initials: string;
  segment: string;
  country: string;
  city: string;
  status: string;
  language: Language;
  documentMasked: string;
  emailMasked: string;
  phoneMasked: string;
  customerSince: string;
  products: Product[];
  transactions: Transaction[];
  conversations: { id: string; label: string; outcome: string; state: ConversationState }[];
  cases: { id: string; label: string; kind: "dispute" | "complaint" }[];
  contactHistory: { label: string; value: string }[];
}

export interface DisputeEvent {
  at: string;
  description: string;
}

export interface Dispute {
  id: string;
  customerName: string;
  customerId: string;
  reason: string;
  amount: number;
  currency: string;
  openedBy: string;
  status: string;
  state: ConversationState;
  transactionId: string;
  policyRule: string;
  owner?: string;
  events: DisputeEvent[];
  traceId: string;
}

export type TraceStatus = "allowed" | "classified" | "routed" | "ok" | "decision" | "pending" | "verified" | "escalated" | "blocked";

export interface TraceStep {
  t: string;
  step: string;
  detail: string;
  status: TraceStatus;
  ms: number;
}

export interface Trace {
  id: string;
  conversationId: string;
  outcome: string;
  aiLatency: string;
  tokens: number;
  cost: string | null;
  steps: TraceStep[];
  rules: string[];
  versions: string[];
}

export interface Kpi {
  key: string;
  label: string;
  value: string | null;
  hint: string;
  display?: boolean;
}

export interface SegmentRow {
  group: string;
  n: number | null;
  aiResolved: string | null;
  withHuman: string | null;
  unsafe: number | null;
}

export interface Alert {
  id: string;
  title: string;
  hint: string;
  value: string | null;
  severe: boolean;
}

export interface Operations {
  sample: boolean;
  kpis: Kpi[];
  segments: SegmentRow[];
  alerts: Alert[];
}

export type ToolPermission = "read" | "customer_confirm" | "human_only";

export interface ToolConfig {
  name: string;
  title: string;
  permission: ToolPermission;
  description: string;
  connector: string;
  /** How the tool is scoped outside the model (e.g. customer_id injected from the session). */
  scope: string;
  profiles: string[];
  humanRoles: Role[];
  rateLimit: string;
  inputSchema: string;
}

export interface PromptVersion {
  version: string;
  date: string;
  note: string;
  current?: boolean;
}

export interface AiProfile {
  id: string;
  name: string;
  initials: string;
  department: string;
  persona: string;
  sampleGreeting: Record<Language, string>;
  languages: Language[];
  model: string;
  fallbackModel: string;
  promptVersion: string;
  promptHistory: PromptVersion[];
  guardrail: string;
  handoffTriggers: string[];
  maxTurnsBeforeHuman: number;
  budgetPerConversation: string;
  aiDisclosure: boolean;
  agentSuggestions: boolean;
  tools: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
}

export interface Department {
  id: string;
  name: string;
  purpose: string;
  profile: string | null;
  humanTeam: TeamMember[];
  channels: Channel[];
  firstResponseSla: string;
  hours: string;
  rules: string[];
}

export interface IntakeSignal {
  name: string;
  kind: "choice" | "probability";
  description: string;
  threshold?: number;
}

export interface IntakeFilter {
  classifier: string;
  guardrail: string;
  signals: IntakeSignal[];
}

export interface RoutingCondition {
  signal: string;
  op: string;
  value: string;
}

export type RoutingAction = "block" | "human" | "abstain" | "route";

export interface RoutingRule {
  id: string;
  priority: number;
  name: string;
  when: RoutingCondition[];
  action: RoutingAction;
  destination: string;
  hits24h: number | null;
}

export interface RoutingExample {
  message: string;
  language: Language;
  signals: Signal[];
  matched: string;
}

export type FilterStrength = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export interface GuardrailConfig {
  id: string;
  name: string;
  version: string;
  tier: string;
  promptAttack: FilterStrength;
  contentFilters: { category: string; input: FilterStrength; output: FilterStrength }[];
  pii: { entity: string; action: "mask" | "block" }[];
  deniedTopics: { name: string; example: string }[];
  wordFilters: string[];
  groundingThreshold: number;
  blockedMessage: Record<Language, string>;
}

export interface Policy {
  id: string;
  name: string;
  version: string;
  domain: string;
  description: string;
  parameters: { name: string; value: string }[];
  outcomes: { when: string; decision: string; human?: boolean }[];
  history: PromptVersion[];
  testCases: number;
  usedBy: string[];
}

export interface Config {
  departments: Department[];
  profiles: AiProfile[];
  tools: ToolConfig[];
  intake: IntakeFilter;
  routing: RoutingRule[];
  routingExamples: RoutingExample[];
  guardrails: GuardrailConfig[];
  policies: Policy[];
}

export type AuditOutcome = "allowed" | "verified" | "denied" | "flagged";

export interface AuditEntry {
  id: string;
  /** ISO date (yyyy-mm-dd) and local time. */
  date: string;
  at: string;
  actor: string;
  actorKind: "ai" | "human" | "system";
  action: string;
  target: string;
  outcome: AuditOutcome;
}

export interface AuditQuery {
  q?: string;
  actorKind?: AuditEntry["actorKind"];
  outcome?: AuditOutcome;
  actor?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RolePermission {
  permission: string;
  agent: string;
  admin: string;
}

export interface ApiKey {
  id: string;
  name: string;
  masked: string;
  environment: "live" | "test";
  scopes: string[];
  active: boolean;
}

export interface ChannelIntegration {
  channel: Channel;
  name: string;
  detail: string;
  status: string;
}

export interface DataConnector {
  name: string;
  detail: string;
  status: string;
  planned?: boolean;
}

export interface Integrations {
  apiKeys: ApiKey[];
  channels: ChannelIntegration[];
  connectors: DataConnector[];
}

export interface ChatTurnRequest {
  customerId: string;
  conversationId: string | null;
  text: string;
}

export interface Signal {
  name: string;
  value: string;
  /** Model confidence for categorical signals (e.g. intent), 0–1. */
  confidence?: number;
}

/** What the system did on one customer turn. */
export interface TurnInspection {
  customerText: string;
  state: ConversationState;
  department: string;
  profile: string;
  signals: Signal[];
  rule: { id: string; name: string } | null;
  steps: TraceStep[];
  totalMs: number;
}

export interface ChatTurnResponse {
  conversationId: string;
  replies: Message[];
  handedOff: boolean;
  inspection: TurnInspection;
}

export interface TestCustomer {
  customerId: string;
  firstName: string;
  fullName: string;
  country: string;
  language: Language;
  hint: string;
}
