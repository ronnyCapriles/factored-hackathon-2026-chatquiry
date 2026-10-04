import { requireStaff } from "@/lib/session";

export default async function ConfigLayout({ children }: LayoutProps<"/app/config">) {
  await requireStaff("admin");
  return <div className="flex flex-col gap-7 px-4 py-5 lg:px-8 lg:py-7">{children}</div>;
}
