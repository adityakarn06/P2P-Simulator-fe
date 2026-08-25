# Audit Log API Reference (Frontend)

The cross-stage event trail. Every important workflow transition — requisition creation, requirement
extraction, supplier selection, PO creation/approval/rejection, shipment/receipt, invoice
upload/extraction, matching, exception create/resolve, payment approval/completion, and technical
failures — writes one immutable row here. This is the one endpoint that reads across every stage at
once, useful for an "activity log" or "what happened to this record" screen.

Conventions (headers, envelope, error codes) are identical to the requisitions API — see
`api-docs/requisitions-api.md`. Every request carries `x-organization-id`.

Audit rows are **read-only through this API**. There is no create, update, or delete endpoint —
`POST`/`PATCH`/`DELETE /audit-logs` all 404. The only writer is internal: `recordAudit()`, called by
services in the same transaction as the state change it describes.

## GET /api/v1/audit-logs

Cursor-paginated list, newest first.

| Query param | Default | Notes |
| --- | --- | --- |
| `action` | — | One `AuditAction` value — see [Actions](#actions) below |
| `actorType` | — | `SYSTEM` \| `AI` \| `USER` — filter to what a human did vs. what a worker or Gemini did |
| `entityType` | — | `Requisition` \| `PurchaseOrder` \| `Shipment` \| `GoodsReceipt` \| `Invoice` \| `Exception` |
| `entityId` | — | Scope to one record's timeline — pair with `entityType` for an exact match |
| `limit` | `20` | Max `100` |
| `cursor` | — | The `nextCursor` from the previous page |

Pages are ordered newest-first by `createdAt`, with `id` as a tiebreaker — several audits are often
written inside one transaction (e.g. `EXCEPTION_RESOLVED` followed by `PAYMENT_APPROVED`) and share a
`createdAt` down to the millisecond, so a page boundary landing inside a tie can never skip or repeat
a row.

```json
{
  "success": true,
  "data": {
    "auditLogs": [
      {
        "id": "aud_abc123",
        "organizationId": "org_dev",
        "actorType": "SYSTEM",
        "actorId": null,
        "action": "PAYMENT_COMPLETED",
        "entityType": "Invoice",
        "entityId": "inv_abc123",
        "metadata": { "providerReference": "sim_9f2c1" },
        "createdAt": "2026-08-26T12:03:00.000Z"
      }
    ],
    "nextCursor": null
  },
  "error": null
}
```

`nextCursor` is `null` on the last page. `actorId` is `null` for `SYSTEM`/`AI`-attributed rows and set
to a user id for `USER`-attributed ones (PO approval/rejection, exception resolution, invoice upload).

## Two entity-targeting quirks to know before filtering

- **Exception audits are filed under `Exception`, not the entity they're about.**
  `EXCEPTION_CREATED` and `EXCEPTION_RESOLVED` use `entityType: "Exception"` / `entityId: <exceptionId>`
  — the invoice or requisition the exception concerns is only in `metadata.entityType` /
  `metadata.entityId`. So `?entityType=Invoice&entityId=inv_x` returns that invoice's
  upload/extract/match/payment rows but **not** its exceptions. Pair it with
  `GET /exceptions?entityId=inv_x` (see `api-docs/exceptions-api.md`) for a complete picture.
- **A PO-creation failure is filed under `Requisition`, not `PurchaseOrder`.** If PO generation fails
  after sourcing succeeded, the purchase order row may not exist yet — so that `WORKFLOW_FAILED` audit
  targets the requisition instead. A `?entityType=PurchaseOrder` timeline only shows what happened
  *after* the PO was created.

## Actions

| `action` | `entityType` | Raised when |
| --- | --- | --- |
| `REQUISITION_CREATED` | `Requisition` | `POST /requisitions` |
| `REQUISITION_CLARIFICATION_REQUESTED` | `Requisition` | A chat turn left requirements incomplete — either Gemini asked, or the system degraded to a fallback clarification after exhausting retries |
| `REQUIREMENTS_EXTRACTED` | `Requisition` | A chat turn completed all required fields |
| `SUPPLIERS_DISCOVERED` | `Requisition` | Supplier-discovery worker ranked eligible suppliers |
| `SUPPLIER_SELECTED` | `Requisition` | Top-ranked supplier chosen |
| `PO_CREATED` | `PurchaseOrder` | Purchase order generated from the sourcing decision |
| `PO_APPROVED` | `PurchaseOrder` | Auto-approved (< ₹1,00,000) or `POST /purchase-orders/:id/approve` |
| `PO_REJECTED` | `PurchaseOrder` | `POST /purchase-orders/:id/reject` |
| `SHIPMENT_CREATED` | `Shipment` | Written alongside `PO_APPROVED` — approval immediately puts the PO in transit |
| `GOODS_RECEIVED` | `GoodsReceipt` | `POST /receipts/simulate` |
| `INVOICE_UPLOADED` | `Invoice` | `POST /invoices` |
| `INVOICE_EXTRACTED` | `Invoice` | Invoice worker's Gemini Vision extraction succeeded |
| `MATCH_STARTED` | `Invoice` | Matching worker picked up an extracted invoice |
| `MATCH_COMPLETED` | `Invoice` | Three-way match ran to a `MATCHED`/`MISMATCHED` verdict |
| `EXCEPTION_CREATED` | `Exception` | Any mismatch or failure opened a new exception (see quirk above) |
| `EXCEPTION_RESOLVED` | `Exception` | `POST /exceptions/:id/resolve` |
| `PAYMENT_APPROVED` | `Invoice` | Match passed, or a human override released a blocked payment |
| `PAYMENT_COMPLETED` | `Invoice` | Simulated payment settled |
| `WORKFLOW_FAILED` | Varies — see quirk above | A stage exhausted its retries on a technical failure. `metadata.stage` names which one: `"requisition"`, `"supplier-discovery"`, `"purchase-order"`, `"invoice-extraction"`, `"matching"`, or `"payment"` |

## Errors

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Unknown `action`/`actorType`/`entityType`, or `limit` outside `1`–`100` |
| 404 | `NOT_FOUND` | Any method/path other than `GET /audit-logs` on this resource |

## Not yet available

- No `GET /audit-logs/:id` — the list is the only read; there is no single-row detail route.
- No write, update, or delete endpoint — audit rows are immutable through the API by design.
- No Socket.IO events for new audit rows — poll if you need a live activity feed.
