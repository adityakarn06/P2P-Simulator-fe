"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/common/callout";
import { Money } from "@/components/common/money";
import { Spinner, SkeletonLines } from "@/components/common/loading-state";
import { InlineError } from "@/components/common/error-state";
import { LottiePlayer } from "@/components/common/lottie-player";
import { ExceptionSettlementPanel } from "@/components/exceptions/exception-settlement-panel";
import { ExceptionChecksTable } from "@/components/exceptions/exception-checks-table";
import { ResolveExceptionDialog } from "@/components/exceptions/resolve-exception-dialog";
import { InvoicePaymentsPanel } from "@/components/payments/invoice-payments-panel";
import { useException } from "@/hooks/use-exceptions";
import { useExceptionResolve } from "@/hooks/use-exception-resolve";
import {
  canPartialApprove,
  getExceptionFailedChecks,
  getExceptionPollInterval,
  getExceptionSettlement,
  isResolvable,
} from "@/lib/state/exception-state";
import { formatStatus } from "@/lib/formatters";
import {
  Alert01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
} from "@/lib/icons";
import type { Exception, Invoice } from "@/types/models";

const PAID_ANIMATION_SRC = "/animations/paid.json";

/**
 * The payment stage of the requisition workflow, rendered under the three-way
 * match animation on /requisitions/[id].
 *
 * Two things this card deliberately does not do, both from
 * backend-docs/payments-api.md:
 *
 * 1. It never offers a button that "pays". There is no POST /payments — a
 *    clean match is settled by the payment worker, so a passing match shows
 *    the settlement happening and waits for it, driven by the invoice poll
 *    that MatchingSection already runs.
 * 2. The only money the user can authorize is a partial settlement, and that
 *    is POST /exceptions/:id/resolve with PARTIAL_APPROVE — which requires an
 *    amount *and* a written reason (10–1000 chars). So the button opens the
 *    existing ResolveExceptionDialog rather than firing a request.
 */
export function RequisitionPaymentCard({
  invoice,
  exceptions,
}: {
  invoice: Invoice;
  /** The invoice's exceptions, from the list query MatchingSection already holds. */
  exceptions: Exception[];
}) {
  const openExceptions = exceptions.filter((e) => isResolvable(e.status));

  if (invoice.status === "PAID") {
    return (
      <SettledCard
        invoiceId={invoice.id}
        title="Payment completed"
        detail="The match passed and the payment worker settled the invoice in full."
        amountPaise={invoice.totalPaise}
        amountLabel="Paid"
      />
    );
  }

  if (invoice.status === "PARTIALLY_PAID") {
    return (
      <SettledCard
        invoiceId={invoice.id}
        title="Partial payment settled"
        detail="An approver authorized an amount against this invoice. The purchase order keeps its remaining balance, so a follow-up invoice for the rest can still be matched."
        amountPaise={invoice.totalPaise}
        amountLabel="Billed"
      />
    );
  }

  if (openExceptions.length > 0) {
    return <BlockedPayment invoice={invoice} openExceptions={openExceptions} />;
  }

  if (invoice.status === "APPROVED") {
    return (
      <Callout tone="progress" icon={<Spinner size="sm" />}>
        <p className="font-medium">Payment processing</p>
        <p className="text-muted-foreground">
          The match passed and payment was queued automatically. Nothing to approve — this
          updates itself the moment the worker settles.
        </p>
      </Callout>
    );
  }

  if (invoice.status === "EXCEPTION") {
    // Every exception on the invoice is decided, but the backend has not moved
    // it on yet — either a resolution is still being applied, or the last one
    // was a REJECT, which closes the exception and leaves payment blocked for
    // good (backend-docs/exceptions-api.md). Neither is a state to show a
    // spinner for, and neither is something this screen can act on.
    return (
      <Callout tone="warning" icon={<HugeiconsIcon icon={Alert01Icon} className="size-4" />}>
        <p className="font-medium">Payment blocked</p>
        <p className="text-muted-foreground">
          Matching raised an exception on this invoice and nothing is open against it to
          decide. If it was rejected, that is final for this invoice.
        </p>
      </Callout>
    );
  }

  // MATCHING / EXTRACTED / UPLOADED / FAILED: the animation above already says
  // where things stand, and there is no payment story to tell yet.
  return null;
}

/**
 * The paid state: the Lottie, the figure, and every tranche behind it.
 * `totalPaise` is what the supplier billed; the tranche list underneath is what
 * actually moved, which for a partial settlement is deliberately less.
 */
function SettledCard({
  invoiceId,
  title,
  detail,
  amountPaise,
  amountLabel,
}: {
  invoiceId: string;
  title: string;
  detail: string;
  amountPaise: number | null;
  amountLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-6 text-center">
        <LottiePlayer
          src={PAID_ANIMATION_SRC}
          className="size-28"
          label={title}
          fallback={
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="size-14 text-emerald-600 dark:text-emerald-400"
            />
          }
        />
        <p className="text-base font-medium text-emerald-700 dark:text-emerald-400">{title}</p>
        {amountPaise != null && (
          <p className="text-sm text-muted-foreground">
            {amountLabel} <Money paise={amountPaise} className="font-medium text-foreground" />
          </p>
        )}
        <p className="max-w-prose text-pretty text-xs text-muted-foreground">{detail}</p>
      </div>

      <InvoicePaymentsPanel invoiceId={invoiceId} />
    </div>
  );
}

/**
 * Payment held behind one or more open exceptions.
 *
 * Only the first open exception is decidable here — that is the one whose
 * `settlement` (and therefore `suggestedAmountPaise`) is fetched, since the
 * list endpoint does not carry it. Approving it does not necessarily release
 * the invoice: `releasedForPayment` is false while any other exception is
 * still open, so the rest stay listed rather than being treated as decided.
 */
function BlockedPayment({
  invoice,
  openExceptions,
}: {
  invoice: Invoice;
  openExceptions: Exception[];
}) {
  const [primary, ...others] = openExceptions;
  const detail = useException(primary.id, {
    refetchInterval: getExceptionPollInterval(primary.status),
  });

  return (
    <div className="space-y-3">
      <Callout tone="warning" icon={<HugeiconsIcon icon={Alert01Icon} className="size-4" />}>
        <p className="font-medium">Payment blocked</p>
        <p className="text-muted-foreground">
          Three-way matching raised {openExceptions.length === 1 ? "an exception" : `${openExceptions.length} exceptions`}{" "}
          against{" "}
          <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">
            this invoice
          </Link>
          . No money moves until {openExceptions.length === 1 ? "it is" : "they are"} decided.
        </p>
      </Callout>

      {detail.isLoading ? (
        <SkeletonLines />
      ) : detail.isError ? (
        <InlineError error={detail.error} />
      ) : detail.data ? (
        <ExceptionDecision exception={detail.data} otherOpenCount={others.length} />
      ) : null}
    </div>
  );
}

function ExceptionDecision({
  exception,
  otherOpenCount,
}: {
  exception: Exception;
  otherOpenCount: number;
}) {
  const resolve = useExceptionResolve(exception);
  const settlement = getExceptionSettlement(exception);
  const checks = getExceptionFailedChecks(exception);
  const partialAvailable = canPartialApprove(exception);
  const suggestedPaise = settlement?.suggestedAmountPaise ?? null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">{formatStatus(exception.type)}</p>
        <p className="text-pretty text-xs text-muted-foreground">{exception.description}</p>
      </div>

      {checks.length > 0 && <ExceptionChecksTable checks={checks} />}

      {settlement && <ExceptionSettlementPanel settlement={settlement} />}

      {otherOpenCount > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {otherOpenCount === 1
            ? "One more exception is open on this invoice"
            : `${otherOpenCount} more exceptions are open on this invoice`}
          . Deciding this one alone will not release payment.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {partialAvailable && suggestedPaise != null ? (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => resolve.openDecision("PARTIAL_APPROVE")}
          >
            <HugeiconsIcon icon={CreditCardIcon} className="size-4" />
            Pay partial · <Money paise={suggestedPaise} />
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            No partial payment can be offered — nothing has been received yet, the invoice
            total was never extracted, or the invoice or purchase order is already settled.
          </p>
        )}

        <Link
          href={`/exceptions/${exception.id}`}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          Review in full
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        </Link>
      </div>

      <ResolveExceptionDialog
        open={resolve.pendingDecision === "PARTIAL_APPROVE"}
        onOpenChange={resolve.handleOpenChange}
        decision="PARTIAL_APPROVE"
        exceptionTitle={exception.title}
        reason={resolve.reason}
        onReasonChange={resolve.setReason}
        validationError={resolve.reasonError}
        approvedAmount={resolve.approvedAmount}
        onApprovedAmountChange={resolve.setApprovedAmount}
        approvedAmountError={resolve.approvedAmountError}
        settlement={resolve.settlement}
        onConfirm={resolve.handleConfirm}
        isPending={resolve.isPending}
        error={resolve.error}
      />
    </div>
  );
}
