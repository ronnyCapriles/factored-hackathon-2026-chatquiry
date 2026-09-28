"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/feedback/status-page";
import { Button, ButtonLink } from "@/components/ui";
import { useMessages } from "@/i18n/client";
import { fmt } from "@/i18n/config";

export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useMessages().status;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <StatusPage
        code="500"
        state="needs_human"
        title={t.errorTitle}
        message={t.errorMessage}
        actions={
          <>
            <Button onClick={() => retry()}>{t.retry}</Button>
            <ButtonLink href="/" variant="secondary">{t.home}</ButtonLink>
          </>
        }
        detail={error.digest && <p className="tabular text-[13px] text-muted">{fmt(t.supportCode, { code: error.digest })}</p>}
      />
    </div>
  );
}
