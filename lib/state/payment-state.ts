import type {
  Payment,
  PaymentKind,
  PaymentLedger,
  PaymentStatus,
} from "@/types/payments";

/**
 * Derivation logic for the settlement ledger, kept free of React so it can be
 * unit tested directly (see __tests__/payment-state.test.ts).
 *
 * Source of truth: backend-docs/payments-api.md. All arithmetic is on integer
 * paise — never convert to rupees before computing.
 */

/**
 * Refresh cadence for payment lists and detail. A PENDING/PROCESSING tranche is
 * a worker in flight, so it is polled at the pipeline cadence; a settled or
 * refused one is not re-polled at all.
 */
export const PAYMENT_POLL_MS = 2000;

/** True while a worker still has this tranche in hand. */
export function isPaymentInFlight(status: PaymentStatus): boolean {
  return status === "PENDING" || status === "PROCESSING";
}

/**
 * Poll interval (ms) for a payment, or `false` to stop.
 *
 * COMPLETED, FAILED and BLOCKED are all resting states. BLOCKED in particular
 * is not transient: the full-value row matching parked stays BLOCKED after a
 * PARTIAL_APPROVE, because the settlement for the whole amount really was
 * refused. Polling it would never produce a change.
 */
export function getPaymentPollInterval(status: PaymentStatus): number | false {
  return isPaymentInFlight(status) ? PAYMENT_POLL_MS : false;
}

/**
 * Why a payment is not going to settle, as plain prose, or null when there is
 * nothing to explain. Reads the backend's own reason strings rather than
 * inventing copy — only the fallback is ours, and only so a BLOCKED/FAILED row
 * never renders a bare badge with no explanation at all.
 */
export function getPaymentBlockReason(
  payment: Pick<Payment, "status" | "blockedReason" | "failureReason">
): string | null {
  if (payment.status === "BLOCKED") {
    return (
      payment.blockedReason ??
      "The payment gate refused this settlement. A smaller amount may have been authorized instead."
    );
  }
  if (payment.status === "FAILED") {
    return payment.failureReason ?? "The payment provider rejected this settlement.";
  }
  return null;
}

/**
 * True when a human authorized this tranche while resolving an exception, as
 * opposed to the payment worker writing it automatically after a clean match.
 * Keyed off `authorizingExceptionId` rather than `kind`: a human-approved
 * amount that happens to clear the invoice is still `FULL`.
 */
export function isHumanAuthorized(
  payment: Pick<Payment, "authorizingExceptionId">
): boolean {
  return payment.authorizingExceptionId != null;
}

/**
 * Percentage (0–100) of the invoice that has actually been settled, or null
 * when the invoice total was never extracted and the figure would be a guess.
 *
 * Uses `invoiceSettledPaise` / `invoice.totalPaise` — both properties of the
 * invoice, so every tranche of one invoice yields the same percentage. That is
 * intentional: this describes the invoice's settlement, not this row's share.
 */
export function getSettlementPercent(
  payment: Pick<Payment, "invoiceSettledPaise" | "invoice">
): number | null {
  const total = payment.invoice?.totalPaise;
  if (total == null || total <= 0) return null;
  return Math.min(100, (payment.invoiceSettledPaise / total) * 100);
}

/**
 * True when there is a real, meaningful shortfall to show. `shortfallPaise` is
 * `0` both when the invoice is fully settled *and* when the total was never
 * extracted, so a caller must not read a zero as "paid in full".
 */
export function hasShortfall(
  payment: Pick<Payment, "shortfallPaise" | "invoice">
): boolean {
  return payment.shortfallPaise > 0 && payment.invoice?.totalPaise != null;
}

export interface LedgerLine {
  label: string;
  totalPaise: number;
  settledPaise: number;
  outstandingPaise: number;
}

/**
 * Splits a ledger into its two independent balances. They are genuinely
 * different questions — "has the supplier been paid what they billed?" versus
 * "has this commitment been spent?" — and the automatic settlement pays the
 * *order's* remaining balance, not the invoice's, because the order total is
 * the buyer's own calculated figure while the invoice total was transcribed off
 * a document by OCR.
 */
export function toLedgerLines(ledger: PaymentLedger): LedgerLine[] {
  return [
    {
      label: "Invoice",
      totalPaise: ledger.invoiceTotalPaise,
      settledPaise: ledger.invoiceSettledPaise,
      outstandingPaise: ledger.invoiceOutstandingPaise,
    },
    {
      label: "Purchase order",
      totalPaise: ledger.purchaseOrderTotalPaise,
      settledPaise: ledger.purchaseOrderSettledPaise,
      outstandingPaise: ledger.purchaseOrderOutstandingPaise,
    },
  ];
}

/**
 * Sum of every COMPLETED tranche in a list. Only COMPLETED counts — a PENDING
 * or BLOCKED row is money that has not moved, and adding it in would overstate
 * what the supplier has been paid.
 */
export function sumCompletedPaise(payments: Pick<Payment, "status" | "amountPaise">[]): number {
  return payments.reduce(
    (sum, p) => (p.status === "COMPLETED" ? sum + p.amountPaise : sum),
    0
  );
}

/**
 * Human label for a tranche. `kind` alone reads oddly next to a human decision
 * ("Full" for an amount someone had to argue for), so the authorization is
 * folded in.
 */
export function getPaymentKindLabel(
  payment: Pick<Payment, "kind" | "authorizingExceptionId">
): string {
  const base: Record<PaymentKind, string> = {
    FULL: "Full settlement",
    PARTIAL: "Partial settlement",
  };
  return isHumanAuthorized(payment)
    ? `${base[payment.kind]} · approved`
    : `${base[payment.kind]} · automatic`;
}
