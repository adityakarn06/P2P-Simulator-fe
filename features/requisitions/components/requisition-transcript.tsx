"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/features/requisitions/components/message-bubble";
import { Spinner } from "@/components/loading-state";
import type { RequisitionMessage } from "@/types/models";

interface RequisitionTranscriptProps {
  messages: RequisitionMessage[];
  /** Optimistic user text shown while a send is in flight (not yet in `messages`). */
  pendingUserText?: string | null;
  /** True while waiting on an assistant reply (create or send-message mutation). */
  isWaitingForReply?: boolean;
  className?: string;
}

export function RequisitionTranscript({
  messages,
  pendingUserText,
  isWaitingForReply = false,
  className,
}: RequisitionTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pendingUserText, isWaitingForReply]);

  return (
    <div className={className}>
      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {pendingUserText && (
          <MessageBubble
            message={{ role: "USER", content: pendingUserText, createdAt: new Date().toISOString() }}
            isPending
          />
        )}

        {isWaitingForReply && (
          <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
            <Spinner size="sm" />
            <span>Thinking…</span>
          </div>
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
