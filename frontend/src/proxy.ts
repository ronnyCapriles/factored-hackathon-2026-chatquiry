import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, needsRenewal, renewSession } from "@/lib/session-refresh";
import { ADMIN_PREFIXES, STAFF_COOKIE, verifyToken } from "@/lib/session-token";

/** Rejects before rendering so a wrong role gets a real 403. Pages still call requireStaff(). */
export async function proxy(request: NextRequest) {
  const session = verifyToken(request.cookies.get(STAFF_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    if (request.cookies.has(STAFF_COOKIE)) login.searchParams.set("expired", "1");
    return NextResponse.redirect(login);
  }
  if (session.user.role !== "admin" && ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.rewrite(new URL("/denied", request.url), { status: 403 });
  }
  const response = NextResponse.next();
  if (needsRenewal(session)) {
    const renewed = await renewSession(session);
    if (renewed) response.cookies.set(STAFF_COOKIE, renewed.value, cookieOptions(renewed.exp));
  }
  return response;
}

export const config = {
  matcher: ["/app/:path*"],
};
