import type { ConversationState } from "@/lib/api/types";

// One speech bubble; what it holds tells the state. The resolved bubble is the logo.
const BUBBLE =
  "M16 8h32a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10H27l-11 10v-10a10 10 0 0 1-10-10V18A10 10 0 0 1 16 8z";

function Dots({ fill }: { fill: string }) {
  return (
    <>
      <circle cx="22" cy="27" r="3.8" fill={fill} />
      <circle cx="32" cy="27" r="3.8" fill={fill} />
      <circle cx="42" cy="27" r="3.8" fill={fill} />
    </>
  );
}

/** `inverse` draws the needs-human bubble for use on a coral fill. */
export function StateBubble({ state, size = 24, inverse = false }: { state: ConversationState; size?: number; inverse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      {state === "ai_attending" && (
        <>
          <path d={BUBBLE} fill="var(--marca)" />
          <Dots fill="var(--sobre-marca)" />
        </>
      )}
      {state === "waiting_customer" && (
        <>
          <path d={BUBBLE} fill="var(--superficie)" stroke="var(--punto-2)" strokeWidth="3.5" />
          <Dots fill="var(--punto-2)" />
        </>
      )}
      {state === "with_human" && (
        <>
          <path d={BUBBLE} fill="var(--tinta)" />
          <circle cx="32" cy="20" r="5.5" fill="var(--fondo)" />
          <path d="M21 37a11 9 0 0 1 22 0z" fill="var(--fondo)" />
        </>
      )}
      {state === "needs_human" && (
        <>
          <path d={BUBBLE} fill={inverse ? "var(--sobre-atencion)" : "var(--atencion)"} />
          <path d="M25.5 26v-4.5a6.5 6.5 0 0 1 13 0V26" fill="none" stroke={inverse ? "var(--atencion)" : "var(--sobre-atencion)"} strokeWidth="4" strokeLinecap="round" />
          <rect x="21.5" y="25" width="21" height="15" rx="3.5" fill={inverse ? "var(--atencion)" : "var(--sobre-atencion)"} />
          <circle cx="32" cy="32.5" r="2.4" fill={inverse ? "var(--sobre-atencion)" : "var(--atencion)"} />
        </>
      )}
      {state === "resolved" && (
        <>
          <path d={BUBBLE} fill="var(--logo-burbuja)" />
          <path d="M21 27l7 7 14-14" fill="none" stroke="var(--logo-check)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/** Yellow bubble with a check: marks a verified fact in the copilot. */
export function VerifiedMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <path d={BUBBLE} fill="var(--marca)" />
      <path d="M21 27l7 7 14-14" fill="none" stroke="var(--sobre-marca)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-bold tracking-tight ${className}`}>
      <StateBubble state="resolved" size={size} />
      <span style={{ fontSize: size * 0.72 }}>Chatquiry</span>
    </span>
  );
}
