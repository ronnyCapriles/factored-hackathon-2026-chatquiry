import type { Messages } from "@/i18n/config";
import type { Field } from "./index";

// Field lists per entity; values like model ids and scopes stay untranslated on purpose.

const langs = (t: Messages) => [t.languages.es, t.languages.pt, t.languages.en];
const permissions = (t: Messages) => [t.config.permission.read, t.config.permission.customer_confirm, t.config.permission.human_only];

export const departmentFields = (t: Messages): Field[] => {
  const f = t.forms.department;
  return [
    { name: "name", label: f.name, type: "text", required: true, maxLength: 60, placeholder: f.namePlaceholder },
    { name: "purpose", label: f.purpose, type: "textarea", required: true, maxLength: 280, hint: f.purposeHint },
    { name: "profile", label: f.profile, type: "select", options: ["Lía", f.noProfile], half: true },
    { name: "team", label: f.team, type: "multiselect", options: ["Andrea Ríos", "Diego Paz"] },
    { name: "channels", label: f.channels, type: "multiselect", options: Object.values(t.channels) },
    { name: "sla", label: f.sla, type: "number", min: 1, max: 120, half: true },
    { name: "hours", label: f.hours, type: "text", placeholder: f.hoursPlaceholder, half: true },
  ];
};

export const profileFields = (t: Messages, departments: string[]): Field[] => {
  const f = t.forms.profile;
  return [
    { name: "name", label: f.name, type: "text", required: true, maxLength: 30, half: true },
    { name: "department", label: f.department, type: "select", required: true, options: departments, half: true },
    { name: "persona", label: f.persona, type: "textarea", required: true, maxLength: 500, hint: f.personaHint },
    { name: "languages", label: f.languages, type: "multiselect", required: true, options: langs(t) },
    { name: "model", label: f.model, type: "select", required: true, options: ["claude-sonnet-5", "claude-haiku-4-5", "claude-opus-5"], half: true },
    { name: "fallback", label: f.fallback, type: "select", options: ["claude-haiku-4-5", "claude-sonnet-5"], half: true },
    { name: "tools", label: f.tools, type: "multiselect", options: ["find_transactions", "get_transaction", "policy_lookup", "propose_dispute", "handoff_to_human"] },
    { name: "budget", label: f.budget, type: "number", min: 0, max: 5, half: true },
    { name: "maxTurns", label: f.maxTurns, type: "number", min: 1, max: 50, half: true },
    { name: "aiDisclosure", label: f.disclosure, type: "toggle", half: true },
    { name: "agentSuggestions", label: f.suggestions, type: "toggle", half: true },
  ];
};

export const toolFields = (t: Messages, connectors: string[], profiles: string[]): Field[] => {
  const f = t.forms.tool;
  return [
    { name: "name", label: f.name, type: "text", required: true, placeholder: "find_cards", hint: f.nameHint, half: true },
    { name: "title", label: f.title, type: "text", required: true, half: true },
    { name: "connector", label: f.connector, type: "select", required: true, options: connectors, half: true },
    { name: "permission", label: f.permission, type: "select", required: true, options: permissions(t), half: true },
    { name: "description", label: f.description, type: "textarea", required: true, maxLength: 280, hint: f.descriptionHint },
    { name: "rateLimit", label: f.rateLimit, type: "number", min: 1, max: 100, half: true },
    { name: "profiles", label: f.profiles, type: "multiselect", options: profiles },
    { name: "inputSchema", label: f.schema, type: "code", required: true, placeholder: '{\n  "transaction_id": "string"\n}' },
  ];
};

export const ruleFields = (t: Messages, destinations: string[]): Field[] => {
  const f = t.forms.rule;
  return [
    { name: "name", label: f.name, type: "text", required: true, half: true },
    { name: "priority", label: f.priority, type: "number", required: true, min: 1, max: 99, half: true, hint: f.priorityHint },
    { name: "signal", label: f.signal, type: "select", required: true, options: ["intent", "injection_risk", "needs_human", "frustration", "language", "turns", "guardrail"], half: true },
    { name: "op", label: f.op, type: "select", required: true, options: ["=", "≠", "≥", "≤", "∈"], half: true },
    { name: "value", label: f.value, type: "text", required: true, placeholder: "txn_dispute · 0.80" },
    { name: "action", label: f.action, type: "select", required: true, options: Object.values(t.config.action), half: true },
    { name: "destination", label: f.destination, type: "select", required: true, options: [...destinations, f.abstain], half: true },
  ];
};

export const guardrailFields = (t: Messages): Field[] => {
  const f = t.forms.guardrail;
  return [
    { name: "promptAttack", label: f.promptAttack, type: "select", required: true, options: ["NONE", "LOW", "MEDIUM", "HIGH"], half: true },
    { name: "grounding", label: f.grounding, type: "number", min: 0, max: 1, half: true },
    { name: "deniedTopic", label: f.deniedTopic, type: "text", placeholder: f.deniedTopicPlaceholder },
    { name: "blockedEs", label: f.blockedEs, type: "textarea", maxLength: 280 },
    { name: "blockedPt", label: f.blockedPt, type: "textarea", maxLength: 280 },
  ];
};

export const policyFields = (t: Messages, domains: string[]): Field[] => {
  const f = t.forms.policy;
  return [
    { name: "name", label: f.name, type: "text", required: true, half: true },
    { name: "domain", label: f.domain, type: "select", required: true, options: domains, half: true },
    { name: "description", label: f.description, type: "textarea", required: true, maxLength: 280 },
    { name: "parameters", label: f.parameters, type: "code", placeholder: "SLA = 24 h" },
    { name: "note", label: f.note, type: "text", required: true, placeholder: f.notePlaceholder },
  ];
};

export const apiKeyFields = (t: Messages): Field[] => {
  const f = t.forms.apiKey;
  return [
    { name: "name", label: f.name, type: "text", required: true, placeholder: f.namePlaceholder },
    { name: "environment", label: f.environment, type: "select", required: true, options: [f.live, f.test], half: true },
    { name: "expires", label: f.expires, type: "number", min: 1, max: 365, half: true },
    { name: "scopes", label: f.scopes, type: "multiselect", required: true, options: ["conversations:write", "conversations:read", "handoff:read", "webhooks:manage"] },
  ];
};

export const channelFields = (t: Messages, departments: string[]): Field[] => {
  const f = t.forms.channel;
  return [
    { name: "channel", label: f.channel, type: "select", required: true, options: ["WhatsApp Business", t.channels.widget, "REST API", "Email"] },
    { name: "department", label: f.department, type: "select", options: [f.byRouting, ...departments], hint: f.departmentHint },
  ];
};

export const connectorFields = (t: Messages): Field[] => {
  const f = t.forms.connector;
  return [
    { name: "name", label: f.name, type: "text", required: true, half: true },
    { name: "kind", label: f.kind, type: "select", required: true, options: ["Postgres (read only)", "REST API", "MCP server"], half: true },
    { name: "url", label: f.url, type: "text", required: true, hint: f.urlHint },
    { name: "scope", label: f.scope, type: "text", required: true, placeholder: "customer_id = :session_customer" },
  ];
};

export const userFields = (t: Messages, teams: string[], skills: string[]): Field[] => {
  const f = t.forms.user;
  return [
    { name: "name", label: f.name, type: "text", required: true, half: true },
    { name: "email", label: f.email, type: "text", required: true, half: true },
    { name: "role", label: f.role, type: "select", required: true, options: [t.roles.agent, t.roles.admin], half: true },
    { name: "team", label: f.team, type: "select", required: true, options: teams, half: true },
    { name: "languages", label: f.languages, type: "multiselect", required: true, options: langs(t) },
    { name: "skills", label: f.skills, type: "multiselect", options: skills },
    { name: "shift", label: f.shift, type: "text", placeholder: f.shiftPlaceholder, half: true },
    { name: "capacity", label: f.capacity, type: "number", min: 0, max: 10, half: true },
  ];
};
