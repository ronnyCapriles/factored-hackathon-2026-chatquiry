import Link from "next/link";
import { Avatar, StateChip } from "@/components/ui";
import { ConversationPanel } from "@/components/agent/conversation-panel";
import { CopilotPanel } from "@/components/agent/copilot-panel";
import { api, type ConversationFilter } from "@/lib/api";
import { getMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getMessages()).conversations.title };
}

const FILTERS: ConversationFilter[] = ["human", "ai", "resolved", "all"];

export default async function ConversationsPage({ searchParams }: PageProps<"/app/conversations">) {
  const user = await requireStaff();
  const t = await getMessages();
  const readOnly = user.role === "admin";
  const sp = await searchParams;
  const filter = (FILTERS.includes(sp.f as ConversationFilter) ? sp.f : "human") as ConversationFilter;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const [list, counts, staff] = await Promise.all([api().listConversations(filter), api().conversationCounts(), api().listStaff()]);
  const nameOf = (id?: string) => staff.find((s) => s.id === id)?.name;
  const shown = q ? list.filter((c) => `${c.customerName} ${c.lastMessage}`.toLowerCase().includes(q)) : list;
  // On a phone the list and the open conversation take turns; an explicit pick shows the conversation.
  const picked = typeof sp.c === "string" ? sp.c : undefined;
  const selectedId = picked ?? shown[0]?.id;
  const conversation = selectedId ? await api().getConversation(selectedId) : null;

  return (
    <div className="grid h-full min-h-0 grow grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)_380px]">
      <aside className={`${picked ? "hidden lg:flex" : "flex"} min-h-0 flex-col gap-3 border-r-[1.5px] border-linea bg-superficie px-4 py-[18px]`} aria-label={t.conversations.list}>
        <form role="search">
          <input type="hidden" name="f" value={filter} />
          <label className="sr-only" htmlFor="q">{t.common.search}</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder={t.conversations.searchPlaceholder} className="h-11 w-full rounded-full border-[1.5px] border-linea bg-fondo px-4 text-[14px]" />
        </form>
        <div className="grid grid-cols-2 gap-1 rounded-[18px] bg-fondo p-1" role="tablist">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={`?f=${f}`}
              role="tab"
              aria-selected={filter === f}
              className={`flex h-9 items-center justify-center rounded-full text-[13px] font-semibold ${filter === f ? "bg-tinta text-fondo" : "text-tinta hover:bg-superficie"}`}
            >
              {t.conversations[f]} · {counts[f]}
            </Link>
          ))}
        </div>
        <ul className="flex min-h-0 flex-col gap-2.5 overflow-y-auto">
          {shown.map((c) => {
            const selected = c.id === conversation?.id;
            const assignee = nameOf(c.assignedTo);
            return (
              <li key={c.id}>
                <Link
                  href={`?f=${filter}&c=${c.id}`}
                  aria-current={selected ? "true" : undefined}
                  className={`flex items-start gap-3 rounded-fila bg-superficie p-3 ${selected ? "border-2 border-tinta" : "border-[1.5px] border-linea hover:border-punto"}`}
                >
                  <Avatar initials={c.customerInitials} />
                  <span className="flex min-w-0 grow flex-col gap-1">
                    <span className="flex justify-between gap-2">
                      <span className={selected ? "font-bold" : "font-semibold"}>{c.customerName}</span>
                      <span className="text-[12px] text-muted">{c.lastAt}</span>
                    </span>
                    <span className="truncate text-[13px] text-tinta-3">{c.lastMessage}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <StateChip state={c.state} suffix={c.language.toUpperCase()} small />
                      {readOnly && assignee && <span className="text-[12px] text-muted">{assignee}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-2 py-6 text-center text-[14px] text-muted">{t.conversations.empty}</li>}
        </ul>
      </aside>

      {conversation ? (
        <div className={`${picked ? "flex" : "hidden"} min-h-0 flex-col overflow-y-auto lg:contents`}>
          <Link href={`?f=${filter}`} className="flex h-11 shrink-0 items-center gap-2 border-b-[1.5px] border-linea bg-superficie px-4 text-[14px] font-semibold lg:hidden">
            ← {t.nav.conversations}
          </Link>
          <div className="flex h-[calc(100dvh-100px)] min-h-[420px] shrink-0 flex-col lg:contents">
            <ConversationPanel
              key={conversation.id}
              conversation={conversation}
              agentName={user.name.split(" ")[0]}
              readOnly={readOnly}
              assignee={readOnly ? nameOf(conversation.assignedTo) : undefined}
            />
          </div>
          <div className="shrink-0 lg:contents">
            <CopilotPanel conversation={conversation} readOnly={readOnly} />
          </div>
        </div>
      ) : (
        <div className="col-span-2 hidden items-center justify-center text-muted lg:flex">{t.conversations.pick}</div>
      )}
    </div>
  );
}
