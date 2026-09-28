import { StatusPage } from "@/components/feedback/status-page";
import { ButtonLink } from "@/components/ui";
import { getMessages } from "@/i18n/server";

export default async function Forbidden() {
  const t = (await getMessages()).status;
  return (
    <div className="flex min-h-dvh flex-col">
      <StatusPage
        code="403"
        state="needs_human"
        title={t.forbiddenTitle}
        message={t.forbiddenMessage}
        actions={
          <>
            <ButtonLink href="/app">{t.backToWorkspace}</ButtonLink>
            <ButtonLink href="/login?as=admin" variant="secondary">{t.otherAccount}</ButtonLink>
          </>
        }
      />
    </div>
  );
}
