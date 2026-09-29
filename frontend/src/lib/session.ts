import "server-only";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import type { Role, StaffUser } from "./api/types";
import { cookieOptions } from "./session-refresh";
import { STAFF_COOKIE, signToken, verifyToken } from "./session-token";

export { STAFF_COOKIE };

/**
 * Signed httpOnly cookie. The payload carries the backend token for server-side calls,
 * and it expires with that token so a page never holds a cookie the API already rejects.
 * The proxy and the chat route renew both while the person is active.
 */
export async function createStaffSession(user: StaffUser, token: string, expiresAt: string) {
  const exp = Date.parse(expiresAt);
  (await cookies()).set(STAFF_COOKIE, signToken({ user, token, exp }), cookieOptions(exp));
}

export async function destroyStaffSession() {
  (await cookies()).delete(STAFF_COOKIE);
}

export const getStaffSession = cache(async () => verifyToken((await cookies()).get(STAFF_COOKIE)?.value));

/** Role check for pages; the proxy only runs a quick first pass. */
export async function requireStaff(...roles: Role[]): Promise<StaffUser> {
  const session = await getStaffSession();
  if (!session) redirect("/login?expired=1");
  if (roles.length && !roles.includes(session.user.role)) forbidden();
  return session.user;
}

export function homeFor(role: Role) {
  return role === "admin" ? "/app/operations" : "/app/conversations";
}

/** Accepts only in-app paths, which prevents open redirects. */
export function safeNext(next: unknown): string | null {
  return typeof next === "string" && /^\/app(\/[\w\-/]*)?(\?[\w=&%-]*)?$/.test(next) ? next : null;
}
