import Link from "next/link";
import { EntityFormButton } from "@/components/crud";
import { profileFields } from "@/components/crud/forms";
import { Chip, ConfigHeader } from "@/components/config/parts";
import { Avatar, Card } from "@/components/ui";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";

export async function generateMetadata() {
  return { title: (await getMessages()).profiles.title };
}

export default async function ProfilesPage() {
  const [cfg, t] = await Promise.all([api().getConfig(), getMessages()]);
  const p = t.profiles;
  const active = new Set(cfg.departments.map((d) => d.profile).filter(Boolean));
  const departments = cfg.departments.filter((d) => d.profile).map((d) => d.name);

  return (
    <>
      <ConfigHeader
        title={p.title}
        lead={p.lead}
        aside={
          <EntityFormButton
            mode="create"
            title={p.new}
            action={p.createAction}
            fields={profileFields(t, departments)}
            initial={{ languages: [t.languages.es, t.languages.pt], aiDisclosure: true, agentSuggestions: true }}
          />
        }
      />

      <div className="grid grid-cols-2 gap-5 xl:grid-cols-3">
        {cfg.profiles.map((x) => {
          const live = active.has(x.name);
          return (
            <Link key={x.id} href={`/app/config/profiles/${x.id}`} className="group">
              <Card emphasis={live} className="flex h-full flex-col gap-4 p-6 transition group-hover:shadow-[6px_6px_0_var(--sombra)]">
                <div className="flex items-center gap-4">
                  <Avatar initials={x.initials} tone={live ? "brand" : "light"} size={52} />
                  <div className="flex grow flex-col">
                    <span className="text-[22px] font-bold">{x.name}</span>
                    <span className="text-[13px] text-muted">{x.department}</span>
                  </div>
                  {live ? <Chip tone="ink">{p.active}</Chip> : <Chip>{p.draft}</Chip>}
                </div>
                <p className="line-clamp-2 text-[15px] text-tinta-2">{x.persona}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip mono>{x.model}</Chip>
                  <Chip mono>{x.promptVersion}</Chip>
                  <Chip>{x.languages.map((l) => l.toUpperCase()).join(" · ")}</Chip>
                  <Chip>{fmt(p.toolsCount, { n: x.tools.length })}</Chip>
                </div>
                <span className="grow" />
                <span className="text-[14px] font-semibold underline underline-offset-4">{p.view}</span>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
