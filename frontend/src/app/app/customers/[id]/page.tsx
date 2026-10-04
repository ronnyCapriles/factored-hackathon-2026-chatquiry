import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Card, KeyValue, Label, Perforado, ReadOnlyBadge, StateChip, Table, Td, Th } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/app/customers/[id]">) {
  const r = await api().getCustomer((await params).id);
  return { title: r?.name ?? (await getMessages()).customers.customer };
}

export default async function CustomerPage({ params }: PageProps<"/app/customers/[id]">) {
  const [r, t] = await Promise.all([params.then((p) => api().getCustomer(p.id)), getMessages()]);
  if (!r) notFound();
  const c = t.customers;

  return (
    <div className="flex flex-col gap-5 px-4 py-5 lg:px-8 lg:py-7">
      <BackLink fallback="/app/customers" />
      <div className="flex flex-wrap items-center gap-[18px]">
        <Avatar initials={r.initials} size={64} />
        <div className="flex min-w-[220px] grow basis-0 flex-col gap-1">
          <h1 className="text-[24px] font-bold lg:text-[30px]">{r.name}</h1>
          <p className="flex flex-wrap gap-2 text-[14px] text-tinta-3">
            <span className="tabular">{r.id}</span>·<span>{r.segment}</span>·<span>{r.country}</span>·<span>{r.status}</span>·
            <span>{fmt(c.speaks, { lang: t.languages[r.language].toLowerCase() })}</span>
          </p>
        </div>
        <ReadOnlyBadge>{t.common.readOnlyMasked}</ReadOnlyBadge>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <Card className="flex flex-col gap-2.5 px-6 py-5">
          <Label>{c.data}</Label>
          <KeyValue k={c.document} v={r.documentMasked} />
          <KeyValue k={c.email} v={r.emailMasked} />
          <KeyValue k={c.phone} v={r.phoneMasked} />
          <KeyValue k={c.city} v={r.city} />
          <KeyValue k={c.since} v={r.customerSince} />
          <Perforado className="my-1.5" />
          <Label>{c.products}</Label>
          {r.products.map((p) => (
            <KeyValue key={p.id} k={`${p.label} ${p.masked}`} v={p.status} />
          ))}
        </Card>

        <Card className="flex flex-col gap-2 px-6 py-5">
          <Label>{c.recentTx}</Label>
          <Table>
            <thead>
              <tr>
                <Th>{c.date}</Th>
                <Th>{c.merchant}</Th>
                <Th align="right">{c.amount}</Th>
                <Th>{c.status}</Th>
                <Th align="right">{c.fraud}</Th>
              </tr>
            </thead>
            <tbody>
              {r.transactions.map((x) => (
                <tr key={x.id} className={x.highlighted ? "bg-marca-suave" : ""}>
                  <Td className="tabular">{x.at}</Td>
                  <Td>{x.description}</Td>
                  <Td align="right" className="tabular whitespace-nowrap">{money(x.amount, x.currency)}</Td>
                  <Td>{t.txStatus[x.status]}</Td>
                  <Td align="right" className={`tabular ${x.fraudScore >= 70 ? "font-bold text-atencion" : ""}`}>{x.fraudScore}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-[12px] text-muted">{c.source}</p>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3 px-6 py-5">
            <Label>{c.conversations}</Label>
            {r.conversations.map((cv) => (
              <div key={cv.id} className="flex flex-col gap-1.5 border-b border-linea-2 pb-3 last:border-0 last:pb-0">
                <Link href={`/app/conversations?f=all&c=${cv.id}`} className="text-[14px] font-semibold underline-offset-4 hover:underline">
                  {cv.label}
                </Link>
                <StateChip state={cv.state} small />
              </div>
            ))}
          </Card>
          <Card className="flex flex-col gap-2.5 px-6 py-5">
            <Label>{c.cases}</Label>
            {r.cases.length ? (
              r.cases.map((k) => (
                <KeyValue
                  key={k.id}
                  k={k.kind === "dispute" ? <Link href={`/app/disputes?d=${k.id}`} className="tabular underline underline-offset-4">{k.id}</Link> : <span className="tabular">{k.id}</span>}
                  v={k.label}
                />
              ))
            ) : (
              <p className="text-[14px] text-muted">{c.noCases}</p>
            )}
          </Card>
          <Card className="flex flex-col gap-2.5 px-6 py-5">
            <Label>{c.contactHistory}</Label>
            {r.contactHistory.map((h) => (
              <KeyValue key={h.label} k={h.label} v={h.value} />
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
