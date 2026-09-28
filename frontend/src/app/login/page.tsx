import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/sign";
import { PrefsSwitcher } from "@/components/prefs-switcher";
import { getMessages, getTheme } from "@/i18n/server";
import { getStaffSession, homeFor, safeNext } from "@/lib/session";
import { StaffLoginForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).login.title };
}

const DEMO_EMAIL = { agent: "andrea.rios@chatquiry.demo", admin: "marco.vidal@chatquiry.demo" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [sp, t, theme] = await Promise.all([searchParams, getMessages(), getTheme()]);
  const next = safeNext(sp.next);
  const session = await getStaffSession();
  if (session) redirect(next ?? homeFor(session.user.role));

  const role = sp.as === "admin" ? "admin" : "agent";
  const tab = (r: "agent" | "admin") => `/login?as=${r}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-2">
      <section className="flex flex-col gap-7 border-tinta bg-marca px-8 py-10 md:border-r-2 md:px-20 md:py-14">
        <Link href="/" className="inline-flex items-center gap-2 self-start text-[15px] font-semibold underline underline-offset-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {t.login.back}
        </Link>
        <Wordmark size={52} onBrand />
        <span className="hidden grow md:block" />
        <h1 className="text-[44px] font-bold leading-[1.02] tracking-[-0.03em] md:text-[64px]">
          {t.landing.hero.title1}
          <br />
          {t.landing.hero.title2}
        </h1>
        <p className="max-w-[520px] text-[18px] leading-normal md:text-[20px]">{t.login.lead}</p>
      </section>

      <section className="relative flex flex-col justify-center gap-6 px-8 pb-12 pt-24 md:px-24">
        <div className="absolute left-8 top-10 md:left-24">
          <PrefsSwitcher theme={theme} />
        </div>
        <h2 className="text-[36px] font-bold">{t.login.title}</h2>
        {next?.startsWith("/app/test-chat") && (
          <p className="max-w-[460px] rounded-fila border-2 border-tinta bg-marca-suave px-4 py-3 text-[14px]">{t.login.testChatNote}</p>
        )}
        {sp.expired === "1" && (
          <p className="max-w-[460px] rounded-fila border-[1.5px] border-linea bg-superficie px-4 py-3 text-[14px]" role="status">{t.login.expired}</p>
        )}
        <div className="flex max-w-[460px] gap-1 rounded-full bg-superficie p-1 ring-[1.5px] ring-linea" role="tablist" aria-label={t.login.demoAccount}>
          {(["agent", "admin"] as const).map((r) => (
            <Link
              key={r}
              href={tab(r)}
              replace
              role="tab"
              aria-selected={role === r}
              className={`flex h-10 grow items-center justify-center rounded-full text-[14px] font-semibold ${role === r ? "bg-tinta text-fondo" : "hover:bg-fondo"}`}
            >
              {t.roles[r]}
            </Link>
          ))}
        </div>
        <StaffLoginForm key={role} email={DEMO_EMAIL[role]} next={next ?? ""} />
      </section>
    </div>
  );
}
