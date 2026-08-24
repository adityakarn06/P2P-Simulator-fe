"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { InlineError } from "@/components/error-state";
import { isRetryable } from "@/lib/errors";
import { Button } from "@/components/ui/button";

const inputSchema = z.string().trim().min(1, "Message can't be empty.").max(
  2000,
  "Message must be 2000 characters or fewer."
);

interface RequisitionComposerProps {
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
  placeholder,
  onSend,
  disabled = false,
  isPending = false,
  error,
  onRetry,
  autoFocus = false,
}: RequisitionComposerProps) {
  const [text, setText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const lastSubmittedRef = useRef("");
  const lastErrorRef = useRef<unknown>(undefined);

  // Restore the un-sent text if the send failed, so the user can retry
  // without retyping. PromptInput clears its value optimistically on submit.
  useEffect(() => {
    if (error != null && error !== lastErrorRef.current) {
      setText(lastSubmittedRef.current);
    }
    lastErrorRef.current = error;
  }, [error]);

  const handleSubmit = (value: string) => {
    const result = inputSchema.safeParse(value);
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? "Invalid input.");
      setText(value);
      return;
    }
    setValidationError(null);
    lastSubmittedRef.current = result.data;
    onSend(result.data);
  };

  return (
    <div className="w-full space-y-2">
      <PromptInput
        placeholder={placeholder}
        value={text}
        onChange={(value) => {
          setText(value);
          if (validationError) setValidationError(null);
        }}
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

      {validationError && <InlineError error={new Error(validationError)} />}

      {error != null && !validationError && (
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
