import Link from "next/link";
import type { ReactNode } from "react";
import { StateBubble, Wordmark } from "@/components/brand/sign";
import { PrefsSwitcher } from "@/components/prefs-switcher";
import { ButtonLink, Card } from "@/components/ui";
import { getMessages, getTheme } from "@/i18n/server";

const STATES = ["ai_attending", "with_human", "needs_human", "resolved"] as const;

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1160px] px-6 md:px-10 ${className}`}>{children}</div>;
}

function Pill({ children }: { children: ReactNode }) {
  return <div className="flex h-14 items-center rounded-fila border-[1.5px] border-linea bg-superficie px-[18px] text-[17px] font-semibold">{children}</div>;
}

export default async function Landing() {
  const [t, theme] = await Promise.all([getMessages(), getTheme()]);
  const l = t.landing;
  const steps = [
    [l.how.s1Title, l.how.s1Text],
    [l.how.s2Title, l.how.s2Text],
    [l.how.s3Title, l.how.s3Text],
    [l.how.s4Title, l.how.s4Text],
    [l.how.s5Title, l.how.s5Text],
  ];
  const principles = [
    [l.philosophy.p1Title, l.philosophy.p1Text],
    [l.philosophy.p2Title, l.philosophy.p2Text],
    [l.philosophy.p3Title, l.philosophy.p3Text],
  ];
  const roles = [
    { title: l.demo.customerTitle, text: l.demo.customerText, cta: l.demo.customerCta, href: "/login?next=/app/test-chat" },
    { title: l.demo.agentTitle, text: l.demo.agentText, cta: l.demo.agentCta, href: "/login?as=agent", emphasis: true },
    { title: l.demo.adminTitle, text: l.demo.adminText, cta: l.demo.adminCta, href: "/login?as=admin" },
  ];

  return (
    <div className="flex flex-col">
      <Container>
        <nav className="flex h-[84px] items-center gap-6" aria-label={t.nav.main}>
          <Wordmark size={37} />
          <span className="grow" />
          <div className="hidden items-center gap-7 lg:flex">
            <a href="#filosofia" className="font-medium text-tinta-3 hover:text-tinta">{l.nav.philosophy}</a>
            <a href="#como" className="font-medium text-tinta-3 hover:text-tinta">{l.nav.how}</a>
            <a href="#conecta" className="font-medium text-tinta-3 hover:text-tinta">{l.nav.integrations}</a>
            <a href="#roles" className="font-medium text-tinta-3 hover:text-tinta">{l.nav.demo}</a>
          </div>
          <PrefsSwitcher theme={theme} />
          <ButtonLink href="/login" variant="secondary" size="sm">{l.nav.staffLogin}</ButtonLink>
        </nav>
      </Container>

      <Container className="grid items-center gap-14 pb-[88px] pt-10 md:pt-16 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-[26px]">
          <span className="etiqueta text-[14px] text-marca-texto">{l.hero.eyebrow}</span>
          <h1 className="text-[52px] font-bold leading-[0.98] tracking-[-0.035em] md:text-[80px]">
            {l.hero.title1}
            <br />
            {l.hero.title2}
          </h1>
          <p className="max-w-[620px] text-[20px] leading-normal text-tinta-2">{l.hero.lead}</p>
          <div className="flex flex-wrap gap-3.5">
            <ButtonLink href="/login?next=/app/test-chat" className="h-14 px-[30px] text-[18px]">{l.hero.ctaTest}</ButtonLink>
            <ButtonLink href="/login?as=agent" variant="secondary" className="h-14 px-[30px] text-[18px]">{l.hero.ctaAgent}</ButtonLink>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 rounded-telefono border-2 border-tinta bg-superficie p-[22px] text-[16px] leading-[1.42] shadow-[8px_8px_0_var(--sombra)]" aria-label={l.hero.sample} lang="pt">
          <p className="max-w-[82%] self-end rounded-[18px_18px_4px_18px] bg-tinta px-3.5 py-2.5 text-fondo">Não reconheço uma compra de ontem</p>
          <p className="max-w-[82%] self-start rounded-[18px_18px_18px_4px] bg-fondo px-3.5 py-2.5">Vejo uma compra de ARS 185.000 ontem às 23:41, numa loja online. É essa?</p>
          <p className="max-w-[82%] self-end rounded-[18px_18px_4px_18px] bg-tinta px-3.5 py-2.5 text-fondo">Isso. Pode abrir a contestação</p>
          <p className="max-w-[82%] self-start rounded-[18px_18px_18px_4px] bg-fondo px-3.5 py-2.5">Pronto, DSP-0192. Vou passar você para a Andrea, da segurança. Ela já sabe de tudo.</p>
          <p className="self-center pt-1 text-[13px] text-muted">Andrea entrou na conversa</p>
        </div>
      </Container>

      <section id="filosofia" className="scroll-mt-4 bg-panel py-[88px] text-panel-texto">
        <Container className="flex flex-col gap-10">
          <span className="etiqueta text-[14px] text-panel-acento">{l.philosophy.eyebrow}</span>
          <h2 className="max-w-[900px] text-[40px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[58px]">
            {l.philosophy.title1}
            <br />
            {l.philosophy.title2}
          </h2>
          <div className="grid gap-7 md:grid-cols-3">
            {principles.map(([title, text]) => (
              <div key={title} className="flex flex-col gap-2.5 border-t-2 border-panel-acento pt-5">
                <h3 className="text-[23px] font-bold">{title}</h3>
                <p className="text-[17px] leading-[1.55] opacity-90">{text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="como" className="scroll-mt-4 py-[88px]">
        <Container className="flex flex-col gap-9">
          <span className="etiqueta text-[14px] text-marca-texto">{l.how.eyebrow}</span>
          <h2 className="text-[36px] font-bold tracking-[-0.02em] md:text-[46px]">{l.how.title}</h2>
          <div className="grid gap-4 md:grid-cols-5">
            {steps.map(([title, text], i) => (
              <Card key={title} emphasis={i === 4} className="flex flex-col gap-3 p-[22px]">
                <span className={`tabular font-bold ${i === 4 ? "text-atencion" : "text-marca-texto"}`}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-[20px] font-bold">{title}</h3>
                <p className="text-[15px] leading-normal text-tinta-3">{text}</p>
              </Card>
            ))}
          </div>
          <div className="flex flex-col gap-6 rounded-tarjeta border-2 border-tinta bg-superficie p-8">
            <span className="etiqueta text-[15px]">{l.how.statesTitle}</span>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STATES.map((s) => (
                <div key={s} className="flex items-center gap-4">
                  <StateBubble state={s} size={60} />
                  <span className="flex flex-col gap-0.5">
                    <span className={`text-[19px] font-bold ${s === "needs_human" ? "text-atencion" : ""}`}>{t.states[s]}</span>
                    <span className="text-[14px] text-tinta-3">{t.stateHints[s]}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section id="conecta" className="scroll-mt-4 pb-[88px]">
        <Container className="flex flex-col gap-8">
          <span className="etiqueta text-[14px] text-marca-texto">{l.connect.eyebrow}</span>
          <h2 className="max-w-[1000px] text-[36px] font-bold tracking-[-0.02em] md:text-[46px]">{l.connect.title}</h2>
          <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <span className="etiqueta">{l.connect.channels}</span>
              <Pill>{l.connect.c1}</Pill>
              <Pill>{l.connect.c2}</Pill>
              <Pill>{l.connect.c3}</Pill>
            </div>
            <div className="flex flex-col items-center gap-3.5 rounded-telefono border-2 border-tinta bg-marca p-7 text-center shadow-[8px_8px_0_var(--sombra)]">
              <StateBubble state="resolved" size={64} onBrand />
              <span className="text-[26px] font-bold">Chatquiry</span>
              <span className="text-[15px] leading-normal">{l.connect.hub}</span>
            </div>
            <div className="flex flex-col gap-3">
              <span className="etiqueta">{l.connect.systems}</span>
              <Pill>{l.connect.s1}</Pill>
              <Pill>{l.connect.s2}</Pill>
              <Pill>{l.connect.s3}</Pill>
            </div>
          </div>
          <pre className="tabular overflow-x-auto rounded-tarjeta bg-panel px-[26px] py-[22px] text-[15px] leading-[1.7] text-panel-texto">
            <span className="text-panel-acento">POST</span>
            {` /v1/conversations/{id}/messages
Authorization: Bearer cq_live_••••••••
X-Customer-Assertion: <${l.connect.assertion}>
`}
            <span className="opacity-70">{`{ "channel": "whatsapp", "text": "${l.connect.sampleText}" }`}</span>
          </pre>
        </Container>
      </section>

      <section id="roles" className="scroll-mt-4 pb-[88px]">
        <Container className="flex flex-col gap-7">
          <span className="etiqueta text-[14px] text-marca-texto">{l.demo.eyebrow}</span>
          <div className="grid gap-5 md:grid-cols-3">
            {roles.map((r) => (
              <Card key={r.title} emphasis={r.emphasis} className="flex flex-col gap-3.5 p-7">
                <h3 className="text-[25px] font-bold">{r.title}</h3>
                <p className="text-[16px] leading-[1.55] text-tinta-3">{r.text}</p>
                <span className="grow" />
                <Link href={r.href} className="font-bold underline underline-offset-4">{r.cta}</Link>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <footer className="border-t-[1.5px] border-linea py-7 text-[14px] text-muted">
        <Container className="flex flex-col justify-between gap-2 md:flex-row">
          <span>{l.footerLeft}</span>
          <span>{l.footerRight}</span>
        </Container>
      </footer>
    </div>
  );
}
