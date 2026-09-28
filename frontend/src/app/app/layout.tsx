import { StaffShell } from "@/components/staff/staff-shell";
import { requireStaff } from "@/lib/session";

export default async function StaffLayout({ children }: LayoutProps<"/app">) {
  const user = await requireStaff();
  return <StaffShell user={user}>{children}</StaffShell>;
}
