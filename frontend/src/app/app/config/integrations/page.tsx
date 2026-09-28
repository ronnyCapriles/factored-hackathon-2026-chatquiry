import { DeleteButton, EntityFormButton, PendingAction } from "@/components/crud";
import { apiKeyFields, channelFields, connectorFields } from "@/components/crud/forms";
import { ConfigHeader, SectionTitle } from "@/components/config/parts";
import { Card, Label, Perforado } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";

export async function generateMetadata() {
  return { title: (await getMessages()).integrations.title };
}

export default async function IntegrationsPage() {
  const [{ apiKeys, channels, connectors }, cfg, t] = await Promise.all([api().getIntegrations(), api().getConfig(), getMessages()]);
  const m = t.integrations;
  const departments = cfg.departments.filter((d) => d.profile).map((d) => d.name);

  return (
    <>
      <ConfigHeader title={m.title} lead={m.lead} />

      <div className="grid grid-cols-3 items-start gap-5">
        <Card emphasis className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>{m.apiKeys}</SectionTitle>
            <EntityFormButton mode="create" title={m.newKey} action={m.createKeyAction} label={m.create} fields={apiKeyFields(t)} description={m.keyNote} />
          </div>
          {apiKeys.map((k) => (
            <div key={k.id} className="flex flex-col gap-1 rounded-fila bg-fondo px-4 py-3">
              <div className="flex justify-between gap-2">
                <b>{k.name}</b>
                <span className="text-[13px] text-muted">{k.environment === "live" ? m.live : m.test}</span>
              </div>
              <span className="tabular text-[14px]">{k.masked}</span>
              <span className="text-[13px] text-muted">{k.scopes.join(" · ")}</span>
              <div className="flex gap-2 pt-1.5">
                <PendingAction action={fmt(m.rotateAction, { name: k.name })} confirm={m.rotateConfirm}>{m.rotate}</PendingAction>
                <DeleteButton title={m.revokeTitle} action={m.revokeAction} label={m.revoke} name={k.name} consequence={m.revokeConsequence} confirmWord="REVOKE" />
              </div>
            </div>
          ))}
          <Perforado />
          <Label>{m.identity}</Label>
          <p className="text-[14px] leading-normal">{m.identityText}</p>
          <p className="text-[13px] text-muted">{m.identityNote}</p>
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>{m.channels}</SectionTitle>
            <EntityFormButton mode="create" title={m.newChannel} action={m.connectAction} label={m.connect} fields={channelFields(t, departments)} />
          </div>
          <ul>
            {channels.map((c) => (
              <li key={c.channel} className="flex min-h-[56px] items-center justify-between gap-3 border-b border-linea-2 last:border-0">
                <span className="flex flex-col">
                  <b>{c.name}</b>
                  <span className="text-[13px] text-muted">{c.detail}</span>
                </span>
                <span className="font-semibold">{c.status}</span>
              </li>
            ))}
          </ul>
          <pre className="tabular overflow-x-auto rounded-fila bg-panel px-4 py-3.5 text-[13px] leading-relaxed text-panel-texto">{`<script src="https://…/chatquiry.js"\n  data-key="cq_live_…"></script>`}</pre>
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>{m.connectors}</SectionTitle>
            <EntityFormButton mode="create" title={m.newConnector} action={m.addConnectorAction} label={m.add} fields={connectorFields(t)} />
          </div>
          <ul>
            {connectors.map((c) => (
              <li key={c.name} className="flex min-h-[60px] items-center justify-between gap-3 border-b border-linea-2 last:border-0">
                <span className="flex flex-col">
                  <b>{c.name}</b>
                  <span className="text-[13px] text-muted">{c.detail}</span>
                </span>
                <span className={`font-semibold ${c.planned ? "text-muted" : ""}`}>{c.status}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-normal text-muted">{m.connectorsNote}</p>
        </Card>
      </div>
    </>
  );
}
