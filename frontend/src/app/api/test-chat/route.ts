import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { getStaffSession } from "@/lib/session";

/** Staff only; the customer id must belong to a demo customer. */
export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "session_expired" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { customerId?: string; conversationId?: string | null; text?: string } | null;
  const text = body?.text?.trim();
  if (!text || text.length > 2000) return NextResponse.json({ error: "invalid_message" }, { status: 400 });

  const allowed = await api().listTestCustomers();
  if (!allowed.some((c) => c.customerId === body?.customerId)) {
    return NextResponse.json({ error: "unknown_test_customer" }, { status: 403 });
  }

  const result = await api().testChatTurn(body!.customerId!, body?.conversationId ?? null, text);
  return NextResponse.json(result);
}
