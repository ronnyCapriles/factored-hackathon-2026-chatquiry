import { StatusPage } from "@/components/feedback/status-page";
import { ButtonLink } from "@/components/ui";
import { getMessages } from "@/i18n/server";

export default async function NotFound() {
  const t = (await getMessages()).status;
  return (
    <div className="flex min-h-dvh flex-col">
      <StatusPage
        code="404"
        state="waiting_customer"
        title={t.notFoundTitle}
        message={t.notFoundMessage}
        actions={
          <>
            <ButtonLink href="/">{t.home}</ButtonLink>
            <ButtonLink href="/app" variant="secondary">{t.workspace}</ButtonLink>
          </>
        }
      />
    </div>
  );
}
