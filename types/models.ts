
export type RequisitionStatus =
  | "CREATED"
  | "PROCESSING"
  | "NEEDS_CLARIFICATION"
  | "REQUIREMENTS_EXTRACTED"
  | "SUPPLIER_SELECTED"
  | "PO_CREATED"
  | "FAILED";

export type MessageRole = "USER" | "ASSISTANT";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SHIPPED"
  | "RECEIVED"
  | "COMPLETED";

export type ShipmentStatus = "CREATED" | "IN_TRANSIT" | "DELIVERED";

export type GoodsReceiptStatus = "PENDING" | "PARTIAL" | "COMPLETED";

export type InvoiceStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "EXTRACTED"
  | "MATCHING"
  | "APPROVED"
  | "EXCEPTION"
  /**
   * Some, but not all, of the invoice has been settled. Reached only through a
   * human-authorized partial payment (`PARTIAL_APPROVE` on an exception) — the
   * balance is still owed and the purchase order keeps its remaining
   * commitment, so a follow-up invoice can still be matched and settled.
   * See backend-docs/payments-api.md.
   */
  | "PARTIALLY_PAID"
  /** Settled in full. Terminal, success state. */
  | "PAID"
  | "FAILED";

/**
 * UPLOADED — a real document a client posted to POST /invoices; the only
 * kind OCR reads and three-way matching acts on.
 * GENERATED — a PDFKit document rendered from the PO's own data by
 * POST /purchase-orders/:id/generate-invoice; a demo convenience document,
 * created straight at EXTRACTED, never sent to Gemini, never matched.
 * See backend-docs/invoices-api.md.
 */
export type InvoiceSource = "UPLOADED" | "GENERATED";

export type ExceptionStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";

export type ExceptionType =
  | "NO_SUPPLIER_FOUND"
  | "INVOICE_EXTRACTION_FAILED"
  | "QUANTITY_MISMATCH"
  | "PRICE_MISMATCH"
  | "SUPPLIER_MISMATCH"
  | "DUPLICATE_INVOICE"
  | "TAX_MISMATCH"
  | "TOTAL_MISMATCH"
  | "PAYMENT_FAILURE"
  | "SYSTEM_FAILURE"
  | "REQUIREMENT_INCOMPLETE"
  | "PO_APPROVAL_REQUIRED";

export type ExceptionSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * The human's verdict when resolving an exception.
 *
 * - `APPROVE` — the discrepancy is acceptable; settle whatever the invoice
 *   still owes.
 * - `PARTIAL_APPROVE` — the short-delivery answer: authorize a specific
 *   amount (`approvedAmountPaise`, required) rather than the whole invoice.
 *   The invoice becomes `PARTIALLY_PAID` and the purchase order keeps its
 *   remaining balance.
 * - `REJECT` — close the exception without releasing anything.
 *
 * See backend-docs/exceptions-api.md, "The three decisions".
 */
export type ExceptionDecision = "APPROVE" | "PARTIAL_APPROVE" | "REJECT";

/** Entities audit logs and exceptions can be filed against. */
export type EntityType =
  | "Requisition"
  | "PurchaseOrder"
  | "Shipment"
  | "GoodsReceipt"
  | "Invoice"
  | "Exception";

export type AuditActorType = "SYSTEM" | "AI" | "USER";

export type AuditAction =
  | "REQUISITION_CREATED"
  | "REQUISITION_CLARIFICATION_REQUESTED"
  | "REQUIREMENTS_EXTRACTED"
  | "SUPPLIERS_DISCOVERED"
  | "SUPPLIER_SELECTED"
  | "PO_CREATED"
  | "PO_APPROVED"
  | "PO_REJECTED"
  | "SHIPMENT_CREATED"
  | "GOODS_RECEIVED"
  | "INVOICE_UPLOADED"
  | "INVOICE_EXTRACTED"
  | "MATCH_STARTED"
  | "MATCH_COMPLETED"
  | "EXCEPTION_CREATED"
  | "EXCEPTION_RESOLVED"
  | "PAYMENT_APPROVED"
  | "PAYMENT_COMPLETED"
  | "WORKFLOW_FAILED";

/** One immutable row from GET /audit-logs. */
export interface AuditLog {
  id: string;
  organizationId: string;
  actorType: AuditActorType;
  /** null for SYSTEM/AI-attributed rows; a user id for USER-attributed ones */
  actorId: string | null;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  metadata: {
    /** Present on WORKFLOW_FAILED rows — which stage failed */
    stage?: string;
    /** Present on Exception-entityType rows — the invoice/requisition it actually concerns */
    entityType?: string;
    entityId?: string;
    [key: string]: unknown;
  };
  /** ISO 8601 */
  createdAt: string;
}

export interface RequisitionMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** ISO 8601 */
  createdAt: string;
}

/** Requirement fields extracted so far. null = not yet known. */
export interface DraftRequirements {
  productName: string | null;
  /** Positive integer */
  quantity: number | null;
  /** Integer paise */
  maxUnitPricePaise: number | null;
  /** ISO 4217, e.g. "INR" */
  currency: string | null;
  /** Positive integer, days from now */
  deliveryDays: number | null;
  location: string | null;
  specifications: Record<string, unknown>;
}

/**
 * All fields non-null. Only present once extraction is complete.
 * Note: field `deliveryDeadlineDays` (not `deliveryDays`) on the finalised form.
 */
export interface Requirement {
  productName: string;
  quantity: number;
  /** Integer paise */
  maxUnitPricePaise: number;
  /** ISO 4217 */
  currency: string;
  /** Days from now */
  deliveryDeadlineDays: number;
  /** Allowed to stay null even when complete */
  deliveryLocation: string | null;
  specifications: Record<string, unknown>;
}

/** Full requisition detail (GET /requisitions/:id) */
export interface Requisition {
  id: string;
  organizationId: string;
  /** The very first message that created this requisition */
  rawInput: string;
  status: RequisitionStatus;
  /** Set only on terminal failure */
  failureReason: string | null;
  /** Last assistant message text */
  clarificationMessage: string | null;
  missingFields: string[];
  conflicts: string[];
  draftRequirements: DraftRequirements;
  turnCount: number;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  /** null until status = REQUIREMENTS_EXTRACTED */
  requirement: Requirement | null;
  /** Full transcript, ascending createdAt */
  messages: RequisitionMessage[];
  /** null until SUPPLIER_SELECTED */
  sourcing: Sourcing | null;
  /** Empty until discovery runs */
  supplierCandidates: SupplierCandidate[];
  /** null until PO_CREATED */
  purchaseOrder: PurchaseOrder | null;
}

/** Item in the cursor-paginated list (no messages/requirement/sourcing/supplierCandidates) */
export interface RequisitionListItem {
  id: string;
  rawInput: string;
  status: RequisitionStatus;
  clarificationMessage: string | null;
  missingFields: string[];
  conflicts: string[];
  turnCount: number;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

/**
 * Response from POST /requisitions and POST /requisitions/:id/messages.
 * Use `requirements != null` to detect completed extraction, not the status string.
 */
export interface RequisitionChatResult {
  /**
   * The requisition's real status — authoritative, and how a 200 is told apart
   * from a 202. "PROCESSING" appears on a 202 only (the worker had not answered
   * within ~20s; poll GET /requisitions/:id). SUPPLIER_SELECTED / PO_CREATED /
   * FAILED mean the requisition had already moved past the conversation when
   * this turn was delivered — nothing was changed, treat it as read-only.
   */
  status: RequisitionStatus;
  requisitionId: string;
  /** Always render — the assistant's natural-language reply */
  message: string;
  /** Present when status = NEEDS_CLARIFICATION */
  missingFields?: string[];
  /** Present when status = NEEDS_CLARIFICATION */
  conflicts?: string[];
  /** Present when extraction is complete */
  requirements?: Requirement | null;
}

export interface Sourcing {
  selectedSupplier: {
    id: string;
    /** null only if the candidate row is missing */
    name: string | null;
  };
  selectedSupplierProductId: string;
  /** 0–100, 2 dp */
  totalScore: number;
  candidatesEvaluated: number;
  /** Ready to render verbatim; may be null on very old rows */
  rationale: string | null;
  /** ISO 8601 */
  decidedAt: string;
}

export interface SupplierCandidateScores {
  /** 0–100, 2dp — peer-relative for price/delivery/stock */
  price: number;
  delivery: number;
  reliability: number;
  rating: number;
  stock: number;
  /** Weighted sum of the five above */
  total: number;
}

export interface SupplierCandidate {
  supplierId: string;
  supplierName: string;
  /** 1..n across ALL candidates, eligible first */
  rank: number;
  eligible: boolean;
  /** null when eligible. Human-readable, safe to render. */
  ineligibleReason: string | null;
  /** Integer paise */
  unitPricePaise: number;
  deliveryDays: number;
  availableStock: number;
  /** All five scores are 0 for ineligible suppliers */
  scores: SupplierCandidateScores;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  supplierProductId: string;
  description: string;
  quantity: number;
  /** Integer paise */
  unitPricePaise: number;
  /** Integer paise */
  lineTotalPaise: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  requisitionId: string;
  supplierId: string;
  supplier: { id: string; name: string };
  /** Integer paise */
  subtotalPaise: number;
  /** Integer paise */
  taxPaise: number;
  /** Integer paise */
  totalPaise: number;
  /** Basis points, e.g. 1800 = 18% */
  taxRateBps: number;
  currency: string;
  /** ISO 8601 */
  expectedDeliveryDate: string;
  /** ISO 8601 or null */
  approvedAt: string | null;
  approvedBy: string | null;
  /** ISO 8601 or null */
  rejectedAt: string | null;
  rejectionReason: string | null;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  items: PurchaseOrderItem[];
}

export interface Shipment {
  id: string;
  purchaseOrderId: string;
  trackingNumber: string;
  carrier: string | null;
  status: ShipmentStatus;
  /** ISO 8601 or null */
  shippedAt: string | null;
  /** ISO 8601 or null */
  deliveredAt: string | null;
  /** ISO 8601 */
  expectedDeliveryDate: string;
  /** ISO 8601 */
  createdAt: string;
}

/** Row from GET /shipments — adds poNumber, omits nothing from Shipment. */
export interface ShipmentListItem {
  id: string;
  purchaseOrderId: string;
  poNumber: string;
  trackingNumber: string;
  carrier: string | null;
  status: ShipmentStatus;
  /** ISO 8601 or null */
  shippedAt: string | null;
  /** ISO 8601 or null */
  deliveredAt: string | null;
  /** ISO 8601 */
  expectedDeliveryDate: string;
  /** ISO 8601 */
  createdAt: string;
}

export interface ReceiptItem {
  id: string;
  purchaseOrderItemId: string;
  productId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  /** receivedQuantity - damagedQuantity */
  acceptedQuantity: number;
}

export interface GoodsReceipt {
  id: string;
  purchaseOrderId: string;
  shipmentId: string;
  status: GoodsReceiptStatus;
  /** ISO 8601 */
  receivedAt: string;
  receivedBy: string;
  notes: string | null;
  /** ISO 8601 */
  createdAt: string;
  items: ReceiptItem[];
}

/** Row from GET /receipts — summary only, no items[]. */
export interface GoodsReceiptListItem {
  id: string;
  purchaseOrderId: string;
  poNumber: string;
  shipmentId: string;
  status: GoodsReceiptStatus;
  /** ISO 8601 */
  receivedAt: string;
  receivedBy: string;
  /** ISO 8601 */
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  /** Integer paise */
  unitPricePaise: number;
  /** Integer paise */
  lineTotalPaise: number;
  /** null — matching links lines to catalogue products */
  productId: string | null;
}

export interface Invoice {
  id: string;
  purchaseOrderId: string;
  supplierId: string;
  status: InvoiceStatus;
  source: InvoiceSource;
  /**
   * No document URL is returned by the API. To show or download the document,
   * call GET /invoices/:id/pdf, which streams the stored bytes through a
   * freshly minted, short-lived link (see backend-docs/invoices-api.md).
   */
  fileMimeType: string;
  fileSizeBytes: number;
  invoiceNumber: string | null;
  /** ISO 8601 or null */
  invoiceDate: string | null;
  /** What the document claims — not reconciled against PO */
  supplierNameRaw: string | null;
  /** What the document claims */
  poNumberRaw: string | null;
  /** Integer paise or null */
  subtotalPaise: number | null;
  /** Integer paise or null */
  taxPaise: number | null;
  /** Integer paise or null */
  totalPaise: number | null;
  currency: string | null;
  /** ISO 8601 or null */
  extractedAt: string | null;
  extractionAttempts: number;
  failureReason: string | null;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  items: InvoiceItem[];
}

/**
 * One failing check inside a matching exception.
 *
 * `GET /exceptions/:id` returns these as a top-level `failedChecks` array with
 * a `severity`; the same rows also appear (without `severity`) under
 * `metadata.checks`, which is all the list endpoint carries. `severity` is
 * therefore optional — see getExceptionFailedChecks in lib/state/exception-state.ts.
 */
export interface ExceptionMatchCheck {
  checkType: string;
  /** Raw string — the unit varies by checkType (count, paise, currency code). */
  expected: string;
  actual: string;
  /** Signed. The API documents no unit, so never append one. */
  variance: number;
  severity?: ExceptionSeverity;
}

/**
 * What settling this exception's invoice would cost, from `GET /exceptions/:id`.
 * `null` for an exception that is not about an invoice (e.g. NO_SUPPLIER_FOUND).
 *
 * All amounts are integer paise. Source: backend-docs/exceptions-api.md.
 */
export interface ExceptionSettlement {
  purchaseOrderId: string;
  poNumber: string;
  currency: string;
  invoiceTotalPaise: number;
  invoiceSettledPaise: number;
  invoiceOutstandingPaise: number;
  purchaseOrderTotalPaise: number;
  purchaseOrderSettledPaise: number;
  purchaseOrderOutstandingPaise: number;
  fullySettled: boolean;
  /**
   * The "pay for what actually arrived" figure: accepted units at the
   * **purchase order's** agreed unit price plus tax at the order's rate —
   * priced off the PO, not the invoice, so an inflated invoice price is not
   * inherited. Capped at what the invoice and the order still have outstanding.
   *
   * `null` whenever the payment worker would refuse the amount anyway: nothing
   * received yet, no extracted invoice total, invoice already fully settled, or
   * purchase order already spent. When it is `null`, offer no one-click amount.
   *
   * Advisory: whatever is approved is re-checked against both balances before
   * any money moves.
   */
  suggestedAmountPaise: number | null;
}

export interface Exception {
  id: string;
  organizationId: string;
  type: ExceptionType;
  status: ExceptionStatus;
  severity: ExceptionSeverity;
  entityType: EntityType;
  entityId: string;
  title: string;
  description: string;
  metadata: {
    /** Present on matching-originated exceptions */
    checks?: ExceptionMatchCheck[];
    [key: string]: unknown;
  };
  /**
   * The failing MatchCheckResult rows, with severity. Present only on
   * `GET /exceptions/:id`; `[]` for a non-matching exception, and absent
   * entirely on rows that came from the list endpoint.
   */
  failedChecks?: ExceptionMatchCheck[];
  /**
   * The invoice/PO ledger behind this exception. Present only on
   * `GET /exceptions/:id`, and `null` when the exception is not about an
   * invoice.
   */
  settlement?: ExceptionSettlement | null;
  resolution: ExceptionDecision | null;
  resolutionReason: string | null;
  /** ISO 8601 or null */
  resolvedAt: string | null;
  resolvedBy: string | null;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}
