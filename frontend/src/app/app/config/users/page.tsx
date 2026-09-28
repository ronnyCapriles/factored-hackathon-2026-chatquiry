import { DeleteButton, EntityFormButton } from "@/components/crud";
import { userFields } from "@/components/crud/forms";
import { Chip, ConfigHeader, SectionTitle } from "@/components/config/parts";
import { Avatar, Card, Table, Td, Th } from "@/components/ui";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";

export async function generateMetadata() {
  return { title: (await getMessages()).users.title };
}

export default async function UsersPage() {
  const [users, perms, t] = await Promise.all([api().listStaff(), api().rolePermissions(), getMessages()]);
  const m = t.users;
  const fields = userFields(t, [...new Set(users.map((u) => u.team))], [...new Set(users.flatMap((u) => u.skills))]);

  return (
    <>
      <ConfigHeader title={m.title} lead={m.lead} aside={<EntityFormButton mode="create" title={m.new} action={m.createAction} fields={fields} description={m.newNote} />} />

      <Card className="px-6 py-4">
        <Table>
          <thead>
            <tr>
              <Th>{m.person}</Th>
              <Th>{m.role}</Th>
              <Th>{m.team}</Th>
              <Th>{m.languages}</Th>
              <Th>{m.skills}</Th>
              <Th>{m.shift}</Th>
              <Th align="right">{m.capacity}</Th>
              <Th>{m.status}</Th>
              <Th align="right"><span className="sr-only">{t.common.actions}</span></Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <Td>
                  <span className="flex items-center gap-3">
                    <Avatar initials={u.initials} src={u.avatarUrl} tone={u.role === "admin" ? "brand" : "ink"} size={36} />
                    <span className="flex flex-col">
                      <span className="font-semibold">{u.name}</span>
                      <span className="text-[12px] text-muted">{u.email}</span>
                    </span>
                  </span>
                </Td>
                <Td>{u.role === "admin" ? t.roles.admin : t.roles.agentShort}</Td>
                <Td>{u.team}</Td>
                <Td>{u.languages.join(", ")}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {u.skills.map((s) => (
                      <Chip key={s}>{s}</Chip>
                    ))}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">{u.shift}</Td>
                <Td align="right" className="tabular">{u.maxConcurrentChats || "—"}</Td>
                <Td className="whitespace-nowrap">{t.availability[u.availability]}</Td>
                <Td align="right">
                  <span className="flex justify-end gap-1.5">
                    <EntityFormButton
                      mode="edit"
                      title={m.editTitle}
                      action={m.saveAction}
                      iconOnly
                      fields={fields}
                      initial={{ name: u.name, email: u.email, role: t.roles[u.role], team: u.team, languages: u.languages, skills: u.skills, shift: u.shift, capacity: u.maxConcurrentChats }}
                    />
                    <DeleteButton title={m.deactivateTitle} action={m.deactivateAction} label={m.deactivate} name={u.name} consequence={m.deactivateConsequence} iconOnly />
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="pt-3 text-[13px] text-muted">{m.note}</p>
      </Card>

      <Card className="flex max-w-[860px] flex-col gap-2 px-6 py-5">
        <SectionTitle>{m.rolesTitle}</SectionTitle>
        <Table>
          <thead>
            <tr>
              <Th>{m.permission}</Th>
              <Th className="w-[140px] text-center">{t.roles.agentShort}</Th>
              <Th className="w-[140px] text-center">{t.roles.admin}</Th>
            </tr>
          </thead>
          <tbody>
            {perms.map((p) => (
              <tr key={p.permission}>
                <Td>{p.permission}</Td>
                <Td className={`text-center ${p.agent === "sí" ? "font-bold" : "text-muted"}`}>{p.agent}</Td>
                <Td className={`text-center ${p.admin === "sí" ? "font-bold" : "text-muted"}`}>{p.admin}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
