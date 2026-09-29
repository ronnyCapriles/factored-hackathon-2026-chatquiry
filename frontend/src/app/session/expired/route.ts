import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE } from "@/lib/session";

/** Pages cannot delete cookies while rendering, so an API 401 lands here first. */
export async function GET() {
  (await cookies()).delete(STAFF_COOKIE);
  redirect("/login?expired=1");
}
