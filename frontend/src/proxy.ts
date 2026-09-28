import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_PREFIXES, STAFF_COOKIE, verifyToken } from "@/lib/session-token";

/** Rejects before rendering so a wrong role gets a real 403. Pages still call requireStaff(). */
export function proxy(request: NextRequest) {
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
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
