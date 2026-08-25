import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CalloutTone = "info" | "progress" | "success" | "warning" | "error";

/** Mirrors the tone→classes map that lived in invoice-detail.tsx before this was extracted. */
const TONE_CLASSNAMES: Record<CalloutTone, string> = {
  info: "border-border bg-muted/40",
  progress: "border-primary/40 bg-primary/5",
  success: "border-emerald-500/40 bg-emerald-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  error: "border-destructive/40 bg-destructive/5 text-destructive",
};

interface CalloutProps {
  tone: CalloutTone;
  /**
   * Leading icon/spinner, already rendered (e.g. `<HugeiconsIcon icon={X}
   * className="size-4" />` or `<Spinner size="sm" />`) — Callout only
   * positions it, so any size-4-ish node works.
   */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The bordered/tinted callout box repeated across purchase-order-section,
 * shipment-section, invoice-detail and the requisition detail page (slow-poll
 * and failure notices) — one tone→className map instead of five copies.
 */
export function Callout({ tone, icon, children, className }: CalloutProps) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-4 text-sm",
        TONE_CLASSNAMES[tone],
        className
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  );
}
