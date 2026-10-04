import { notFound } from "next/navigation";
import { ButtonLink, Card, KeyValue, Label, Table, Td, Th } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";
import { TRACE_STATUS_CLS } from "@/components/trace/steps";

export async function generateMetadata({ params }: PageProps<"/app/traces/[id]">) {
  return { title: `${(await getMessages()).traces.title} ${(await params).id}` };
}


export default async function TracePage({ params }: PageProps<"/app/traces/[id]">) {
  const { id } = await params;
  const [trace, t] = await Promise.all([api().getTrace(id), getMessages()]);
  if (!trace) notFound();
  const conversation = await api().getConversation(trace.conversationId);
  const x = t.traces;

  return (
    <div className="flex flex-col gap-5 px-4 py-5 lg:px-8 lg:py-7">
      <div className="flex flex-wrap items-center gap-3">
        <BackLink fallback="/app/conversations" />
        <span className="grow" />
        {conversation && (
          <>
            <ButtonLink href={`/app/conversations?f=all&c=${conversation.id}`} variant="secondary" size="sm">
              {t.common.goToConversation}
            </ButtonLink>
            <ButtonLink href={`/app/customers/${conversation.customerId}`} variant="secondary" size="sm">
              {t.common.seeCustomer}
            </ButtonLink>
          </>
        )}
      </div>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex flex-col gap-4 px-7 py-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] font-bold">
              {x.title} <span className="tabular">{trace.id}</span>
              {conversation && <span className="text-tinta-3"> · {conversation.customerName}</span>}
            </h1>
            <p className="text-[15px] text-tinta-3">{x.lead}</p>
          </div>
          <Table>
            <thead>
              <tr>
                <Th className="w-[80px]">{x.t}</Th>
                <Th className="w-[200px]">{x.step}</Th>
                <Th>{x.detail}</Th>
                <Th className="w-[120px]">{x.result}</Th>
                <Th align="right" className="w-[70px]">ms</Th>
              </tr>
            </thead>
            <tbody>
              {trace.steps.map((s) => (
                <tr key={s.t + s.step}>
                  <Td className="tabular text-muted">{s.t}</Td>
                  <Td className="tabular font-bold">{s.step}</Td>
                  <Td>{s.detail}</Td>
                  <Td>
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ${TRACE_STATUS_CLS[s.status]}`}>{x.status[s.status]}</span>
                  </Td>
                  <Td align="right" className="tabular">{s.ms.toLocaleString()}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <aside className="sticky top-7 flex flex-col gap-4">
          <Card emphasis className="flex flex-col gap-3 p-5">
            <Label>{x.summary}</Label>
            <KeyValue k={x.outcome} v={trace.outcome} />
            <KeyValue k={x.latency} v={trace.aiLatency} />
            <KeyValue k={x.tokens} v={trace.tokens.toLocaleString()} />
            <KeyValue k={x.cost} v={trace.cost ?? x.costPending} />
          </Card>
          <Card className="flex flex-col gap-2.5 p-5">
            <Label>{x.rules}</Label>
            {trace.rules.length ? trace.rules.map((r) => <span key={r} className="tabular text-[14px]">{r}</span>) : <span className="text-[14px] text-muted">{t.common.none}</span>}
          </Card>
          <Card className="flex flex-col gap-2.5 p-5">
            <Label>{x.versions}</Label>
            {trace.versions.map((v) => (
              <span key={v} className="tabular text-[14px]">{v}</span>
            ))}
          </Card>
        </aside>
      </div>
    </div>
  );
}
