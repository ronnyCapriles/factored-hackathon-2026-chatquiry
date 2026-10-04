import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton, EntityFormButton, PendingAction } from "@/components/crud";
import { profileFields } from "@/components/crud/forms";
import { Chip, PermissionBadge, SectionTitle } from "@/components/config/parts";
import { Avatar, Card, KeyValue, Label } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";

export async function generateMetadata({ params }: PageProps<"/app/config/profiles/[id]">) {
  const [cfg, { id }, t] = await Promise.all([api().getConfig(), params, getMessages()]);
  return { title: cfg.profiles.find((p) => p.id === id)?.name ?? t.profiles.title };
}

function Toggle({ label, hint, on, onText, offText }: { label: string; hint: string; on: boolean; onText: string; offText: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-fila bg-fondo px-4 py-3">
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="text-[13px] text-muted">{hint}</span>
      </span>
      <span role="switch" aria-checked={on} aria-readonly="true" aria-label={`${label}: ${on ? onText : offText}`} className={`flex h-[28px] w-12 shrink-0 items-center rounded-full border-2 border-tinta p-0.5 ${on ? "justify-end bg-marca" : "justify-start bg-linea"}`}>
        <span className="size-5 rounded-full bg-tinta" />
      </span>
    </div>
  );
}

export default async function ProfilePage({ params }: PageProps<"/app/config/profiles/[id]">) {
  const [cfg, { id }, t] = await Promise.all([api().getConfig(), params, getMessages()]);
  const p = cfg.profiles.find((x) => x.id === id);
  if (!p) notFound();
  const m = t.profiles;
  const toolsByName = new Map(cfg.tools.map((x) => [x.name, x]));
  const departments = cfg.departments.filter((d) => d.profile).map((d) => d.name);
  const initial = {
    name: p.name,
    department: cfg.departments.find((d) => d.profile === p.name)?.name ?? "",
    persona: p.persona,
    languages: p.languages.map((l) => t.languages[l]),
    model: p.model,
    fallback: p.fallbackModel,
    tools: p.tools,
    budget: p.budgetPerConversation.replace(/[^\d,.]/g, "").replace(",", "."),
    maxTurns: p.maxTurnsBeforeHuman,
    aiDisclosure: p.aiDisclosure,
    agentSuggestions: p.agentSuggestions,
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <BackLink fallback="/app/config/profiles" label={m.title} />
        <span className="grow" />
        <PendingAction action={fmt(m.tryAction, { name: p.name })}>{m.try}</PendingAction>
        <PendingAction action={fmt(m.duplicateAction, { name: p.name })}>{m.duplicate}</PendingAction>
        <EntityFormButton mode="edit" title={m.editTitle} action={m.saveAction} label={m.edit} fields={profileFields(t, departments)} initial={initial} />
        <DeleteButton title={m.deleteTitle} action={m.deleteAction} name={p.name} consequence={m.deleteConsequence} confirmWord={p.name} />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-5">
          <Card emphasis className="flex flex-col gap-5 p-7">
            <div className="flex items-center gap-4">
              <Avatar initials={p.initials} tone="brand" size={60} />
              <div className="flex grow flex-col">
                <h1 className="text-[26px] font-bold">{p.name}</h1>
                <span className="text-[14px] text-muted">{p.department}</span>
              </div>
              <Chip tone="brand" mono>{p.promptVersion}</Chip>
            </div>
            <p className="text-[17px] leading-normal text-tinta-2">{p.persona}</p>
            <div className="flex flex-col gap-2">
              <Label>{m.greets}</Label>
              <div className="grid grid-cols-2 gap-3">
                {p.languages.map((l) => (
                  <div key={l} className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-muted">{t.languages[l]}</span>
                    <p lang={l} className="self-start rounded-[18px_18px_18px_4px] bg-fondo px-4 py-3 text-[15px]">{p.sampleGreeting[l]}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-6">
            <SectionTitle>{m.allowedTools}</SectionTitle>
            <ul className="flex flex-col">
              {p.tools.map((name) => {
                const tool = toolsByName.get(name);
                if (!tool) return null;
                return (
                  <li key={name} className="flex items-center gap-4 border-b border-linea-2 py-3 last:border-0">
                    <span className="flex grow flex-col">
                      <span className="font-semibold">{tool.title}</span>
                      <span className="tabular text-[13px] text-muted">{tool.name}</span>
                    </span>
                    <PermissionBadge permission={tool.permission} label={t.config.permission[tool.permission]} />
                  </li>
                );
              })}
            </ul>
            <Link href="/app/config/tools" className="text-[14px] font-semibold underline underline-offset-4">{m.allTools}</Link>
          </Card>

          <Card className="flex flex-col gap-3 p-6">
            <SectionTitle>{m.handoffWhen}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {p.handoffTriggers.map((x) => (
                <Chip key={x}>{x}</Chip>
              ))}
            </div>
            <p className="text-[13px] text-muted">{m.handoffNote}</p>
          </Card>
        </div>

        <div className="sticky top-7 flex flex-col gap-5">
          <Card className="flex flex-col gap-3 p-6">
            <SectionTitle>{m.engine}</SectionTitle>
            <KeyValue k={m.model} v={p.model} mono />
            <KeyValue k={m.fallback} v={p.fallbackModel} mono />
            <KeyValue k={m.guardrail} v={p.guardrail} mono />
            <KeyValue k={m.budget} v={p.budgetPerConversation} />
            <KeyValue k={m.maxTurns} v={String(p.maxTurnsBeforeHuman)} />
            <KeyValue k={m.languages} v={p.languages.map((l) => l.toUpperCase()).join(" · ")} />
          </Card>
          <Card className="flex flex-col gap-3 p-6">
            <SectionTitle>{m.behavior}</SectionTitle>
            <Toggle label={m.disclosure} hint={m.disclosureHint} on={p.aiDisclosure} onText={t.common.on} offText={t.common.off} />
            <Toggle label={m.suggestions} hint={m.suggestionsHint} on={p.agentSuggestions} onText={t.common.on} offText={t.common.off} />
          </Card>
          <Card className="flex flex-col gap-3 p-6">
            <SectionTitle>{m.versions}</SectionTitle>
            <ol className="flex flex-col gap-3">
              {p.promptHistory.map((v) => (
                <li key={v.version} className="flex gap-3">
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${v.current ? "bg-marca ring-2 ring-tinta" : "bg-punto"}`} aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="tabular text-[14px] font-bold">
                      {v.version} <span className="font-normal text-muted">· {v.date}</span>
                      {v.current && <span className="ml-2 font-sans text-[12px] font-semibold text-marca-texto">{m.inUse}</span>}
                    </span>
                    <span className="text-[14px] text-tinta-3">{v.note}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
