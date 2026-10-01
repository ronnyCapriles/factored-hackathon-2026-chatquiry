import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/sign";
import { Avatar } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import { staffLogout } from "@/lib/actions";
import { api } from "@/lib/api";
import type { Role, StaffUser } from "@/lib/api/types";
import type { Messages } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import { NavLink } from "./nav-link";

type NavKey = keyof Messages["nav"];

interface Group {
  title: NavKey;
  roles: Role[];
  items: { href: string; label: NavKey; icon: IconName }[];
}

// Agents and admins share "attention"; supervision and configuration are admin only.
const GROUPS: Group[] = [
  {
    title: "attention",
    roles: ["agent", "admin"],
    items: [
      { href: "/app/conversations", label: "conversations", icon: "chat" },
      { href: "/app/customers", label: "customers", icon: "users" },
      { href: "/app/disputes", label: "disputes", icon: "scale" },
      { href: "/app/test-chat", label: "testChat", icon: "phone" },
    ],
  },
  {
    title: "supervision",
    roles: ["admin"],
    items: [
      { href: "/app/operations", label: "operations", icon: "chart" },
      { href: "/app/audit", label: "audit", icon: "list" },
    ],
  },
  {
    title: "configuration",
    roles: ["admin"],
    items: [
      { href: "/app/config/departments", label: "map", icon: "map" },
      { href: "/app/config/profiles", label: "profiles", icon: "spark" },
      { href: "/app/config/tools", label: "tools", icon: "wrench" },
      { href: "/app/config/routing", label: "routing", icon: "route" },
      { href: "/app/config/guardrails", label: "guardrails", icon: "shield" },
      { href: "/app/config/policies", label: "policies", icon: "book" },
      { href: "/app/config/integrations", label: "integrations", icon: "plug" },
      { href: "/app/config/users", label: "users", icon: "key" },
    ],
  },
];

const AVAILABILITY_DOT = { available: "bg-tinta", paused: "bg-marca", offline: "bg-punto" };

export async function StaffShell({ user, children }: { user: StaffUser; children: ReactNode }) {
  const [profile, t] = await Promise.all([api().getProfile(user.id), getMessages()]);
  const availability = profile?.availability ?? "available";

  return (
    <div className="grid h-dvh min-h-[640px] grid-cols-[256px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r-[1.5px] border-linea bg-superficie">
        <Link href={user.role === "admin" ? "/app/operations" : "/app/conversations"} className="flex h-[68px] shrink-0 items-center px-5" aria-label={t.nav.home}>
          <Wordmark size={30} />
        </Link>
        <nav className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-3 pb-4 pt-2" aria-label={t.nav.main}>
          {GROUPS.filter((g) => g.roles.includes(user.role)).map((g) => (
            <div key={g.title} className="flex flex-col gap-1">
              <span className="etiqueta px-3 pb-1">{t.nav[g.title]}</span>
              {g.items.map((i) => (
                <NavLink key={i.href} href={i.href} icon={i.icon}>
                  {t.nav[i.label]}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t-[1.5px] border-linea p-3">
          <Link href="/app/settings/profile" className="flex min-w-0 grow items-center gap-2.5 rounded-fila p-2 hover:bg-fondo" aria-label={t.nav.myProfile}>
            <span className="relative">
              <Avatar initials={user.initials} src={profile?.avatarUrl} tone={user.role === "admin" ? "brand" : "ink"} size={38} />
              <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-superficie ${AVAILABILITY_DOT[availability]}`} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[14px] font-semibold">{profile?.name ?? user.name}</span>
              <span className="truncate text-[12px] text-muted">
                {t.roles[user.role]} · {t.availability[availability]}
              </span>
            </span>
          </Link>
          <form action={staffLogout}>
            <button type="submit" aria-label={t.nav.logout} title={t.nav.logout} className="flex size-10 items-center justify-center rounded-full text-tinta-3 hover:bg-fondo hover:text-tinta">
              <Icon name="logout" size={19} />
            </button>
          </form>
        </div>
      </aside>
      {/* relative keeps absolutely positioned descendants (sr-only labels) inside the scroll area instead of stretching the page. */}
      <main className="relative flex min-h-0 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
