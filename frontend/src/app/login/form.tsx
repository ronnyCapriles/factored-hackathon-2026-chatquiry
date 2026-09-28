"use client";

import { useActionState } from "react";
import { useMessages } from "@/i18n/client";
import { staffLogin, type FormState } from "@/lib/actions";

const input = "h-[52px] rounded-fila border-[1.5px] border-linea bg-superficie px-4 text-[16px]";

export function StaffLoginForm({ email, next }: { email: string; next: string }) {
  const t = useMessages();
  const [state, action, pending] = useActionState<FormState, FormData>(staffLogin, {});
  return (
    <form action={action} className="flex max-w-[460px] flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
        {t.login.email}
        <input name="email" type="email" required autoComplete="username" defaultValue={email} className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
        {t.login.password}
        <input name="password" type="password" required autoComplete="current-password" className={input} />
      </label>
      {state.error && (
        <p className="text-[14px] font-semibold text-atencion" role="alert">{t.login.invalid}</p>
      )}
      <button type="submit" disabled={pending} className="mt-1.5 h-[52px] rounded-full border-2 border-tinta bg-marca text-[17px] font-bold disabled:opacity-60">
        {pending ? t.login.submitting : t.login.submit}
      </button>
    </form>
  );
}
