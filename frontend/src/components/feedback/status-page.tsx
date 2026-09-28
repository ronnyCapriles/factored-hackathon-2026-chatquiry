import type { ReactNode } from "react";
import { StateBubble } from "@/components/brand/sign";
import type { ConversationState } from "@/lib/api/types";

export function StatusPage({
  code,
  state,
  title,
  message,
  actions,
  detail,
}: {
  code: string;
  state: ConversationState;
  title: string;
  message: string;
  actions: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="flex grow items-center justify-center px-6 py-16">
      <div className="flex max-w-[620px] flex-col items-start gap-6">
        <div className="flex items-end gap-5">
          <span className="font-display text-[120px] leading-[0.8] tracking-[-0.04em] md:text-[160px]">{code}</span>
          <StateBubble state={state} size={96} />
        </div>
        <div className="perforado w-full" aria-hidden="true" />
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
        <p className="text-[18px] leading-normal text-tinta-3">{message}</p>
        <div className="flex flex-wrap gap-3">{actions}</div>
        {detail}
      </div>
    </div>
  );
}
