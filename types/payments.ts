/**
 * Payment (settlement) types.
 *
 * Source of truth: backend-docs/payments-api.md. The API is read-only — there
 * is deliberately no POST/PATCH/DELETE, because an HTTP endpoint that could
 * mark an invoice paid would bypass three-way matching and the settlement caps
 * entirely. A payment row appears either automatically after a clean match, or
 * because a human authorized an amount while resolving an exception.
 *
 * Every `*Paise` field is an integer in minor units. Never do floating-point
 * arithmetic on them.
 */

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  /**
   * The payment gate refused to settle. Notably, the full-value row parked by
   * matching *stays* BLOCKED after a `PARTIAL_APPROVE` — the settlement for the
   * whole amount was refused and a smaller one authorized instead. Only a full
   * `APPROVE` releases it.
   */
  | "BLOCKED";

/** `FULL` when the tranche clears the invoice outright, `PARTIAL` when it does not. */
export type PaymentKind = "FULL" | "PARTIAL";

/**
 * One settlement tranche. `(invoiceId, settlementKey)` is unique: an invoice is
 * not paid all-or-nothing, and a purchase order is not limited to one invoice.
 */
export interface Payment {
  id: string;
  invoiceId: string;
  /**
   * `"auto"` for the automatic settlement following a clean match, or
   * `"exc-<exceptionId>"` for an amount a human approved while resolving an
   * exception.
   */
  settlementKey: string;
  purchaseOrderId: string;
  /** Integer paise — this tranche only, not the invoice total. */
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  kind: PaymentKind;
  provider: string;
  providerReference: string | null;
  blockedReason: string | null;
  failureReason: string | null;
  /** Who authorized a human-approved tranche; null for an automatic one. */
  authorizedBy: string | null;
  authorizationReason: string | null;
  authorizingExceptionId: string | null;
  /**
   * Everything COMPLETED against this payment's **invoice**, across all its
   * tranches — a property of the invoice, not of this row, so every tranche of
   * one invoice reports the same figure.
   */
  invoiceSettledPaise: number;
  /**
   * `invoice.totalPaise - invoiceSettledPaise`, floored at zero. Also a
   * property of the invoice, so it too repeats across tranches. `0` (not a
   * guess) when the invoice total was never extracted.
   */
  shortfallPaise: number;
  /** ISO 8601 or null */
  processedAt: string | null;
  /** ISO 8601 or null */
  completedAt: string | null;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  invoice: {
    invoiceNumber: string | null;
    status: string;
    totalPaise: number | null;
    supplier: { id: string; name: string } | null;
  } | null;
  purchaseOrder: {
    poNumber: string;
    totalPaise: number;
    currency: string;
  } | null;
}

/**
 * The order-level ledger from `GET /payments/:id`. Same shape as the
 * `settlement` block on an exception detail, minus the suggestion.
 */
export interface PaymentLedger {
  poNumber: string;
  invoiceTotalPaise: number;
  invoiceSettledPaise: number;
  invoiceOutstandingPaise: number;
  purchaseOrderTotalPaise: number;
  purchaseOrderSettledPaise: number;
  purchaseOrderOutstandingPaise: number;
  fullySettled: boolean;
}

/** A trimmed tranche settling the same purchase order as the payment being viewed. */
export interface PaymentSibling {
  id: string;
  invoiceId: string;
  settlementKey: string;
  amountPaise: number;
  status: PaymentStatus;
  kind: PaymentKind;
}

/**
 * `GET /payments/:id` — a partial payment only means something next to what
 * else has been paid against the same commitment, so the detail response
 * carries the order ledger and the other tranches alongside the row.
 */
export interface PaymentDetail {
  payment: Payment;
  ledger: PaymentLedger;
  siblings: PaymentSibling[];
}
