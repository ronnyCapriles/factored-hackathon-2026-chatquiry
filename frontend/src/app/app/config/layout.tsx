import { requireStaff } from "@/lib/session";

export default async function ConfigLayout({ children }: LayoutProps<"/app/config">) {
  await requireStaff("admin");
  return <div className="flex flex-col gap-7 px-8 py-7">{children}</div>;
}
