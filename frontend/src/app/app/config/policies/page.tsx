import { StateBubble } from "@/components/brand/sign";
import { DeleteButton, EntityFormButton, PendingAction } from "@/components/crud";
import { policyFields } from "@/components/crud/forms";
import { Chip, ConfigHeader, SectionTitle } from "@/components/config/parts";
import { Card, KeyValue } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";

export async function generateMetadata() {
  return { title: (await getMessages()).policies.title };
}

export default async function PoliciesPage() {
  const [{ policies }, t] = await Promise.all([api().getConfig(), getMessages()]);
  const m = t.policies;
  const fields = policyFields(t, [...new Set(policies.map((p) => p.domain))]);

  return (
    <>
      <ConfigHeader title={m.title} lead={m.lead} aside={<EntityFormButton mode="create" title={m.new} action={m.createAction} fields={fields} />} />
      <p className="rounded-fila border-[1.5px] border-dashed border-punto bg-superficie px-5 py-3 text-[14px] text-tinta-3">{m.synthetic}</p>

      {policies.map((p) => (
        <Card key={p.id} emphasis className="grid grid-cols-1 gap-8 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-7">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[24px] font-bold">{p.name}</h2>
              <Chip mono>{p.id}</Chip>
              <Chip tone="brand" mono>{p.version}</Chip>
              <Chip>{p.domain}</Chip>
              <span className="grow" />
              <PendingAction action={fmt(m.runTestsAction, { n: p.testCases, id: p.id })}>{m.runTests}</PendingAction>
              <EntityFormButton
                mode="edit"
                title={m.newVersionTitle}
                action={m.newVersionAction}
                label={m.newVersion}
                fields={fields}
                description={m.versionNote}
                initial={{ name: p.name, domain: p.domain, description: p.description, parameters: p.parameters.map((x) => `${x.name} = ${x.value}`).join("\n") }}
              />
              <DeleteButton title={m.archiveTitle} action={m.archiveAction} label={m.archive} name={p.id} consequence={m.archiveConsequence} confirmWord={p.id} />
            </div>
            <p className="text-[16px] text-tinta-2">{p.description}</p>

            <div className="flex flex-col gap-2">
              <SectionTitle>{m.decisions}</SectionTitle>
              <ol className="flex flex-col gap-2">
                {p.outcomes.map((o) => (
                  <li key={o.when} className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-3 rounded-fila bg-fondo px-4 py-3 text-[15px]">
                    <span>
                      <span className="font-semibold text-muted">{m.when} </span>
                      {o.when}
                    </span>
                    <span className="text-center text-muted" aria-hidden="true">→</span>
                    <span className="flex items-center gap-2 font-semibold">
                      <StateBubble state={o.human ? "with_human" : "ai_attending"} size={24} />
                      {o.decision}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="flex flex-col gap-5 border-l-[1.5px] border-linea pl-8">
            <div className="flex flex-col gap-2.5">
              <SectionTitle>{m.parameters}</SectionTitle>
              {p.parameters.map((x) => (
                <KeyValue key={x.name} k={x.name} v={x.value} />
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <SectionTitle>{m.quality}</SectionTitle>
              <KeyValue k={m.testCases} v={String(p.testCases)} />
              <KeyValue k={m.usedBy} v={p.usedBy.join(" · ")} />
            </div>
            <div className="flex flex-col gap-2">
              <SectionTitle>{m.history}</SectionTitle>
              {p.history.map((h) => (
                <span key={h.version} className="text-[14px]">
                  <span className="tabular font-bold">{h.version}</span> · {h.date} · {h.note}
                </span>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}
