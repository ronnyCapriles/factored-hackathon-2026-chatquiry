import { redirect } from "next/navigation";
import { homeFor, requireStaff } from "@/lib/session";

export default async function AppHome() {
  const user = await requireStaff();
  redirect(homeFor(user.role));
}
