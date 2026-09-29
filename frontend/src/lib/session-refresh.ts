import { signToken, type StaffPayload } from "./session-token";

// No Next request APIs here so the proxy can import it too.

/** Renew once less than this is left, so any activity keeps the session alive. */
const RENEW_WHEN_LEFT_MS = 10 * 60_000;
const MOCK_TTL_MS = 15 * 60_000;

export function cookieOptions(exp: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires: new Date(exp) };
}

export function needsRenewal(session: StaffPayload): boolean {
  return session.exp - Date.now() < RENEW_WHEN_LEFT_MS;
}

/** A fresh signed cookie value, or null when the backend refuses (for example past the absolute session cap). */
export async function renewSession(session: StaffPayload): Promise<{ value: string; exp: number } | null> {
  if ((process.env.CHATQUIRY_API_MODE || "mock") !== "live") {
    const exp = Date.now() + MOCK_TTL_MS;
    return { value: signToken({ ...session, exp }), exp };
  }
  const base = (process.env.CHATQUIRY_API_URL || "http://127.0.0.1:8010").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/auth/refresh`, { method: "POST", headers: { Authorization: `Bearer ${session.token}` }, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { token: string; expiresAt: string };
    const exp = Date.parse(body.expiresAt);
    return { value: signToken({ user: session.user, token: body.token, exp }), exp };
  } catch {
    return null;
  }
}
