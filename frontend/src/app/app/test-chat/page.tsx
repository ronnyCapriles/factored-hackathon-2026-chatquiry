import { api } from "@/lib/api";
import { getMessages } from "@/i18n/server";
import { requireStaff } from "@/lib/session";
import { TestChat } from "./chat-window";
import { CustomerList } from "./customer-list";

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
      <div className="flex flex-col gap-2 px-4 py-5 lg:px-8 lg:py-7">
        <h1 className="text-[28px] font-bold tracking-tight">{m.title}</h1>
        <p className="max-w-[560px] text-[15px] leading-normal text-tinta-3">{m.noCustomers}</p>
      </div>
    );
  }
  const [greeting, config] = await Promise.all([api().testChatGreeting(selected.customerId), api().getConfig()]);
  const liveProfiles = new Set(config.departments.map((d) => d.profile).filter(Boolean));
  const profile = config.profiles.find((p) => liveProfiles.has(p.name)) ?? config.profiles[0];

  return (
    <div className="flex flex-col lg:grid lg:h-full lg:min-h-0 lg:grow lg:grid-cols-[300px_minmax(0,1fr)_minmax(360px,440px)]">
      <aside className="flex min-h-0 flex-col gap-3 border-b-[1.5px] border-linea bg-superficie px-4 py-[18px] lg:border-b-0 lg:border-r-[1.5px]" aria-label={m.customer}>
        <div className="flex flex-col gap-1.5 px-1">
          <h1 className="text-[22px] font-bold tracking-tight">{m.title}</h1>
          <p className="hidden text-[13px] leading-normal text-tinta-3 lg:block">{m.lead}</p>
        </div>
        <span className="etiqueta px-1 pt-1">{m.customer}</span>
        <CustomerList customers={customers} selectedId={selected.customerId} />
        <p className="mt-auto hidden shrink-0 px-1 text-[12px] leading-normal text-muted lg:block">{m.auditNote}</p>
      </aside>
      <TestChat key={selected.customerId} customerId={selected.customerId} language={selected.language} greeting={greeting} aiName={profile.name} aiDisclosure={profile.aiDisclosure} />
    </div>
  );
}
