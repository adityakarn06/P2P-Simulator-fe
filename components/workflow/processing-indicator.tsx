import { cn } from "@/lib/utils";

interface ProcessingIndicatorProps {
  label: string;
  /**
   * "working" — a backend job is genuinely running right now (animated dot).
   * "awaiting" — the pipeline is parked on a human action (static dot).
   * Never conflate the two: an awaiting state must not look like progress.
   */
  variant: "working" | "awaiting";
  /**
   * Announce this caption to screen readers via a polite live region. The
   * same label is frequently rendered in more than one place at once (the
   * page header, a section header, and a timeline step all read off the
   * same derived stage) — only one of those instances should announce, or
   * assistive tech reads the same sentence 2-3x on every poll tick. Defaults
   * to false; the page header is the only caller that opts in.
   */
  announce?: boolean;
  className?: string;
}

/**
 * Small "what's happening right now" caption. No percentage, no ETA, no fake
 * realtime — just a label sourced from real backend state (see
 * lib/state/requisition-state.ts).
 */
export function ProcessingIndicator({
  label,
  variant,
  announce = false,
  className,
}: ProcessingIndicatorProps) {
  return (
    <span
      role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        variant === "working"
          ? "text-blue-600 dark:text-blue-400"
          : "text-amber-600 dark:text-amber-400",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          variant === "working"
            ? "bg-blue-500 animate-pulse motion-reduce:animate-none"
            : "bg-amber-500"
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
