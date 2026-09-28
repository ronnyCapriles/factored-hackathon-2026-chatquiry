"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";

export function NavLink({ href, icon, children }: { href: string; icon: IconName; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-10 items-center gap-3 rounded-fila px-3 text-[14px] transition ${
        active ? "border-2 border-tinta bg-marca font-bold text-tinta" : "border-2 border-transparent font-medium text-tinta-3 hover:bg-fondo hover:text-tinta"
      }`}
    >
      <Icon name={icon} size={19} />
      {children}
    </Link>
  );
}
