"use client";

import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { useExceptionDetail } from "@/hooks/use-exception-detail";
import { useExceptionResolve } from "@/hooks/use-exception-resolve";
import {
  getExceptionChecks,
  getExceptionEntityHref,
  isInvoiceException,
  isResolvable,
  isResolvableHere,
  getExceptionTypeNote,
} from "@/lib/state/exception-state";
import { ExceptionChecksTable } from "@/components/exceptions/exception-checks-table";
import { ExceptionPaymentStatus } from "@/components/exceptions/exception-payment-status";
import { RelatedExceptions } from "@/components/exceptions/related-exceptions";
import { ResolveExceptionDialog } from "@/components/exceptions/resolve-exception-dialog";
import { formatDateTime, formatStatus } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  TickDouble01Icon,
  Cancel01Icon,
} from "@/lib/icons";
import type { Exception } from "@/types/models";

interface ExceptionDetailProps {
  id: string;
}

export function ExceptionDetail({ id }: ExceptionDetailProps) {
  const { exception, isLoading, isError, error, refetch, relatedOpenExceptions } =
    useExceptionDetail(id);

  if (isLoading) {
    return <LoadingState message="Loading exception…" className="flex-1" />;
  }

  if (isError || !exception) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  const checks = getExceptionChecks(exception);
  const entityHref = getExceptionEntityHref(exception);
  const typeNote = getExceptionTypeNote(exception.type);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <Link
        href="/exceptions"
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
        Back to exceptions
      </Link>

      <PageHeader
        title={exception.title}
        description={formatStatus(exception.type)}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={exception.severity} />
            <StatusBadge status={exception.status} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Entity</p>
          {entityHref ? (
            <Link href={entityHref} className="text-sm font-mono hover:underline">
              {exception.entityType} {exception.entityId.slice(0, 8)}…
            </Link>
          ) : (
            <p className="text-sm font-mono">
              {exception.entityType} {exception.entityId.slice(0, 8)}…
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="text-sm">{formatStatus(exception.type)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Raised</p>
          <p className="text-sm">{formatDateTime(exception.createdAt)}</p>
        </div>
      </div>

      {(exception.description || typeNote) && (
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Description</p>
          {exception.description && <p className="text-sm">{exception.description}</p>}
          {typeNote && (
            <p className="mt-2 text-xs text-muted-foreground">{typeNote}</p>
          )}
        </div>
      )}

      {checks.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Failed checks</p>
          <ExceptionChecksTable checks={checks} />
        </div>
      )}

      {isInvoiceException(exception) && <RelatedExceptions exceptions={relatedOpenExceptions} />}

      <ExceptionResolutionPanel exception={exception} />
    </div>
  );
}

/**
 * Owns the resolve mutation for a *loaded* exception — mirrors ResolveActions
 * in app/(dashboard)/exceptions/page.tsx, but rendered as the bottom panel
 * of the detail view rather than a table cell, and additionally surfaces
 * the payment-processing banner once a resolution releases the invoice.
 */
function ExceptionResolutionPanel({ exception }: { exception: Exception }) {
  const {
    pendingDecision,
    openDecision,
    handleOpenChange,
    reason,
    setReason,
    reasonError,
    handleConfirm,
    isPending,
    error,
    resolveResult,
  } = useExceptionResolve(exception);

  const releasedForPayment = resolveResult?.releasedForPayment ?? false;

  if (releasedForPayment && isInvoiceException(exception)) {
    return <ExceptionPaymentStatus invoiceId={exception.entityId} />;
  }

  // PO_APPROVAL_REQUIRED is decided on the purchase order, not here — posting
  // it to /exceptions/:id/resolve is a 409 INVALID_STATE, because closing it
  // here would leave the order stuck in PENDING_APPROVAL with nothing open
  // against it. Approving or rejecting the order closes this exception itself.
  if (isResolvable(exception.status) && !isResolvableHere(exception.type)) {
    return (
      <div className="rounded-lg border p-4 text-sm">
        <p className="mb-1 font-medium">Decide this on the purchase order</p>
        <p className="text-muted-foreground">
          This exception is the purchase order&rsquo;s own approval step. Approving or
          rejecting the order closes it automatically — it cannot be resolved from
          the exceptions inbox.
        </p>
        <Link
          href={`/purchase-orders/${exception.entityId}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Open purchase order
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </Link>
      </div>
    );
  }

  if (!isResolvable(exception.status)) {
    return (
      <div className="rounded-lg border p-4 text-sm">
        <p className="mb-2 font-medium">
          {exception.resolution === "APPROVE" ? "Approved" : "Rejected"}
        </p>
        {exception.resolutionReason && (
          <p className="text-muted-foreground">{exception.resolutionReason}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {exception.resolvedBy && `By ${exception.resolvedBy} · `}
          {exception.resolvedAt && formatDateTime(exception.resolvedAt)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2 rounded-lg border p-4">
      <Button
        variant="outline"
        className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
        onClick={() => openDecision("APPROVE")}
      >
        <HugeiconsIcon icon={TickDouble01Icon} className="size-4" />
        Approve
      </Button>
      <Button
        variant="outline"
        className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
        onClick={() => openDecision("REJECT")}
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        Reject
      </Button>

      {pendingDecision && (
        <ResolveExceptionDialog
          open={pendingDecision != null}
          onOpenChange={handleOpenChange}
          decision={pendingDecision}
          exceptionTitle={exception.title}
          reason={reason}
          onReasonChange={setReason}
          validationError={reasonError}
          onConfirm={handleConfirm}
          isPending={isPending}
          error={error}
        />
      )}
    </div>
  );
}
