import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/formatters";
import type { RequisitionMessage } from "@/types/models";

interface MessageBubbleProps {
  message: Pick<RequisitionMessage, "role" | "content" | "createdAt">;
  /** Renders a subdued "sending…" style instead of the timestamp. */
  isPending?: boolean;
}

export function MessageBubble({ message, isPending = false }: MessageBubbleProps) {
  const isUser = message.role === "USER";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
          isPending && "opacity-70"
        )}
      >
        <p>{message.content}</p>
        <p
          className={cn(
            "mt-1 text-[10px] tabular-nums",
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {isPending ? "Sending…" : formatRelativeTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
