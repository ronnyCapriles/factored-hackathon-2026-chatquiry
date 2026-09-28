import { StateBubble } from "@/components/brand/sign";
import { DeleteButton, EntityFormButton, PendingAction } from "@/components/crud";
import { toolFields } from "@/components/crud/forms";
import { Chip, ConfigHeader, PERMISSION_STATE, PermissionBadge } from "@/components/config/parts";
import { Card, KeyValue, Label } from "@/components/ui";
import { FilterBar, FilterSelect } from "@/components/ui/filters";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";
import type { ToolPermission } from "@/lib/api/types";

export async function generateMetadata() {
  return { title: (await getMessages()).tools.title };
}

const ORDER: ToolPermission[] = ["read", "customer_confirm", "human_only"];

export default async function ToolsPage({ searchParams }: PageProps<"/app/config/tools">) {
  const [{ tools, profiles }, sp, t] = await Promise.all([api().getConfig(), searchParams, getMessages()]);
  const m = t.tools;
  const perm = t.config.permission;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = str("q").toLowerCase();
  const shown = tools.filter(
    (x) =>
      (!q || `${x.name} ${x.title} ${x.description}`.toLowerCase().includes(q)) &&
      (!str("permission") || x.permission === str("permission")) &&
      (!str("connector") || x.connector === str("connector")) &&
      (!str("profile") || (str("profile") === "none" ? x.profiles.length === 0 : x.profiles.includes(str("profile")))),
  );
  const connectors = [...new Set(tools.map((x) => x.connector))];
  const fields = toolFields(t, connectors, profiles.map((p) => p.name));
  const roleShort = { agent: t.roles.agentsShort, admin: t.roles.adminShort };

  return (
    <>
      <ConfigHeader title={m.title} lead={m.lead} aside={<EntityFormButton mode="create" title={m.new} action={m.createAction} fields={fields} description={m.newNote} />} />

      <div className="grid grid-cols-3 gap-5">
        {ORDER.map((p) => {
          const alert = p === "human_only";
          return (
            <Card key={p} emphasis={alert} className="flex items-start gap-4 p-5">
              <StateBubble state={PERMISSION_STATE[p]} size={44} />
              <span className="flex flex-col gap-1">
                <span className={`text-[17px] font-bold ${alert ? "text-atencion" : ""}`}>{perm[p]}</span>
                <span className="text-[14px] text-tinta-3">{perm[`${p}Hint`]}</span>
                <span className="tabular pt-1 text-[13px] text-muted">{fmt(m.count, { n: tools.filter((x) => x.permission === p).length })}</span>
              </span>
            </Card>
          );
        })}
      </div>

      <FilterBar search searchPlaceholder={m.searchPlaceholder}>
        <FilterSelect name="permission" label={m.permission} value={str("permission")} options={ORDER.map((p) => ({ value: p, label: perm[p] }))} />
        <FilterSelect name="connector" label={m.connector} value={str("connector")} options={connectors.map((c) => ({ value: c, label: c }))} />
        <FilterSelect name="profile" label={m.profile} value={str("profile")} options={[...profiles.map((p) => ({ value: p.name, label: p.name })), { value: "none", label: m.onlyHumans }]} />
      </FilterBar>

      <div className="flex flex-col gap-3">
        <span className="text-[14px] text-muted">{fmt(m.shown, { n: shown.length, total: tools.length })}</span>
        {shown.length === 0 && <p className="rounded-tarjeta border-[1.5px] border-dashed border-punto bg-superficie px-6 py-8 text-center text-tinta-3">{m.empty}</p>}
        {shown.map((x) => (
          <details key={x.name} className="group rounded-tarjeta border-[1.5px] border-linea bg-superficie open:border-2 open:border-tinta">
            <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-4 [&::-webkit-details-marker]:hidden">
              <span className="flex grow flex-col">
                <span className="text-[17px] font-bold">{x.title}</span>
                <span className="tabular text-[13px] text-muted">{x.name} · {x.connector}</span>
              </span>
              <span className="hidden gap-1.5 md:flex">
                {x.profiles.length ? x.profiles.map((p) => <Chip key={p} tone="brand">{fmt(m.ai, { name: p })}</Chip>) : <Chip>{m.noAi}</Chip>}
              </span>
              <PermissionBadge permission={x.permission} label={perm[x.permission]} />
              <svg className="shrink-0 transition group-open:rotate-180" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-6 border-t-[1.5px] border-linea px-6 py-5">
              <div className="flex flex-col gap-3">
                <p className="text-[15px]">{x.description}</p>
                <div className="flex flex-col gap-1 rounded-fila bg-marca-suave px-4 py-3">
                  <Label className="text-marca-texto">{m.howProtected}</Label>
                  <span className="text-[14px]">{x.scope}</span>
                </div>
                <KeyValue k={m.rateLimit} v={x.rateLimit} />
                <KeyValue k={m.humanRoles} v={x.humanRoles.map((r) => roleShort[r]).join(" · ") || "—"} />
                <div className="flex flex-wrap gap-2 pt-2">
                  <PendingAction action={fmt(m.testAction, { name: x.name })}>{m.test}</PendingAction>
                  <EntityFormButton
                    mode="edit"
                    title={m.editTitle}
                    action={m.saveAction}
                    fields={fields}
                    initial={{ name: x.name, title: x.title, connector: x.connector, permission: perm[x.permission], description: x.description, profiles: x.profiles, inputSchema: x.inputSchema }}
                  />
                  <DeleteButton title={m.deleteTitle} action={m.deleteAction} name={x.name} consequence={m.deleteConsequence} confirmWord={x.name} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{m.input}</Label>
                <pre className="tabular overflow-x-auto rounded-fila bg-panel px-4 py-3.5 text-[13px] leading-relaxed text-panel-texto">{x.inputSchema}</pre>
                <span className="text-[12px] text-muted">{m.schemaNote}</span>
              </div>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
