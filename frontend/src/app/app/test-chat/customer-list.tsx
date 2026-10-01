"use client";

import Link from "next/link";
import { StateBubble } from "@/components/brand/sign";
import { useMessages } from "@/i18n/client";
import type { TestCustomer } from "@/lib/api/types";
import { useSessions } from "./sessions";

export function CustomerList({ customers, selectedId }: { customers: TestCustomer[]; selectedId: string }) {
  const t = useMessages();
  const sessions = useSessions();

  return (
    <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto pb-1">
      {customers.map((c) => {
        const active = c.customerId === selectedId;
        const session = sessions[c.customerId];
        const state = session?.turns.at(-1)?.state;
        const sent = session?.messages.filter((m) => m.author === "customer").length ?? 0;
        return (
          <li key={c.customerId}>
            <Link
              href={`?customer=${c.customerId}`}
              replace
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={`flex flex-col gap-1 rounded-fila p-3 ${active ? "border-2 border-tinta bg-marca-suave" : "border-[1.5px] border-linea bg-superficie hover:border-punto"}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold leading-snug">{c.fullName}</span>
                {state && <StateBubble state={state} size={22} />}
              </span>
              <span className="text-[13px] text-tinta-3">
                {c.country} · {t.languages[c.language]}
              </span>
              <span className="text-[13px] leading-snug text-muted">{c.hint}</span>
              {sent > 0 && <span className="text-[12px] font-semibold text-tinta-3">{t.testChat.inProgress}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
