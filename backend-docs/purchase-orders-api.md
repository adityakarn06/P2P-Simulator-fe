# Purchase Orders API Reference (Frontend)

How a client sees the purchase order that is generated once a supplier has been selected, and how
it approves or rejects it. See `architecture/purchase-orders.md` for the backend design, and
`api-docs/sourcing-api.md` for the stage that precedes this.

Conventions (headers, envelope, error codes) are identical to the requisitions API — see
`api-docs/requisitions-api.md`. Every request carries `x-organization-id`.

## The stage in one picture

```text
supplier-discovery worker   ──▶ requisition SUPPLIER_SELECTED
        │
        ▼  (automatic, no client call)
purchase-order worker       ──▶ requisition PO_CREATED, PO PENDING_APPROVAL
                            └─▶ requisition FAILED (supplier can no longer fulfil the order)
        │
        ▼
GET /requisitions/:id       ──▶ purchaseOrder.status === "PENDING_APPROVAL"
        │
        ├──▶ POST /purchase-orders/:id/approve  ──▶ PO APPROVED + shipment IN_TRANSIT
        └──▶ POST /purchase-orders/:id/reject   ──▶ PO REJECTED, requisition FAILED
```

The client never triggers generation. Poll `GET /requisitions/:id` after `SUPPLIER_SELECTED` until
`purchaseOrder` is non-null.

## Reading the purchase order from the requisition

`GET /api/v1/requisitions/:id` now includes a top-level `purchaseOrder` key — `null` until the
worker has run. **No second request is needed to decide whether approval is required.**

```json
{
  "success": true,
  "data": {
    "id": "req_abc123",
    "status": "PO_CREATED",
    "sourcing": { "...": "unchanged" },
    "purchaseOrder": {
      "id": "po_xyz789",
      "poNumber": "PO-20260824-ABC123",
      "status": "PENDING_APPROVAL",
      "requisitionId": "req_abc123",
      "supplierId": "sup_techsource",
      "supplier": { "id": "sup_techsource", "name": "TechSource Distributors" },
      "subtotalPaise": 18200000,
      "taxPaise": 3276000,
      "totalPaise": 21476000,
      "taxRateBps": 1800,
      "currency": "INR",
      "expectedDeliveryDate": "2026-08-29T00:00:00.000Z",
      "approvedAt": null,
      "approvedBy": null,
      "rejectedAt": null,
      "rejectionReason": null,
      "items": [
        {
          "id": "poi_1",
          "productId": "prod_wireless_keyboard",
          "supplierProductId": "sp_keyboard_techsource",
          "description": "Wireless Keyboard (PRPH-KB-001)",
          "quantity": 100,
          "unitPricePaise": 182000,
          "lineTotalPaise": 18200000
        }
      ]
    }
  },
  "error": null
}
```

Render the approval prompt from `purchaseOrder.status === "PENDING_APPROVAL"`:

> Purchase order generated. Continue to approve?

All amounts are **integer paise**. Divide by 100 for display; never do money arithmetic in floats.

## Status lifecycle

| `purchaseOrder.status` | What the client should show |
| --- | --- |
| `PENDING_APPROVAL` | "Purchase Order generated and waiting for approval." + Approve / Reject |
| `APPROVED` | Approved — show the shipment, which is `IN_TRANSIT` |
| `REJECTED` | Rejected — show `rejectionReason`; the requisition is `FAILED` |

For the MVP every purchase order is created `PENDING_APPROVAL`, regardless of value.

## POST /api/v1/purchase-orders/:id/approve

No body.

```json
{
  "success": true,
  "data": {
    "purchaseOrder": { "status": "APPROVED", "approvedAt": "...", "approvedBy": "dev-user", "...": "" },
    "shipment": {
      "id": "ship_1",
      "purchaseOrderId": "po_xyz789",
      "trackingNumber": "TRK-PO_XYZ789",
      "status": "IN_TRANSIT",
      "shippedAt": "2026-08-24T10:00:00.000Z",
      "expectedDeliveryDate": "2026-08-29T00:00:00.000Z"
    }
  },
  "error": null
}
```

**Idempotent.** Calling it twice returns the same purchase order and the *same* shipment — no
second shipment is created, and no duplicate audit rows are written. Safe to retry on a timeout.

| Situation | Status | `error.code` |
| --- | --- | --- |
| Unknown id, or another organization's PO | 404 | `NOT_FOUND` |
| Already `APPROVED` | 200 | — (idempotent success) |
| Already `REJECTED` | 409 | `INVALID_STATE` |
| Still `DRAFT`, or already `SHIPPED`/`RECEIVED`/`COMPLETED` | 409 | `INVALID_STATE` |

## POST /api/v1/purchase-orders/:id/reject

```json
{ "reason": "Price is too high" }
```

`reason` is **required** (1–500 characters). It is written to the audit trail, stored verbatim on
`purchaseOrder.rejectionReason`, and written to the requisition's `failureReason` prefixed with
`Purchase order rejected: `.

```json
{
  "success": true,
  "data": {
    "purchaseOrder": { "status": "REJECTED", "rejectedAt": "...", "rejectionReason": "Price is too high" },
    "shipment": null
  },
  "error": null
}
```

Rejection creates **no shipment** and starts no downstream work. The requisition becomes `FAILED`
with `failureReason: "Purchase order rejected: <reason>"`.

| Situation | Status | `error.code` |
| --- | --- | --- |
| Missing/empty `reason` | 400 | `VALIDATION_ERROR` |
| Unknown id, or another organization's PO | 404 | `NOT_FOUND` |
| Already `REJECTED` | 200 | — (idempotent success) |
| Already `APPROVED` | 409 | `INVALID_STATE` |

## GET /api/v1/purchase-orders/:id

Returns `{ "purchaseOrder": {...}, "shipment": {...} | null }` — the same shapes as above.

## GET /api/v1/purchase-orders

Query: `status` (any `PurchaseOrderStatus`), `limit` (1–100, default 20), `cursor`.

```json
{ "success": true, "data": { "items": [ { "...": "purchase order" } ], "nextCursor": null }, "error": null }
```

Newest first. Pass `nextCursor` back as `cursor` for the following page.
