import type {
  GoodsReceipt,
  Invoice,
  PurchaseOrder,
  Exception,
} from "@/types/models";

/**
 * Client-side reconciliation of a purchase order, its goods receipt and the
 * invoice billed against it — the three documents three-way matching compares.
 *
 * **This is not the backend's verdict.** The API exposes no read endpoint for a
 * ThreeWayMatch: a passing match's check breakdown is not fetchable anywhere,
 * and only the *failed* checks behind an open exception surface, via
 * `exception.metadata.checks`. So a screen that wants to show a *successful*
 * match has to compare the documents itself. Every caller must label the result
 * as a client-side reconciliation, and `matchOutcome` below reads the invoice's
 * real status rather than inferring a verdict from these rows.
 *
 * All arithmetic is in integer paise. Free of React so it can be unit tested
 * directly (see __tests__/match-state.test.ts).
 */

export type MatchRowStatus = "match" | "mismatch" | "unavailable";

export interface MatchRow {
  key: string;
  label: string;
  /** What the purchase order ordered. `null` when the concept does not apply. */
  ordered: string | null;
  /** What the goods receipt accepted. `null` when no receipt exists yet. */
  received: string | null;
  /** What the invoice bills. `null` when the field was never extracted. */
  invoiced: string | null;
  status: MatchRowStatus;
}

export interface MatchLineGroup {
  /** The PO line's description — the anchor all three documents are compared on. */
  description: string;
  rows: MatchRow[];
}

export interface ThreeWayMatchView {
  /** True when a goods receipt exists; false means this is a two-way PO↔Invoice view. */
  hasReceipt: boolean;
  lines: MatchLineGroup[];
  totals: MatchRow[];
  /** True when every comparable row matched. Descriptive only — not the backend's verdict. */
  allRowsMatch: boolean;
}

function paise(value: number | null | undefined): string | null {
  if (value == null) return null;
  return String(value);
}

function compare(a: string | null, b: string | null): MatchRowStatus {
  if (a == null || b == null) return "unavailable";
  return a === b ? "match" : "mismatch";
}

/**
 * The status for a row compared across however many documents actually carry
 * the field. A row is only a mismatch when two *present* values disagree —
 * a missing receipt or an unextracted invoice field is "unavailable", never a
 * failure. Reporting an absent number as a mismatch would manufacture a
 * discrepancy out of a document that simply has not arrived.
 */
function rowStatus(values: (string | null)[]): MatchRowStatus {
  const present = values.filter((v): v is string => v != null);
  if (present.length < 2) return "unavailable";
  return present.every((v) => v === present[0]) ? "match" : "mismatch";
}

/**
 * Builds the PO / Receipt / Invoice comparison.
 *
 * Invoice lines are matched to PO lines by description, because the API
 * documents `InvoiceItem.productId` as null — matching links lines to catalogue
 * products server-side, and the client has no such link. A PO line the invoice
 * never billed still appears, with a null invoiced column.
 */
export function deriveThreeWayMatch(
  po: PurchaseOrder,
  receipt: GoodsReceipt | null,
  invoice: Invoice
): ThreeWayMatchView {
  const lines: MatchLineGroup[] = po.items.map((poItem) => {
    const receiptItem = receipt?.items.find(
      (r) => r.purchaseOrderItemId === poItem.id
    );
    const invoiceItem = invoice.items.find(
      (i) => i.description.trim().toLowerCase() === poItem.description.trim().toLowerCase()
    );

    const quantityRow: MatchRow = {
      key: `${poItem.id}-quantity`,
      label: "Quantity",
      ordered: String(poItem.quantity),
      // Accepted, not received: accepted = received − damaged, and it is the
      // quantity the organization actually keeps and should be billed for.
      received: receiptItem ? String(receiptItem.acceptedQuantity) : null,
      invoiced: invoiceItem ? String(invoiceItem.quantity) : null,
      status: "unavailable",
    };
    quantityRow.status = rowStatus([
      quantityRow.ordered,
      quantityRow.received,
      quantityRow.invoiced,
    ]);

    const unitPriceRow: MatchRow = {
      key: `${poItem.id}-unit-price`,
      label: "Unit price",
      ordered: paise(poItem.unitPricePaise),
      // A goods receipt records quantities, never money — there is nothing to
      // compare here, and a blank is the honest rendering.
      received: null,
      invoiced: invoiceItem ? paise(invoiceItem.unitPricePaise) : null,
      status: "unavailable",
    };
    unitPriceRow.status = compare(unitPriceRow.ordered, unitPriceRow.invoiced);

    const lineTotalRow: MatchRow = {
      key: `${poItem.id}-line-total`,
      label: "Line total",
      ordered: paise(poItem.lineTotalPaise),
      received: null,
      invoiced: invoiceItem ? paise(invoiceItem.lineTotalPaise) : null,
      status: "unavailable",
    };
    lineTotalRow.status = compare(lineTotalRow.ordered, lineTotalRow.invoiced);

    return {
      description: poItem.description,
      rows: [quantityRow, unitPriceRow, lineTotalRow],
    };
  });

  const totals: MatchRow[] = [
    {
      key: "subtotal",
      label: "Subtotal",
      ordered: paise(po.subtotalPaise),
      received: null,
      invoiced: paise(invoice.subtotalPaise),
      status: compare(paise(po.subtotalPaise), paise(invoice.subtotalPaise)),
    },
    {
      key: "tax",
      label: "Tax",
      ordered: paise(po.taxPaise),
      received: null,
      invoiced: paise(invoice.taxPaise),
      status: compare(paise(po.taxPaise), paise(invoice.taxPaise)),
    },
    {
      key: "total",
      label: "Total",
      ordered: paise(po.totalPaise),
      received: null,
      invoiced: paise(invoice.totalPaise),
      status: compare(paise(po.totalPaise), paise(invoice.totalPaise)),
    },
    {
      key: "currency",
      label: "Currency",
      ordered: po.currency,
      received: null,
      invoiced: invoice.currency,
      status: compare(po.currency, invoice.currency),
    },
  ];

  const everyRow = [...lines.flatMap((l) => l.rows), ...totals];
  const comparable = everyRow.filter((r) => r.status !== "unavailable");

  return {
    hasReceipt: receipt != null,
    lines,
    totals,
    allRowsMatch: comparable.length > 0 && comparable.every((r) => r.status === "match"),
  };
}

export type MatchOutcome = "passed" | "exception" | "pending" | "failed";

/**
 * What the *backend* concluded, read off the invoice's own status and its open
 * exceptions — never inferred from the comparison rows above.
 *
 * "passed" is claimed only for an invoice the backend approved or paid with no
 * exception standing against it. That last condition matters: an exception can
 * be reopened, so an invoice's clean history is not something to cache.
 */
export function matchOutcome(
  invoice: Pick<Invoice, "status">,
  exceptions: Pick<Exception, "status">[]
): MatchOutcome {
  const hasOpenException = exceptions.some(
    (e) => e.status === "OPEN" || e.status === "UNDER_REVIEW"
  );
  if (hasOpenException) return "exception";

  switch (invoice.status) {
    case "APPROVED":
    case "PAID":
      return "passed";
    case "EXCEPTION":
      return "exception";
    case "FAILED":
      return "failed";
    default:
      return "pending";
  }
}
