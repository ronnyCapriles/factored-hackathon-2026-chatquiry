import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/live";
import { getStaffSession } from "@/lib/session";

/** Open screens poll this; it does not renew the session, since polling is not activity. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/conversations/[id]/updates">) {
  if (!(await getStaffSession())) return NextResponse.json({ error: "session_expired" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await api().conversationUpdates(id, request.nextUrl.searchParams.get("after")));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
