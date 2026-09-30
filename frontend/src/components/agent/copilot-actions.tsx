"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui";
import { useMessages } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { runHumanAction } from "@/lib/actions";

export function UseSuggestionButton({ text }: { text: string }) {
  const t = useMessages();
  return (
    <Button variant="secondary" size="sm" className="self-start" onClick={() => window.dispatchEvent(new CustomEvent("cq:use-suggestion", { detail: text }))}>
      {t.copilot.useSuggestion}
    </Button>
  );
}

/** Tools no AI profile can call, such as blocking a card. */
export function HumanActionButton({ conversationId, actionId, label }: { conversationId: string; actionId: string; label: string }) {
  const t = useMessages();
  const { toast } = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setConfirming(false);
    try {
      await runHumanAction(conversationId, actionId);
      toast({ kind: "success", title: t.copilot.recorded, message: fmt(t.copilot.simulatedMessage, { action: label }), duration: 6000 });
      router.refresh();
    } catch {
      toast({ kind: "error", title: t.conversations.actionFailed, duration: 5000 });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {confirming ? (
        <div className="flex gap-2">
          <Button
            variant="ink"
            size="sm"
            onClick={() => void run()}
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
