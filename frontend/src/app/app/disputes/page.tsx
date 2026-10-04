import Link from "next/link";
import { EntityFormButton, PendingAction } from "@/components/crud";
import { ButtonLink, Card, KeyValue, Label, PageTitle, Perforado, ReadOnlyBadge, StateChip, Table, Td, Th } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { requireStaff } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getMessages()).disputes.title };
}

export default async function DisputesPage({ searchParams }: PageProps<"/app/disputes">) {
  const user = await requireStaff();
  const readOnly = user.role === "admin";
  const [disputes, conversations, sp, t] = await Promise.all([api().listDisputes(), api().listConversations("all"), searchParams, getMessages()]);
  const d = t.disputes;
  const selected = disputes.find((x) => x.id === sp.d) ?? disputes[0];
  const conversation = selected && conversations.find((c) => c.id === selected.traceId);

  return (
    <div className="grid grid-cols-1 items-start gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_460px] lg:px-8 lg:py-7">
      <Card className="flex flex-col gap-4 px-6 py-5">
        <PageTitle aside={<ReadOnlyBadge />}>{d.title}</PageTitle>
        <Table>
          <thead>
            <tr>
              <Th>{d.id}</Th>
              <Th>{d.customerReason}</Th>
              <Th align="right">{d.amount}</Th>
              <Th>{d.openedBy}</Th>
              <Th>{d.status}</Th>
            </tr>
          </thead>
          <tbody>
            {disputes.map((x) => {
              const active = x.id === selected?.id;
              return (
                <tr key={x.id} className={active ? "bg-fondo" : "hover:bg-fondo"}>
                  <Td>
                    <Link href={`?d=${x.id}`} aria-current={active ? "true" : undefined} className={`tabular underline-offset-4 hover:underline ${active ? "font-bold" : ""}`}>
                      {x.id}
                    </Link>
                  </Td>
                  <Td>
                    {x.customerName} · {x.reason}
                  </Td>
                  <Td align="right" className="tabular whitespace-nowrap">{money(x.amount, x.currency)}</Td>
                  <Td>{x.openedBy}</Td>
                  <Td>
                    <StateChip state={x.state} small />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {selected && (
        <Card emphasis className="sticky top-7 flex flex-col gap-3.5 px-6 py-5">
          <span className="tabular text-[22px] font-bold">{selected.id}</span>
          <KeyValue k={d.customer} v={selected.customerName} />
          <KeyValue k={d.amount} v={money(selected.amount, selected.currency)} />
          <KeyValue k={d.transaction} v={selected.transactionId} mono />
          <KeyValue k={d.rule} v={selected.policyRule} mono />
          <KeyValue k={d.owner} v={selected.owner ?? t.common.unassigned} />
          <div className="flex flex-wrap gap-2 pt-1">
            {conversation && (
              <ButtonLink href={`/app/conversations?f=all&c=${conversation.id}`} variant="secondary" size="sm">
                {t.common.goToConversation}
              </ButtonLink>
            )}
            <ButtonLink href={`/app/customers/${selected.customerId}`} variant="secondary" size="sm">
              {t.common.seeCustomer}
            </ButtonLink>
            <ButtonLink href={`/app/traces/${selected.traceId}`} variant="secondary" size="sm">
              {t.common.seeTrace}
            </ButtonLink>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <EntityFormButton
                mode="edit"
                title={d.updateStatusTitle}
                action={d.updateStatusAction}
                label={d.updateStatus}
                fields={[
                  { name: "status", label: d.newStatus, type: "select", required: true, options: [d.statusReview, d.statusWaiting, d.statusWon, d.statusRejected] },
                  { name: "note", label: d.note, type: "textarea", required: true, maxLength: 500, hint: d.noteHint },
                ]}
              />
              <PendingAction action={fmt(d.reassignAction, { id: selected.id })}>{d.reassign}</PendingAction>
            </div>
          )}
          <Perforado />
          <Label>{d.log}</Label>
          <ol className="flex flex-col gap-2.5">
            {selected.events.map((e) => (
              <li key={e.at + e.description} className="flex gap-3.5 text-[14px]">
                <span className="tabular shrink-0 text-muted">{e.at}</span>
                <span>{e.description}</span>
              </li>
            ))}
          </ol>
          <p className="pt-2 text-[13px] text-muted">{d.logNote}</p>
        </Card>
      )}
    </div>
  );
}
