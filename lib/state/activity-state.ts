import type { AuditAction, AuditActorType, AuditLog, EntityType, RequisitionStatus } from "@/types/models";

/**
 * Derivation logic for the activity/audit timeline, kept free of React so it
 * can be unit tested directly (see __tests__/activity-state.test.ts).
 *
 * Source of truth is backend-docs/audit-logs-api.md. Two quirks documented
 * there drive the shape of this module:
 *  - Exception audits are filed under entityType="Exception", not the
 *    invoice/requisition they concern (that's in metadata.entityType /
 *    metadata.entityId) — so a complete per-requisition timeline needs the
 *    exception ids too, not just entityType=Invoice/Requisition/etc.
 *  - A PO-creation failure is filed under entityType="Requisition" even
 *    though it's about the (not-yet-existing) purchase order.
 */

export const AUDIT_ACTOR_TYPES: AuditActorType[] = ["SYSTEM", "AI", "USER"];

export const AUDIT_ENTITY_TYPES: EntityType[] = [
  "Requisition",
  "PurchaseOrder",
  "Shipment",
  "GoodsReceipt",
  "Invoice",
  "Exception",
];

export const AUDIT_ACTIONS: AuditAction[] = [
  "REQUISITION_CREATED",
  "REQUISITION_CLARIFICATION_REQUESTED",
  "REQUIREMENTS_EXTRACTED",
  "SUPPLIERS_DISCOVERED",
  "SUPPLIER_SELECTED",
  "PO_CREATED",
  "PO_APPROVED",
  "PO_REJECTED",
  "SHIPMENT_CREATED",
  "GOODS_RECEIVED",
  "INVOICE_UPLOADED",
  "INVOICE_EXTRACTED",
  "MATCH_STARTED",
  "MATCH_COMPLETED",
  "EXCEPTION_CREATED",
  "EXCEPTION_RESOLVED",
  "PAYMENT_APPROVED",
  "PAYMENT_COMPLETED",
  "WORKFLOW_FAILED",
];

/**
 * Human-readable, sentence-case label for an audit action — the base
 * wording before any metadata-driven refinement (see describeAuditLog).
 * Exhaustive switch with no `default`: adding an AuditAction without adding
 * a case here is a type error.
 */
export function getAuditActionLabel(action: AuditAction): string {
  switch (action) {
    case "REQUISITION_CREATED":
      return "Requisition created";
    case "REQUISITION_CLARIFICATION_REQUESTED":
      return "Clarification requested";
    case "REQUIREMENTS_EXTRACTED":
      return "Requirements extracted";
    case "SUPPLIERS_DISCOVERED":
      return "Supplier discovery completed";
    case "SUPPLIER_SELECTED":
      return "Supplier selected";
    case "PO_CREATED":
      return "Purchase order generated";
    case "PO_APPROVED":
      return "Purchase order approved";
    case "PO_REJECTED":
      return "Purchase order rejected";
    case "SHIPMENT_CREATED":
      return "Shipment created";
    case "GOODS_RECEIVED":
      return "Goods received";
    case "INVOICE_UPLOADED":
      return "Invoice uploaded";
    case "INVOICE_EXTRACTED":
      return "Invoice extracted";
    case "MATCH_STARTED":
      return "Three-way matching started";
    case "MATCH_COMPLETED":
      return "Three-way matching completed";
    case "EXCEPTION_CREATED":
      return "Exception raised";
    case "EXCEPTION_RESOLVED":
      return "Exception resolved";
    case "PAYMENT_APPROVED":
      return "Payment approved";
    case "PAYMENT_COMPLETED":
      return "Payment completed";
    case "WORKFLOW_FAILED":
      return "Workflow failed";
  }
}

/** SYSTEM → "System", AI → "AI", USER → "User". Append log.actorId in the UI when present. */
export function getAuditActorLabel(actorType: AuditActorType): string {
  switch (actorType) {
    case "SYSTEM":
      return "System";
    case "AI":
      return "AI";
    case "USER":
      return "User";
  }
}

export interface AuditLogDescription {
  label: string;
  detail: string | null;
}

/** Compact "key: value · key: value" summary of up to 2 metadata entries. */
function summarizeMetadata(metadata: AuditLog["metadata"]): string | null {
  const entries = Object.entries(metadata ?? {}).filter(
    ([, value]) => value !== undefined && value !== null
  );
  if (entries.length === 0) return null;
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

/**
 * Refines the base action label using documented metadata fields, and
 * derives a secondary detail line. Falls back to the generic label/summary
 * when the expected metadata field isn't present — never asserts an outcome
 * the payload didn't state.
 */
export function describeAuditLog(log: AuditLog): AuditLogDescription {
  if (log.action === "WORKFLOW_FAILED" && typeof log.metadata.stage === "string") {
    return { label: getAuditActionLabel(log.action), detail: `Stage: ${log.metadata.stage}` };
  }

  if (log.action === "EXCEPTION_RESOLVED") {
    const decision = log.metadata.decision;
    if (decision === "APPROVE") {
      return { label: "Exception approved", detail: summarizeMetadata(log.metadata) };
    }
    if (decision === "REJECT") {
      return { label: "Exception rejected", detail: summarizeMetadata(log.metadata) };
    }
  }

  if (log.action === "EXCEPTION_CREATED" && typeof log.metadata.type === "string") {
    return { label: getAuditActionLabel(log.action), detail: `Type: ${log.metadata.type}` };
  }

  return { label: getAuditActionLabel(log.action), detail: summarizeMetadata(log.metadata) };
}

/**
 * Flattens per-entity audit-log pages into one list: dedupes by id, then
 * sorts newest first by createdAt with id as a tiebreaker — mirroring the
 * backend's documented ordering, since several rows written in the same
 * transaction can share a createdAt down to the millisecond.
 */
export function mergeAuditLogs(pages: AuditLog[][]): AuditLog[] {
  const byId = new Map<string, AuditLog>();
  for (const page of pages) {
    for (const log of page) {
      byId.set(log.id, log);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const byCreatedAt = b.createdAt.localeCompare(a.createdAt);
    if (byCreatedAt !== 0) return byCreatedAt;
    return b.id.localeCompare(a.id);
  });
}

export interface ActivityTarget {
  entityType: EntityType;
  entityId: string;
}

export interface ActivityTargetInput {
  requisitionId: string;
  purchaseOrderId?: string | null;
  shipmentIds?: string[];
  goodsReceiptIds?: string[];
  invoiceIds?: string[];
  exceptionIds?: string[];
}

/**
 * Builds the deduped, stable-ordered list of {entityType, entityId} pairs to
 * fan a GET /audit-logs query out over — one call per related entity, since
 * the endpoint only filters a single entityType/entityId pair at a time.
 */
export function collectActivityTargets(input: ActivityTargetInput): ActivityTarget[] {
  const targets: ActivityTarget[] = [{ entityType: "Requisition", entityId: input.requisitionId }];

  if (input.purchaseOrderId) {
    targets.push({ entityType: "PurchaseOrder", entityId: input.purchaseOrderId });
  }
  for (const id of input.shipmentIds ?? []) {
    targets.push({ entityType: "Shipment", entityId: id });
  }
  for (const id of input.goodsReceiptIds ?? []) {
    targets.push({ entityType: "GoodsReceipt", entityId: id });
  }
  for (const id of input.invoiceIds ?? []) {
    targets.push({ entityType: "Invoice", entityId: id });
  }
  for (const id of input.exceptionIds ?? []) {
    targets.push({ entityType: "Exception", entityId: id });
  }

  const seen = new Set<string>();
  return targets.filter((t) => {
    const key = `${t.entityType}:${t.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Poll interval (ms) for the activity timeline's audit-log queries, or
 * `false` to stop. Mirrors getInvoicePollInterval in lib/state/invoice-state.ts.
 *
 * RequisitionStatus alone can't tell us the workflow is done — it stops
 * advancing at "PO_CREATED" even while the PO is later approved, shipped,
 * invoiced and paid — so callers also pass `hasOpenWork`, derived from the
 * purchase order / latest invoice status, for whatever stage is currently
 * downstream of the requisition. There's no Socket.IO event for new audit
 * rows (per backend-docs/audit-logs-api.md), so polling is the only way to
 * keep this live — kept slow (10s) since it's a supplementary view, not the
 * primary workflow-state UI.
 */
export function getActivityPollInterval(
  status: RequisitionStatus,
  hasOpenWork: boolean
): number | false {
  if (status === "FAILED") return false;
  return hasOpenWork ? 10_000 : false;
}
