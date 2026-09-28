"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/feedback/status-page";
import { Button, ButtonLink } from "@/components/ui";
import { useMessages } from "@/i18n/client";
import { fmt } from "@/i18n/config";

export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useMessages().status;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="500"
      state="needs_human"
      title={t.errorTitle}
      message={t.errorMessage}
      actions={
        <>
          <Button onClick={() => retry()}>{t.retry}</Button>
          <ButtonLink href="/app" variant="secondary">{t.workspace}</ButtonLink>
        </>
      }
      detail={error.digest && <p className="tabular text-[13px] text-muted">{fmt(t.supportCode, { code: error.digest })}</p>}
    />
  );
}
