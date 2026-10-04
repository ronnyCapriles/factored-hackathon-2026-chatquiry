import Link from "next/link";
import { Avatar, Card, PageTitle, ReadOnlyBadge, Table, Td, Th } from "@/components/ui";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";

export async function generateMetadata() {
  return { title: (await getMessages()).customers.title };
}

export default async function CustomersPage() {
  const [records, t] = await Promise.all([api().listCustomers(), getMessages()]);
  const c = t.customers;

  return (
    <div className="flex flex-col gap-5 px-4 py-5 lg:px-8 lg:py-7">
      <PageTitle aside={<ReadOnlyBadge>{t.common.readOnlyMasked}</ReadOnlyBadge>}>{c.title}</PageTitle>
      <Card className="px-6 py-3">
        <Table>
          <thead>
            <tr>
              <Th>{c.customer}</Th>
              <Th>{c.id}</Th>
              <Th>{c.segment}</Th>
              <Th>{c.country}</Th>
              <Th>{c.language}</Th>
              <Th align="right">{c.conversations}</Th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-fondo">
                <Td>
                  <Link href={`/app/customers/${r.id}`} className="flex items-center gap-3 font-semibold underline-offset-4 hover:underline">
                    <Avatar initials={r.initials} size={34} />
                    {r.name}
                  </Link>
                </Td>
                <Td className="tabular text-[13px] text-muted">{r.id}</Td>
                <Td>{r.segment}</Td>
                <Td>{r.country}</Td>
                <Td>{t.languages[r.language]}</Td>
                <Td align="right" className="tabular">{r.conversations.length}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <p className="text-[13px] text-muted">{c.note}</p>
    </div>
  );
}
