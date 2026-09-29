import { randomUUID } from "node:crypto";
import type { ChatTurnResponse, ConversationState, Language, Message, Signal, TraceStep, TurnInspection } from "../types";
import { config, testCustomers, type TestCustomer } from "./fixtures";

// Scripted stand-in for the orchestrator: same flow as the backend, keyword rules instead of models.

const AI = config.profiles[0].name;

type Stage = "open" | "pick_transfer" | "confirm_charge" | "confirm_dispute" | "handed_off" | "closed";

interface State {
  customer: TestCustomer;
  lang: Language;
  stage: Stage;
  disputeSeq: number;
  department: string;
}

const store: Map<string, State> = ((globalThis as { __cqChat?: Map<string, State> }).__cqChat ??= new Map());

const YES = /^(s[ií]|sim|claro|dale|ok|isso|por favor|confirmo|correcto|certo|esa|essa|exato|exacto)\b/i;
const NO = /^(no|não|nao|nop|nunca)\b/i;
const INJECTION = /(ignora|ignore|instrucciones|instruções|system prompt|prompt del sistema|otra cuenta|outra conta|cuenta \d{3,}|conta \d{3,})/i;
const OUT_OF_SCOPE = /(cupo|cr[eé]dito|pr[eé]stamo|empr[eé]stimo|limite|l[ií]mite|inversi[oó]n|investimento|hipoteca)/i;
const TRANSFER = /(transferencia|transferência|transfer[íi]|no (le )?llega|não chegou|nao chegou|envi[ée])/i;
const CHARGE = /(no reconozco|não reconheço|nao reconheco|cobro raro|compra estranha|fraude|no fui yo|não fui eu|cargo raro)/i;
const THANKS = /(gracias|obrigad[oa]|valeu|perfecto|listo)/i;
const PT_HINT = /(não|você|obrigad|reconheço|cartão|olá|\boi\b|\bsim\b|ontem|está|conta\b|isso|minha|meu\b|ção)/gi;
const ES_HINT = /(ñ|\bno\b|usted|gracias|reconozco|tarjeta|hola|\bsí\b|\bsi\b|ayer|cuenta|pueden|muéstrame|qué|mi\b|ción)/gi;

const DEPT = { intake: "Ingreso", trx: "Consultas de transacciones", dsp: "Disputas y fraude", security: "Revisión de seguridad" };

/** Replies follow the language of the latest message; ties keep the current one. */
function detectLanguage(text: string, current: Language): Language {
  const pt = text.match(PT_HINT)?.length ?? 0;
  const es = text.match(ES_HINT)?.length ?? 0;
  if (pt > es) return "pt";
  if (es > pt) return "es";
  return current;
}

const now = () => new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
const msg = (author: Message["author"], authorName: string, text: string): Message => ({ id: randomUUID(), author, authorName, text, at: now() });
const ai = (text: string) => msg("ai", AI, text);
const sys = (text: string) => msg("system", "Sistema", text);
const human = (text: string) => msg("human", "Andrea", text);

function t(lang: Language, es: string, pt: string) {
  return lang === "pt" ? pt : es;
}

/** Collects trace steps with plausible timings. */
class Recorder {
  steps: TraceStep[] = [];
  private clock = 0;
  add(step: string, detail: string, status: TraceStep["status"], ms: number) {
    this.steps.push({ t: (this.clock / 1000).toFixed(3), step, detail, status, ms });
    this.clock += ms;
  }
  get total() {
    return this.clock;
  }
}

export function greeting(customerId: string): Message[] {
  const c = testCustomers.find((x) => x.customerId === customerId);
  if (!c) return [];
  return [ai(t(c.language, `Hola, ${c.firstName}. Soy ${AI}, de Banco LATAM. ¿En qué te ayudo hoy?`, `Olá, ${c.firstName}! Aqui é a ${AI}, do Banco LATAM. Como posso ajudar?`))];
}

export function chatTurn(customerId: string, conversationId: string | null, text: string): ChatTurnResponse {
  const customer = testCustomers.find((x) => x.customerId === customerId);
  if (!customer) throw new Error("unknown test customer");

  const id = conversationId ?? `CNV-T${Date.now().toString(36).toUpperCase()}`;
  let s = store.get(id);
  if (!s) {
    s = { customer, lang: customer.language, stage: "open", disputeSeq: 193, department: DEPT.trx };
    store.set(id, s);
  }
  const input = text.trim();
  s.lang = detectLanguage(input, s.lang);
  const L = s.lang;
  const c = s.customer;
  const replies: Message[] = [];
  const rec = new Recorder();
  let handedOff = false;
  let state: ConversationState = "waiting_customer";
  let rule: TurnInspection["rule"] = null;

  const injection = INJECTION.test(input);
  const outOfScope = !injection && OUT_OF_SCOPE.test(input);
  const charge = CHARGE.test(input);
  const transfer = TRANSFER.test(input);
  const intent: Signal = injection
    ? { name: "intent", value: "otro", confidence: 0.64 }
    : outOfScope
      ? { name: "intent", value: "credit", confidence: 0.88 }
      : charge || s.stage === "confirm_charge" || s.stage === "confirm_dispute"
        ? { name: "intent", value: "txn_dispute", confidence: 0.91 }
        : transfer || s.stage === "pick_transfer"
          ? { name: "intent", value: "txn_status", confidence: 0.93 }
          : { name: "intent", value: "otro", confidence: 0.55 };
  const signals: Signal[] = [
    { name: "language", value: L },
    intent,
    { name: "injection_risk", value: injection ? "0.93" : "0.02" },
    { name: "needs_human", value: charge || s.stage === "confirm_dispute" ? "0.78" : "0.12" },
  ];

  rec.add("intake.guardrail", injection ? "Bedrock Guardrails · posible ataque de prompt" : "Bedrock Guardrails · sin hallazgos", injection ? "blocked" : "allowed", 130 + (input.length % 40));
  rec.add("intake.laya", signals.map((x) => `${x.name}=${x.value}${x.confidence ? ` (${x.confidence})` : ""}`).join(" · "), "classified", 45);

  const llm = (tokensIn: number, tokensOut: number) => rec.add("llm.mistral-large-3", `${tokensIn.toLocaleString("es")} tokens entrada · ${tokensOut} salida`, "ok", 900 + tokensOut * 4);

  if (s.stage === "handed_off") {
    rec.add("router", "Conversación con persona · la IA no responde", "routed", 2);
    replies.push(human(t(L, "Aquí sigo contigo. Dame un momento mientras reviso con el equipo.", "Estou aqui com você. Só um momento enquanto confirmo com a equipe.")));
    return finish(true, "with_human");
  }

  if (injection) {
    rule = { id: "R-02", name: "Posible manipulación" };
    s.department = DEPT.security;
    rec.add("router", "R-02 · injection_risk ≥ 0.80 → respuesta segura + revisión", "routed", 3);
    rec.add("tool.find_transactions", "Pedido sobre otra cuenta · denegado en la capa de herramientas (403)", "blocked", 6);
    replies.push(ai(t(L, "Solo puedo ayudarte con las cuentas a tu nombre. ¿Hay algo de tus movimientos que quieras revisar?", "Só posso ajudar com as contas no seu nome. Tem algo nas suas movimentações que você quer revisar?")));
    return finish(false, "waiting_customer");
  }

  if (outOfScope) {
    rule = { id: "R-03", name: "Fuera de alcance" };
    rec.add("router", "R-03 · intent=credit → abstención con canal correcto", "routed", 3);
    llm(1480, 64);
    replies.push(
      ai(
        t(
          L,
          "Eso lo decide el área de crédito y no lo puedo cambiar desde aquí. Lo puedes pedir en la app, en Tarjetas › Aumentar cupo, o si prefieres te comunico con alguien de crédito.",
          "Isso é decidido pela área de crédito e não consigo alterar por aqui. Você pode pedir no app, em Cartões › Aumentar limite, ou posso te passar para alguém de crédito.",
        ),
      ),
    );
    return finish(false, "waiting_customer");
  }

  if (s.stage === "pick_transfer") {
    rule = { id: "R-05", name: "Consulta de transacción" };
    const first = c.transfers[0];
    const picked = YES.test(input) || input.toLowerCase().includes(first.to.split(" ")[0].toLowerCase()) || /\d/.test(input);
    if (picked) {
      rec.add("tool.get_transaction", `${first.id} · acotado al cliente de la sesión · estado Pending`, "ok", 22);
      rec.add("policy.evaluate", "POL-TRX-PEND-24H → dentro del plazo: explicar hora límite", "decision", 2);
      llm(2010, 118);
      rec.add("verify.grounding", "Monto, destinatario y hora aparecen en el resultado de la herramienta", "verified", 4);
      replies.push(
        ai(
          t(
            L,
            `Ya la revisé. Salió de tu cuenta y está en proceso; el banco de destino aún no la acredita. Este tipo de envío tarda hasta 24 horas, así que debería verse antes de las ${first.time} de hoy.`,
            `Já conferi. Saiu da sua conta e está em processamento; o banco de destino ainda não creditou. Esse tipo de envio leva até 24 horas, então deve aparecer hoje antes das ${first.time}.`,
          ),
        ),
        ai(t(L, "Si a esa hora no ha llegado, escríbeme por aquí y abro el reclamo enseguida, sin que tengas que explicarme todo otra vez.", "Se até lá não tiver chegado, me escreve por aqui e eu abro a reclamação na hora, sem você precisar explicar tudo de novo.")),
      );
      s.stage = "closed";
      return finish(false, "resolved");
    }
    llm(1650, 40);
    replies.push(ai(t(L, `¿Me confirmas si es la de ${first.amount} a ${first.to} o la otra?`, `Me confirma se é a de ${first.amount} para ${first.to} ou a outra?`)));
    return finish(false, "waiting_customer");
  }

  if (s.stage === "confirm_charge") {
    rule = { id: "R-07", name: "Disputa o fraude" };
    if (NO.test(input) && !/nunca/i.test(input)) {
      llm(1700, 36);
      replies.push(ai(t(L, "Entendido. ¿Me dices el monto aproximado o el comercio para ubicar el cobro correcto?", "Entendi. Me diz o valor aproximado ou a loja para eu achar a compra certa?")));
      s.stage = "open";
      return finish(false, "waiting_customer");
    }
    rec.add("policy.evaluate", "POL-DSP-FRAUD-01 → disputa permitida; fraud_score 82 → luego pasar a persona", "decision", 2);
    rec.add("tool.propose_dispute", "Acción pendiente guardada en servidor · se pregunta al cliente", "pending", 9);
    llm(2140, 52);
    replies.push(ai(t(L, "Entiendo. Puedo abrir ahora una disputa por ese monto a tu nombre. ¿Quieres que la abra?", "Certo. Posso abrir agora uma contestação desse valor no seu nome. Quer que eu abra?")));
    s.stage = "confirm_dispute";
    return finish(false, "waiting_customer");
  }

  if (s.stage === "confirm_dispute") {
    rule = { id: "R-07", name: "Disputa o fraude" };
    if (YES.test(input)) {
      const dsp = `DSP-0${s.disputeSeq++}`;
      rec.add("confirm.detect", `“${input}” → afirmativo p=0.98 (clasificador, no el LLM)`, "verified", 14);
      rec.add("tool.confirm_dispute", `${dsp} creada · releída en BD: coincide`, "verified", 18);
      rec.add("verify.grounding", "ID de disputa y monto coinciden con la BD", "verified", 4);
      rec.add("handoff.create", `${dsp} → Andrea Ríos (fraude) · 4 hechos, 1 acción, 2 pendientes`, "escalated", 12);
      replies.push(
        ai(t(L, `Listo, la disputa quedó registrada con el número ${dsp}.`, `Pronto, a contestação ficou registrada com o número ${dsp}.`)),
        ai(
          t(
            L,
            "Como puede ser fraude, te paso con Andrea, del equipo de seguridad. Ya tiene todos los detalles, no vas a tener que repetir nada.",
            "Como pode ser fraude, vou passar você para a Andrea, da equipe de segurança. Ela já sabe de tudo, você não vai precisar repetir nada.",
          ),
        ),
        sys(t(L, "Andrea se unió a la conversación", "Andrea entrou na conversa")),
        human(t(L, `Hola, ${c.firstName}, soy Andrea. Ya leí todo lo que le contaste a ${AI}. ¿Tu tarjeta sigue contigo?`, `Oi, ${c.firstName}, aqui é a Andrea. Já li tudo o que você contou. Seu cartão ainda está com você?`)),
      );
      s.stage = "handed_off";
      return finish(true, "with_human");
    }
    rec.add("confirm.detect", `“${input}” → no es un sí · acción descartada`, "ok", 12);
    replies.push(ai(t(L, "De acuerdo, no abro nada por ahora. Si cambias de opinión, solo dímelo.", "Tudo bem, não vou abrir nada por enquanto. Se mudar de ideia, é só me dizer.")));
    s.stage = "closed";
    return finish(false, "waiting_customer");
  }

  if (charge) {
    rule = { id: "R-07", name: "Disputa o fraude" };
    s.department = DEPT.dsp;
    const x = c.suspicious;
    rec.add("router", `R-07 · intent=txn_dispute → Disputas y fraude · ${AI}`, "routed", 3);
    rec.add("tool.find_transactions", `Compras recientes del cliente de la sesión → ${x.id}`, "ok", 24);
    llm(1980, 71);
    rec.add("verify.grounding", "Monto, comercio y ciudad aparecen en el resultado", "verified", 4);
    replies.push(
      ai(
        t(
          L,
          `Entiendo, vamos a resolverlo. Veo una compra de ${x.amount} en ${x.merchant} ${x.when}, hecha en ${x.city}. ¿Es esa?`,
          `Entendo, vamos resolver isso. Vejo uma compra de ${x.amount} em ${x.merchant} ${x.when}, feita em ${x.city}. É essa?`,
        ),
      ),
    );
    s.stage = "confirm_charge";
    return finish(false, "waiting_customer");
  }

  if (transfer) {
    rule = { id: "R-05", name: "Consulta de transacción" };
    s.department = DEPT.trx;
    const [a, b] = c.transfers;
    rec.add("router", `R-05 · intent=txn_status → Consultas de transacciones · ${AI}`, "routed", 3);
    rec.add("tool.find_transactions", `Transferencias recientes → 2 coincidencias (${a.id}, ${b.id}) · ambigua: pedir aclaración`, "ok", 26);
    llm(1890, 96);
    replies.push(
      ai(t(L, "Entiendo la preocupación, déjame revisar tus movimientos recientes.", "Entendo a preocupação, deixa eu ver suas movimentações recentes.")),
      ai(
        t(
          L,
          `Veo dos: una de ${a.amount} a ${a.to} a las ${a.time} y otra de ${b.amount} a ${b.to} a las ${b.time}. ¿Cuál es?`,
          `Vejo duas: uma de ${a.amount} para ${a.to} às ${a.time} e outra de ${b.amount} para ${b.to} às ${b.time}. Qual é?`,
        ),
      ),
    );
    s.stage = "pick_transfer";
    return finish(false, "waiting_customer");
  }

  if (THANKS.test(input)) {
    llm(1300, 22);
    replies.push(ai(t(L, `Con gusto, ${c.firstName}. ¡Que tengas buen día!`, `Por nada, ${c.firstName}. Tenha um ótimo dia!`)));
    s.stage = "closed";
    return finish(false, "resolved");
  }

  rec.add("router", "Ninguna regla coincide con confianza suficiente → pedir aclaración", "routed", 3);
  llm(1400, 44);
  replies.push(
    ai(
      t(
        L,
        "Cuéntame un poco más, así te ayudo mejor. Puedo revisar transferencias que no llegan o cobros que no reconoces.",
        "Me conta um pouco mais para eu te ajudar melhor. Posso ver transferências que não chegaram ou compras que você não reconhece.",
      ),
    ),
  );
  return finish(false, "waiting_customer");

  function finish(escalated: boolean, st: ConversationState): ChatTurnResponse {
    handedOff = escalated;
    state = st;
    return {
      conversationId: id,
      replies,
      handedOff,
      inspection: {
        customerText: input,
        state,
        department: s!.department,
        profile: handedOff || s!.stage === "handed_off" ? "Andrea Ríos" : AI,
        signals,
        rule,
        steps: rec.steps,
        totalMs: rec.total,
      },
    };
  }
}
