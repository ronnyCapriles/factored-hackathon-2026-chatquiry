# Chatquiry — scope

What the hackathon submission (deadline Sun 2026-10-04) delivers, and what comes after. The frontend already shows every future flow: anything marked **UI only** has working screens, forms, validation and confirmations, and ends in a "todavía no disponible" notice instead of saving.

## In the hackathon submission

### Customer experience
- Human-toned, text-only chat in **Spanish and Portuguese**. The reply follows the language of each message.
- Three paths:
  - **Normal resolution:** a pending or declined transfer, explained using the policy deadlines.
  - **Clarification or abstention:** ambiguous charges, credit requests, and attempts to read someone else's account.
  - **Human handoff:** a possible-fraud dispute, where the customer confirms with an explicit "yes" and the conversation continues with a person in the same chat.
- An AI-disclosure line, switchable per AI profile.
- Channels: **test chat** (staff-only, for demo and evaluation) and **REST API** with an API key plus a bank-signed customer assertion. WhatsApp Cloud API is a stretch goal if time allows.

### Staff workspace (agents and admins)
- Sign-in with fixed seeded users and hashed passwords, a 15-minute session expiry, and role checks in the proxy, the page and the backend.
- **Agent:** conversation list, transcript with author labels, reply box, and a copilot showing the handoff, verified facts, pending items, a suggested reply and human-only actions.
- **Admin:** the same views in read-only supervision mode, plus live operations counters and alerts.
- **Read-only records:** customer file (masked data), disputes with an append-only log, and execution traces.
- **Test chat with a live inspector:** each turn's signals, matched rule, department, tools, policy decision, verification and handoff.
- **Audit** with filters (period, type, actor, outcome, text) and pagination.
- **Configuration, read-only and filled with real data:** flow map and departments, AI profiles (list and detail), tools and permissions (with filters), routing (with worked examples), guardrails, policies, integrations, users and roles.
- **Profile:** photo, display name, greeting, availability, extension, time zone and notifications. This saves in the mock; with the backend it persists to Postgres, and photos go to S3.
- Toasts, modals, loading skeletons, and 404, 403 and error pages.

### Backend, data and ML (Phase 3 onward)
- FastAPI orchestrator: intake (Bedrock Guardrails plus the Jev decision model from TypeSafe, with keyword rules as fallback), deterministic routing, Mistral Large 3 through the Bedrock Converse API with allow-listed tools, a policy engine, a grounding check, and handoff packets.
- Postgres with `org_id` and `workspace_id` on every table, a single workspace, per-customer scoping in the tool layer, and an append-only audit log.
- Data pipeline (bronze → silver → gold) with contracts, quality reports, a late-arrival and dedup fixture, and a serving subset.
- Intake classifier evaluated against baselines on a leakage-safe split.
- End-to-end evaluation on held-out ES/PT scenarios: safe resolution, containment, handoff quality, unsafe outcomes, p50/p95 latency and cost.
- Deployment with Terraform: EC2 running Docker Compose, the frontend on Amplify, Bedrock, a budget alarm, and CloudWatch.

## UI only now → implemented after the hackathon

| Area | What exists now | After the hackathon |
|---|---|---|
| Departments | Create, edit and delete forms | Persisted, versioned configuration |
| AI profiles | Create, edit, duplicate, delete, "try changes" | Draft/publish with prompt versioning and A/B tests |
| Tools | Register, edit, delete, test | Connector SDK and schema validation from OpenAPI or MCP |
| Routing | New rule, edit, reorder, delete | Rule editor with a simulator over past conversations |
| Guardrails | Edit levels and messages, test a message | Versioned Bedrock guardrail updates |
| Policies | New version, run tests, archive | Policy-as-code CI: a version activates only if its tests pass |
| Integrations | Create, rotate and revoke keys; connect channels; add connectors | Real key issuance, WhatsApp/widget onboarding, secrets manager |
| Users | Create, edit assignment, deactivate | Invitations, SSO (Cognito), password reset |
| Conversations | Return to Lía, resolve, block card (confirmed) | Persisted state changes, outbound replies through the customer's channel |
| Disputes | Update status, reassign | Workflow engine integration |
| Audit | CSV export | Exports, SIEM streaming, retention jobs |
| Profile | Password change | Handled by the identity service |

## Explicitly out of scope
- Real money movement, real credit decisions and real KYC.
- A multi-workspace UI. The data model is ready for it; the UI shows one workspace.
- Voice channels, a visual flow builder and billing.
