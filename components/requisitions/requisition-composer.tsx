"use client";

import { useEffect, useRef } from "react";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { InlineError } from "@/components/common/error-state";
import { isRetryable } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { useRequisitionComposerDraft } from "@/hooks/use-requisition-composer-draft";

interface RequisitionComposerProps {
  /** Key identifying this composer's draft text in the store (requisition id, or "new"). */
  storeKey: string;
  placeholder: string;
  onSend: (input: string) => void;
  disabled?: boolean;
  isPending?: boolean;
  /** Error from the last failed send, if any. */
  error?: unknown;
  onRetry?: () => void;
  autoFocus?: boolean;
}

export function RequisitionComposer({
  storeKey,
  placeholder,
  onSend,
  disabled = false,
  isPending = false,
  error,
  onRetry,
  autoFocus = false,
}: RequisitionComposerProps) {
  const { text, setText } = useRequisitionComposerDraft(storeKey);
  const lastSubmittedRef = useRef("");
  const lastErrorRef = useRef<unknown>(undefined);

  // Restore the un-sent text if the send failed, so the user can retry
  // without retyping. PromptInput clears its value optimistically on submit.
  useEffect(() => {
    if (error != null && error !== lastErrorRef.current) {
      setText(lastSubmittedRef.current);
    }
    lastErrorRef.current = error;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setText comes from the store and doesn't need to retrigger this
  }, [error]);

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    lastSubmittedRef.current = trimmed;
    onSend(trimmed);
  };

  return (
    <div className="w-full space-y-2">
      <PromptInput
        placeholder={placeholder}
        value={text}
        onChange={setText}
        onSubmit={(value) => handleSubmit(value)}
        disabled={disabled}
        isPending={isPending}
        showModelSelect={false}
        showEffort={false}
        showVoice={false}
        showAttachments={false}
        maxLength={2000}
        autoFocus={autoFocus}
        fullWidth
      />

      {error != null && (
        <div className="flex items-center justify-between gap-2">
          <InlineError error={error} />
          {onRetry && isRetryable(error) && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Dismiss
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
