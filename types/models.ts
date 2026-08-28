
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

/** The human's verdict when resolving an exception. */
export type ExceptionDecision = "APPROVE" | "REJECT";

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
  status: "NEEDS_CLARIFICATION" | "PROCESSING" | "REQUIREMENTS_EXTRACTED";
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
  /** Signed, expiring Cloudinary URL */
  fileUrl: string;
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

/** One failing check inside a matching exception */
export interface ExceptionMatchCheck {
  checkType: string;
  expected: string;
  actual: string;
  variance: number;
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
