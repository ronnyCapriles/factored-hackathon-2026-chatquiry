import Link from "next/link";
import type { ReactNode } from "react";
import { StateBubble } from "@/components/brand/sign";
import { DeleteButton, EntityFormButton } from "@/components/crud";
import { departmentFields } from "@/components/crud/forms";
import { Chip, ConfigHeader, SectionTitle } from "@/components/config/parts";
import { Avatar, Card, KeyValue, Label } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";

export async function generateMetadata() {
  return { title: (await getMessages()).departments.title };
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <span className="etiqueta">{title}</span>
      {children}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center pt-7 text-punto-2" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h15M13 6l6 6-6 6" />
      </svg>
    </div>
  );
}

export default async function DepartmentsPage() {
  const [cfg, t] = await Promise.all([api().getConfig(), getMessages()]);
  const d = t.departments;
  const serving = cfg.departments.filter((x) => x.id !== "DEP-INTAKE");
  const channels = cfg.departments[0].channels;
  const fields = departmentFields(t);

  return (
    <>
      <ConfigHeader
        title={d.title}
        lead={d.lead}
        aside={<EntityFormButton mode="create" title={d.new} action={d.createAction} fields={fields} initial={{ channels: [t.channels.whatsapp, t.channels.widget, t.channels.api] }} />}
      />

      <Card emphasis className="overflow-x-auto p-6">
        <div className="grid min-w-[1080px] grid-cols-[1fr_auto_1.15fr_auto_1.2fr_auto_1.35fr_auto_1fr] gap-3">
          <Column title={d.channels}>
            {channels.map((c) => (
              <div key={c} className="flex h-11 items-center rounded-fila border-[1.5px] border-linea bg-superficie px-3.5 text-[14px] font-semibold">
                {t.channels[c]}
              </div>
            ))}
          </Column>
          <Arrow />
          <Column title={d.intake}>
            <div className="flex flex-col gap-2 rounded-fila bg-panel p-4 text-panel-texto">
              <span className="font-bold">{d.intakeFast}</span>
              <span className="text-[13px] opacity-90">{cfg.intake.guardrail}</span>
              <span className="text-[13px] opacity-90">{cfg.intake.classifier}</span>
              <Link href="/app/config/routing#intake" className="text-[13px] font-semibold underline underline-offset-4">
                {t.routing.jev.seeRequest}
              </Link>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {cfg.intake.signals.map((s) => (
                  <span key={s.name} className="tabular rounded-full bg-panel-2 px-2 py-0.5 text-[12px]">{s.name}</span>
                ))}
              </div>
            </div>
          </Column>
          <Arrow />
          <Column title={d.routing}>
            {cfg.routing.map((r) => (
              <Link key={r.id} href={`/app/config/routing#${r.id}`} className="flex items-center gap-2 rounded-fila border-[1.5px] border-linea bg-superficie px-3 py-2 text-[13px] hover:border-tinta">
                <span className="tabular font-bold">{r.id}</span>
                <span className="truncate">{r.name}</span>
              </Link>
            ))}
          </Column>
          <Arrow />
          <Column title={d.departments}>
            <div className="flex flex-col gap-2 rounded-fila border-[1.5px] border-dashed border-atencion bg-superficie p-3 text-[13px]">
              <span className="inline-flex items-center gap-2 font-semibold text-atencion">
                <StateBubble state="needs_human" size={22} /> {d.security}
              </span>
              <span className="text-muted">{d.securityHint}</span>
            </div>
            {serving.map((x) => (
              <a key={x.id} href={`#${x.id}`} className="flex flex-col gap-1.5 rounded-fila border-2 border-tinta bg-marca-suave p-3 hover:border-marca-texto">
                <span className="font-bold">{x.name}</span>
                {x.profile && (
                  <span className="inline-flex items-center gap-1.5 text-[13px]">
                    <StateBubble state="ai_attending" size={20} /> {fmt(d.ai, { name: x.profile })}
                  </span>
                )}
              </a>
            ))}
          </Column>
          <Arrow />
          <Column title={d.humanTeams}>
            {serving.map((x) => (
              <div key={x.id} className="flex flex-col gap-2 rounded-fila border-[1.5px] border-linea bg-superficie p-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
                  <StateBubble state="with_human" size={20} /> {x.name}
                </span>
                {x.humanTeam.map((m) => (
                  <span key={m.id} className="flex items-center gap-2 text-[13px]">
                    <Avatar initials={m.initials} tone="ink" size={26} /> {m.name}
                  </span>
                ))}
              </div>
            ))}
          </Column>
        </div>
      </Card>

      <section className="flex flex-col gap-4" aria-labelledby="deps">
        <SectionTitle id="deps">{d.list}</SectionTitle>
        <div className="grid grid-cols-3 gap-5">
          {cfg.departments.map((x) => (
            <Card key={x.id} className="flex scroll-mt-6 flex-col gap-3.5 p-6" as="section">
              <div id={x.id} className="flex items-start justify-between gap-3">
                <h3 className="text-[20px] font-bold leading-tight">{x.name}</h3>
                <span className="tabular text-[12px] text-muted">{x.id}</span>
              </div>
              {x.id !== "DEP-INTAKE" && (
                <div className="flex gap-2">
                  <EntityFormButton
                    mode="edit"
                    title={d.editTitle}
                    action={d.saveAction}
                    fields={fields}
                    initial={{ name: x.name, purpose: x.purpose, profile: x.profile ?? "", team: x.humanTeam.map((m) => m.name), channels: x.channels.map((c) => t.channels[c]), hours: x.hours }}
                  />
                  <DeleteButton title={d.deleteTitle} action={d.deleteAction} name={x.name} consequence={d.deleteConsequence} confirmWord={x.name.split(" ")[0]} />
                </div>
              )}
              <p className="text-[15px] leading-normal text-tinta-2">{x.purpose}</p>
              <KeyValue k={d.aiProfile} v={x.profile ?? d.noAi} />
              <KeyValue k={d.firstResponse} v={x.firstResponseSla} />
              <KeyValue k={d.hours} v={x.hours} />
              <div className="flex flex-col gap-2">
                <Label>{d.humanTeam}</Label>
                {x.humanTeam.length ? (
                  <div className="flex flex-wrap gap-2">
                    {x.humanTeam.map((m) => (
                      <span key={m.id} className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-linea bg-fondo py-1 pl-1 pr-3 text-[13px] font-semibold">
                        <Avatar initials={m.initials} tone="ink" size={24} /> {m.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[14px] text-muted">{t.common.automatic}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{d.rulesHere}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {x.rules.map((r) => (
                    <Link key={r} href={`/app/config/routing#${r}`}>
                      <Chip mono>{r}</Chip>
                    </Link>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
