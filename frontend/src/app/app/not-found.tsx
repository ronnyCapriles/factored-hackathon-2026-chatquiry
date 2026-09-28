import { StatusPage } from "@/components/feedback/status-page";
import { ButtonLink } from "@/components/ui";
import { getMessages } from "@/i18n/server";

export default async function WorkspaceNotFound() {
  const t = (await getMessages()).status;
  return (
    <StatusPage
      code="404"
      state="waiting_customer"
      title={t.recordNotFoundTitle}
      message={t.recordNotFoundMessage}
      actions={
        <>
          <ButtonLink href="/app/conversations">{t.toConversations}</ButtonLink>
          <ButtonLink href="/app/customers" variant="secondary">{t.findCustomer}</ButtonLink>
        </>
      }
    />
  );
}
