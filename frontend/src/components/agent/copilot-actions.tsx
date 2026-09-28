"use client";

import { useState } from "react";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui";
import { useMessages } from "@/i18n/client";

export function UseSuggestionButton({ text }: { text: string }) {
  const t = useMessages();
  return (
    <Button variant="secondary" size="sm" className="self-start" onClick={() => window.dispatchEvent(new CustomEvent("cq:use-suggestion", { detail: text }))}>
      {t.copilot.useSuggestion}
    </Button>
  );
}

/** Tools no AI profile can call, such as blocking a card. */
export function HumanActionButton({ label }: { label: string }) {
  const t = useMessages();
  const { notImplemented } = useToast();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      {confirming ? (
        <div className="flex gap-2">
          <Button
            variant="ink"
            size="sm"
            onClick={() => {
              setConfirming(false);
              notImplemented(label);
            }}
          >
            {t.common.confirm}
          </Button>
          <Button variant="tertiary" size="sm" onClick={() => setConfirming(false)}>
            {t.common.cancel}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setConfirming(true)}>
          {label}
        </Button>
      )}
      <span className="text-[12px] text-muted">{t.copilot.humanOnly}</span>
    </div>
  );
}
