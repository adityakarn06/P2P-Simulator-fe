import { z } from "zod";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  Shipment,
  ShipmentStatus,
  GoodsReceipt,
} from "@/types/models";
import type { SimulateReceiptFlatBody } from "@/lib/api/receipts";
import { ApiError } from "@/types/api";

/**
 * All derivation logic for the shipment / goods-receipt UI lives here, kept
 * free of React so it can be unit tested directly (see
 * __tests__/shipment-state.test.ts).
 *
 * Source of truth for the shipment itself is GET /shipments/:id — see
 * backend-docs/receipts-api.md. Status is never mutated client-side; every
 * flag here is derived from server-provided data.
 */

export const IN_TRANSIT_MESSAGE = "Shipment is in transit";

/**
 * The shipment section renders once a shipment exists — i.e. from the moment
 * the PO is approved onward, through delivery and beyond (RECEIVED/COMPLETED
 * still have a shipment + receipt worth showing).
 */
export function shouldShowShipmentSection(po: Pick<PurchaseOrder, "status">): boolean {
  return (
    po.status === "APPROVED" ||
    po.status === "SHIPPED" ||
    po.status === "RECEIVED" ||
    po.status === "COMPLETED"
  );
}

export function isInTransit(s: Pick<Shipment, "status">): boolean {
  return s.status === "IN_TRANSIT";
}

export function isDelivered(s: Pick<Shipment, "status">): boolean {
  return s.status === "DELIVERED";
}

/**
 * The MVP flat payload (backend-docs/receipts-api.md) only works for
 * single-line purchase orders — the backend 400s otherwise
 * (VALIDATION_ERROR: "flat form on a multi-line purchase order"). Guard the
 * button rather than round-tripping a guaranteed failure.
 */
export function canSimulateDelivery(flags: {
  shipmentStatus: ShipmentStatus;
  hasGoodsReceipt: boolean;
  poItemCount: number;
}): boolean {
  return (
    flags.shipmentStatus === "IN_TRANSIT" &&
    !flags.hasGoodsReceipt &&
    flags.poItemCount === 1
  );
}

/** Mirrors backend-docs/receipts-api.md quantity rules for the flat (single-line) form. */
export function buildReceiptFormSchema(orderedQuantity: number) {
  return z
    .object({
      receivedQuantity: z
        .number()
        .int("Must be a whole number.")
        .gt(0, "Received quantity must be greater than 0."),
      damagedQuantity: z
        .number()
        .int("Must be a whole number.")
        .min(0, "Damaged quantity cannot be negative."),
      notes: z.string().trim().max(500, "Notes must be 500 characters or fewer.").optional(),
    })
    .refine((v) => v.damagedQuantity <= v.receivedQuantity, {
      message: "Damaged quantity cannot exceed received quantity.",
      path: ["damagedQuantity"],
    })
    .refine((v) => v.receivedQuantity <= orderedQuantity, {
      message: `Received quantity cannot exceed the ordered quantity (${orderedQuantity}).`,
      path: ["receivedQuantity"],
    });
}

export interface ReceiptFormValues {
  receivedQuantity: number;
  damagedQuantity: number;
  notes?: string;
}

export type ReceiptFormResult =
  | { ok: true; values: ReceiptFormValues }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates the raw (string) form fields against the flat-form rules —
 * receivedQuantity > 0, damagedQuantity >= 0, damagedQuantity <= receivedQuantity,
 * receivedQuantity <= orderedQuantity — per backend-docs/receipts-api.md.
 */
export function validateReceiptForm(
  raw: { receivedQuantity: string; damagedQuantity: string; notes: string },
  orderedQuantity: number
): ReceiptFormResult {
  const receivedQuantity = Number(raw.receivedQuantity);
  const damagedQuantity = raw.damagedQuantity.trim() === "" ? 0 : Number(raw.damagedQuantity);

  const errors: Record<string, string> = {};
  if (raw.receivedQuantity.trim() === "" || Number.isNaN(receivedQuantity)) {
    errors.receivedQuantity = "Received quantity is required.";
  }
  if (Number.isNaN(damagedQuantity)) {
    errors.damagedQuantity = "Damaged quantity must be a number.";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const schema = buildReceiptFormSchema(orderedQuantity);
  const result = schema.safeParse({
    receivedQuantity,
    damagedQuantity,
    notes: raw.notes,
  });

  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "form";
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, errors: fieldErrors };
  }

  const trimmedNotes = result.data.notes?.trim();
  return {
    ok: true,
    values: {
      receivedQuantity: result.data.receivedQuantity,
      damagedQuantity: result.data.damagedQuantity,
      notes: trimmedNotes ? trimmedNotes : undefined,
    },
  };
}

/** Builds the flat POST /receipts/simulate body for a single-line purchase order. */
export function buildFlatReceiptBody(
  shipmentId: string,
  values: ReceiptFormValues
): SimulateReceiptFlatBody {
  return {
    shipmentId,
    receivedQuantity: values.receivedQuantity,
    damagedQuantity: values.damagedQuantity,
    ...(values.notes ? { notes: values.notes } : {}),
  };
}

export interface ReceiptRow {
  description: string;
  ordered: number;
  received: number;
  damaged: number;
  accepted: number;
}

/**
 * Ordered/Received/Damaged/Accepted rows for display. `accepted` is always
 * read from the backend's `acceptedQuantity` — three-way matching compares
 * against this value, so the frontend must never recompute it
 * (backend-docs/receipts-api.md).
 */
export function deriveReceiptRows(
  goodsReceipt: Pick<GoodsReceipt, "items">,
  poItems: Pick<PurchaseOrderItem, "id" | "description" | "productId">[]
): ReceiptRow[] {
  return goodsReceipt.items.map((item) => {
    const poItem = poItems.find((p) => p.id === item.purchaseOrderItemId);
    return {
      description: poItem?.description ?? item.productId,
      ordered: item.orderedQuantity,
      received: item.receivedQuantity,
      damaged: item.damagedQuantity,
      accepted: item.acceptedQuantity,
    };
  });
}

export interface ReceiptConflict {
  recorded: unknown;
  submitted: unknown;
}

/**
 * Structural parse of a 409 CONFLICT's error.details for the
 * recorded-vs-submitted panel (backend-docs/receipts-api.md: "`details`
 * carries `recorded` vs `submitted`"). Returns null on any unexpected shape
 * so the UI can fall back to the plain error message rather than crash.
 */
export function parseReceiptConflict(details: unknown): ReceiptConflict | null {
  if (typeof details !== "object" || details === null) return null;
  if (!("recorded" in details) || !("submitted" in details)) return null;
  const d = details as { recorded: unknown; submitted: unknown };
  return { recorded: d.recorded, submitted: d.submitted };
}

/**
 * True only for the replay-mismatch conflict (409 CONFLICT), not the
 * broader "wrong state" conflict (409 INVALID_STATE) — ApiError.isConflict
 * lumps both together, which is too coarse for routing the CONFLICT panel.
 *
 * Deliberately not a type predicate: callers usually already have `e`
 * narrowed to `ApiError` from an outer `instanceof` check, and a same-type
 * predicate there narrows the negative branch to `never` instead of leaving
 * it as `ApiError`.
 */
export function isQuantityConflict(e: unknown): boolean {
  return e instanceof ApiError && e.code === "CONFLICT";
}
