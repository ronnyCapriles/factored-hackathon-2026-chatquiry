import { notFound } from "next/navigation";
import { Card, KeyValue, Label } from "@/components/ui";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";
import { requireStaff } from "@/lib/session";
import { ProfileForm } from "./profile-form";

export async function generateMetadata() {
  return { title: (await getMessages()).profile.title };
}

export default async function ProfilePage() {
  const user = await requireStaff();
  const [profile, t] = await Promise.all([api().getProfile(user.id), getMessages()]);
  if (!profile) notFound();
  const m = t.profile;

  return (
    <div className="flex flex-col gap-6 px-8 py-7">
      <div className="flex flex-col gap-2">
        <h1 className="text-[30px] font-bold tracking-tight">{m.title}</h1>
        <p className="max-w-[760px] text-[16px] text-tinta-3">{m.lead}</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6">
        <ProfileForm profile={profile} />

        <aside className="sticky top-7 flex flex-col gap-5">
          <Card className="flex flex-col gap-3 p-6">
            <Label>{m.assigned}</Label>
            <KeyValue k={m.email} v={profile.email} />
            <KeyValue k={m.role} v={t.roles[profile.role]} />
            <KeyValue k={m.team} v={profile.team} />
            <KeyValue k={m.languages} v={profile.languages.join(", ")} />
            <KeyValue k={m.skills} v={profile.skills.join(", ")} />
            <KeyValue k={m.shift} v={profile.shift} />
            <KeyValue k={m.capacity} v={profile.maxConcurrentChats ? String(profile.maxConcurrentChats) : m.noChats} />
            <p className="pt-1 text-[13px] text-muted">{m.assignedNote}</p>
          </Card>
          <Card className="flex flex-col gap-3 p-6">
            <Label>{m.security}</Label>
            <KeyValue k={m.lastLogin} v={profile.lastLogin} />
            <KeyValue k={m.idle} v="15 min" />
            <p className="text-[13px] text-muted">{m.securityNote}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
