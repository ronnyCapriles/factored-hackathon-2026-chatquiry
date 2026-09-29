import Link from "next/link";
import { Card, Label } from "@/components/ui";
import { api } from "@/lib/api";
import { getMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/session";
import { TestChat } from "./chat-window";

export async function generateMetadata() {
  return { title: (await getMessages()).testChat.title };
}

export default async function TestChatPage({ searchParams }: PageProps<"/app/test-chat">) {
  await requireStaff();
  const [customers, t] = await Promise.all([api().listTestCustomers(), getMessages()]);
  const m = t.testChat;
  const sp = await searchParams;
  const selected = customers.find((c) => c.customerId === sp.customer) ?? customers[0];
  if (!selected) {
    return (
      <div className="flex flex-col gap-2 px-8 py-7">
        <h1 className="text-[28px] font-bold tracking-tight">{m.title}</h1>
        <p className="max-w-[560px] text-[15px] leading-normal text-tinta-3">{m.noCustomers}</p>
      </div>
    );
  }
  const [greeting, config] = await Promise.all([api().testChatGreeting(selected.customerId), api().getConfig()]);
  const liveProfiles = new Set(config.departments.map((d) => d.profile).filter(Boolean));
  const profile = config.profiles.find((p) => liveProfiles.has(p.name)) ?? config.profiles[0];

  return (
    <div className="grid grid-cols-[300px_minmax(360px,1fr)_minmax(360px,440px)] items-start gap-8 px-8 py-7">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold tracking-tight">{m.title}</h1>
          <p className="text-[15px] leading-normal text-tinta-3">{m.lead}</p>
        </div>
        <Card className="flex flex-col gap-2 p-4">
          <Label className="px-1 pb-1">{m.customer}</Label>
          {customers.map((c) => {
            const active = c.customerId === selected.customerId;
            return (
              <Link
                key={c.customerId}
                href={`?customer=${c.customerId}`}
                aria-current={active ? "true" : undefined}
                className={`flex flex-col gap-0.5 rounded-fila px-3.5 py-3 ${active ? "border-2 border-tinta bg-marca-suave" : "border-2 border-transparent hover:bg-fondo"}`}
              >
                <span className="flex justify-between font-semibold">
                  {c.fullName}
                  <span className="text-[13px] font-medium text-muted">{t.languages[c.language]}</span>
                </span>
                <span className="text-[13px] text-tinta-3">{c.country}</span>
                <span className="text-[13px] text-muted">{c.hint}</span>
              </Link>
            );
          })}
        </Card>
        <p className="text-[13px] leading-normal text-muted">{m.auditNote}</p>
      </div>
      <TestChat key={selected.customerId} customerId={selected.customerId} language={selected.language} greeting={greeting} aiName={profile.name} aiDisclosure={profile.aiDisclosure} />
    </div>
  );
}
