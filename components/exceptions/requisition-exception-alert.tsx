"use client";

import Link from "next/link";
import { Callout } from "@/components/common/callout";
import { StatusBadge } from "@/components/common/status-badge";
import { InlineError } from "@/components/common/error-state";
import { ExceptionChecksTable } from "@/components/exceptions/exception-checks-table";
import { buttonVariants } from "@/components/ui/button";
import { useExceptions } from "@/hooks/use-exceptions";
import { EXCEPTION_POLL_MS, getExceptionChecks, isResolvable } from "@/lib/state/exception-state";
import { formatStatus } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, ArrowRight01Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface RequisitionExceptionAlertProps {
  invoiceId: string;
  className?: string;
}

/**
 * Surfaces the invoice's blocking exception(s) directly on
 * /requisitions/[id] so the EXCEPTION → human review branch of the flow is
 * visible without navigating away first. Links through to /exceptions/:id
 * for the actual approve/reject decision — that UI is not duplicated here.
 *
 * Query matches the shape hooks/use-requisition-activity.ts issues for this
 * invoice (`{entityId, limit: 100}`), so TanStack dedupes the two onto one
 * request *if* the Activity section happens to be expanded — it defaults to
 * collapsed (WorkflowSection doesn't mount its children while closed), so on
 * the page's default state this is a real, separate fetch. Polls
 * independently at the same cadence as the exceptions inbox so a
 * later-filed exception appears without a reload.
 */
export function RequisitionExceptionAlert({
  invoiceId,
  className,
}: RequisitionExceptionAlertProps) {
  const { data, isLoading, isError, error } = useExceptions(
    { entityId: invoiceId, limit: 100 },
    { enabled: Boolean(invoiceId), refetchInterval: EXCEPTION_POLL_MS }
  );

  // Nothing to show yet, and — unlike an error — nothing to say either; the
  // amber warning box belongs only once we know there is something to warn
  // about. Rendering it here for isLoading would flash a warning + skeleton
  // for every invoice whose exceptions turn out to already be resolved.
  if (isLoading) {
    return null;
  }

  if (isError) {
    return (
      <Callout
        tone="error"
        icon={<HugeiconsIcon icon={Alert01Icon} className="size-4" />}
        className={className}
      >
        <InlineError error={error} />
      </Callout>
    );
  }

  const openExceptions = (data?.items ?? []).filter((e) => isResolvable(e.status));
  if (openExceptions.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {openExceptions.map((exception) => {
        const checks = getExceptionChecks(exception);
        return (
          <Callout
            key={exception.id}
            tone="warning"
            icon={<HugeiconsIcon icon={Alert01Icon} className="size-4" />}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{formatStatus(exception.type)}</p>
              <StatusBadge status={exception.severity} />
              <StatusBadge status={exception.status} />
            </div>
            <p className="text-muted-foreground">{exception.description}</p>
            {checks.length > 0 && <ExceptionChecksTable checks={checks} />}
            <Link
              href={`/exceptions/${exception.id}`}
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-1 gap-1.5")}
            >
              Review exception
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
            </Link>
          </Callout>
        );
      })}
    </div>
  );
}
