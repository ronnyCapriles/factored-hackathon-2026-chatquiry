import { EntityFormButton, PendingAction } from "@/components/crud";
import { guardrailFields } from "@/components/crud/forms";
import { Chip, ConfigHeader, SectionTitle, StrengthMeter, ThresholdBar } from "@/components/config/parts";
import { Card, Label, Table, Td, Th } from "@/components/ui";
import { getMessages } from "@/i18n/server";
import { api } from "@/lib/api";

export async function generateMetadata() {
  return { title: (await getMessages()).guardrails.title };
}

export default async function GuardrailsPage() {
  const [cfg, t] = await Promise.all([api().getConfig(), getMessages()]);
  const m = t.guardrails;
  const s = t.config.strength;
  const g = cfg.guardrails[0];

  return (
    <>
      <ConfigHeader
        title={m.title}
        lead={m.lead}
        aside={
          <>
            <Chip tone="ink" mono>{`${g.name} ${g.version}`}</Chip>
            <PendingAction action={m.testAction}>{m.test}</PendingAction>
            <EntityFormButton
              mode="edit"
              title={m.editTitle}
              action={m.saveAction}
              fields={guardrailFields(t)}
              description={m.editNote}
              initial={{ promptAttack: g.promptAttack, grounding: g.groundingThreshold, blockedEs: g.blockedMessage.es, blockedPt: g.blockedMessage.pt }}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card emphasis className="flex flex-col gap-2 p-6">
          <Label>{m.promptAttack}</Label>
          <StrengthMeter value={g.promptAttack} label={m.promptAttack} text={s[g.promptAttack]} />
          <p className="text-[14px] text-tinta-3">{m.promptAttackHint}</p>
        </Card>
        <Card className="flex flex-col gap-2 p-6">
          <Label>{m.grounding}</Label>
          <ThresholdBar value={g.groundingThreshold} />
          <p className="text-[14px] text-tinta-3">{m.groundingHint}</p>
        </Card>
        <Card className="flex flex-col gap-2 p-6">
          <Label>{m.engine}</Label>
          <span className="text-[17px] font-bold">{g.tier}</span>
          <p className="text-[14px] text-tinta-3">{m.engineHint}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-2 px-6 py-5">
          <SectionTitle>{m.content}</SectionTitle>
          <Table>
            <thead>
              <tr>
                <Th>{m.categoryCol}</Th>
                <Th>{m.customerMsg}</Th>
                <Th>{m.aiMsg}</Th>
              </tr>
            </thead>
            <tbody>
              {g.contentFilters.map((f) => (
                <tr key={f.category}>
                  <Td className="font-semibold">{f.category}</Td>
                  <Td><StrengthMeter value={f.input} label={`${f.category} · ${m.customerMsg}`} text={s[f.input]} /></Td>
                  <Td><StrengthMeter value={f.output} label={`${f.category} · ${m.aiMsg}`} text={s[f.output]} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card className="flex flex-col gap-2 px-6 py-5">
          <SectionTitle>{m.sensitive}</SectionTitle>
          <Table>
            <thead>
              <tr>
                <Th>{m.dataCol}</Th>
                <Th align="right">{m.actionCol}</Th>
              </tr>
            </thead>
            <tbody>
              {g.pii.map((p) => (
                <tr key={p.entity}>
                  <Td className="font-semibold">{p.entity}</Td>
                  <Td align="right">{p.action === "block" ? <Chip tone="alert">{m.block}</Chip> : <Chip>{m.mask}</Chip>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-[13px] text-muted">{m.piiNote}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-3 p-6">
          <SectionTitle>{m.denied}</SectionTitle>
          {g.deniedTopics.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-4 border-b border-linea-2 pb-3 last:border-0 last:pb-0">
              <span className="font-semibold">{d.name}</span>
              <span className="text-right text-[14px] italic text-tinta-3">“{d.example}”</span>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Label>{m.wordFilters}</Label>
            {g.wordFilters.map((w) => (
              <Chip key={w}>{w}</Chip>
            ))}
          </div>
        </Card>
        <Card className="flex flex-col gap-3 p-6">
          <SectionTitle>{m.blockedPreview}</SectionTitle>
          {(["es", "pt"] as const).map((l) => (
            <div key={l} className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-muted">{t.languages[l]}</span>
              <p lang={l} className="self-start rounded-[18px_18px_18px_4px] bg-fondo px-4 py-3 text-[15px]">{g.blockedMessage[l]}</p>
            </div>
          ))}
          <p className="text-[13px] text-muted">{m.blockedNote}</p>
        </Card>
      </div>
    </>
  );
}
