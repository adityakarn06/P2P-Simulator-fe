# P2P Simulator API — Frontend Overview

Start here. This doc ties together the per-stage references below into one whole-flow picture, so
you can build the demo UI without having to read backend code. Base path for every endpoint below
is `/api/v1` (e.g. `POST /api/v1/requisitions`).

| Stage | Doc | Endpoints it covers |
| --- | --- | --- |
| 1. Requisition intake (chat) | [`requisitions-api.md`](./requisitions-api.md) | `POST /requisitions`, `POST /requisitions/:id/messages`, `GET /requisitions/:id`, `GET /requisitions` |
| 2. Supplier discovery | [`sourcing-api.md`](./sourcing-api.md) | none — read through `GET /requisitions/:id` |
| 3. Purchase order | [`purchase-orders-api.md`](./purchase-orders-api.md) | `POST /purchase-orders/:id/approve`, `POST /purchase-orders/:id/reject`, `GET /purchase-orders/:id`, `GET /purchase-orders` |
| 4. Shipment & goods receipt | [`receipts-api.md`](./receipts-api.md) | `GET /shipments/:id`, `POST /receipts/simulate` |
| 5. Invoice upload & extraction | [`invoices-api.md`](./invoices-api.md) | `POST /invoices`, `GET /invoices/:id`, `GET /invoices` |
| 6. Matching, payment, exceptions | **not implemented yet** | see [Not yet available](#not-yet-available) |

## The whole flow, end to end

```text
1. Chat                POST /requisitions            (repeat POST .../messages until requirements
                        └─▶ REQUIREMENTS_EXTRACTED         are complete — this is a multi-turn form)
        │
        ▼ automatic — supplier-discovery worker
2. Sourcing             GET /requisitions/:id         poll until status leaves REQUIREMENTS_EXTRACTED
                        └─▶ SUPPLIER_SELECTED  (sourcing + supplierCandidates populated)
                        └─▶ FAILED             (no eligible supplier — terminal)
        │
        ▼ automatic — purchase-order worker
3. Purchase Order       GET /requisitions.purchaseOrder   PENDING_APPROVAL
        │
        ├─▶ POST /purchase-orders/:id/approve  ──▶ APPROVED, shipment IN_TRANSIT
        └─▶ POST /purchase-orders/:id/reject   ──▶ REJECTED, requisition FAILED (terminal)
        │
        ▼
4. Shipment              GET /shipments/:id       status IN_TRANSIT, goodsReceipt null
        │
        ▼
   Goods Receipt          POST /receipts/simulate  shipment DELIVERED, PO RECEIVED
        │
        ▼
5. Invoice               POST /invoices           multipart upload → 202, status UPLOADED
        │
        ▼ automatic — invoice worker (Gemini Vision)
                         GET /invoices/:id        poll until status leaves UPLOADED/PROCESSING
                         └─▶ EXTRACTED     fields + line items populated
                         └─▶ FAILED        extraction gave up (terminal)
        │
        ▼
6. Match → Pay           NOT IMPLEMENTED — see below
```

Every stage after the initial `POST /requisitions` call is either:
- **a client action** (approve/reject a PO, simulate a receipt), or
- **automatic** — a background worker runs and you find out by polling `GET /requisitions/:id`.

**`GET /requisitions/:id` is the one screen that shows the whole pipeline.** It accumulates fields
as the requisition progresses — `requirement`, then `sourcing` + `supplierCandidates`, then
`purchaseOrder` — so a single poll loop against that endpoint can drive most of the UI. Only switch
to `GET /shipments/:id` once a purchase order is `APPROVED`.

## Conventions (apply to every endpoint)

- **Base path:** `/api/v1`.
- **Tenant header:** every request must carry `x-organization-id`. There is no auth yet (hackathon
  MVP) — this header is trusted as-is, and falls back to a dev org if omitted.
- **Response envelope**, always:
  ```ts
  { "success": true,  "data": T,     "error": null }
  { "success": false, "data": null,  "error": { "code": string, "message": string, "details"?: unknown } }
  ```
  Branch on `success`, not on HTTP status alone — several *business* outcomes (e.g. sourcing
  `FAILED`, a rejected PO) are `200`/`success: true` responses, not errors.
- **Money is always integer minor units (paise).** Never floats. Divide by 100 to display:
  `182000` → `₹1,820.00`.
- **Timestamps** are ISO 8601 strings.
- **Error codes** you'll see across every stage: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401),
  `NOT_FOUND` (404), `INVALID_STATE` / `CONFLICT` (409), `DEPENDENCY_UNAVAILABLE` (503),
  `INTERNAL_ERROR` (500). Each per-stage doc lists the specific triggers for its endpoints.
- **Polling, not sockets.** Realtime (Socket.IO) is planned but not implemented — every
  automatic/worker-driven transition is observed by polling `GET /requisitions/:id` (or
  `GET /shipments/:id` post-approval, or `GET /invoices/:id` once an invoice is uploaded) every ~1s,
  with a "still working" UI state rather than a hard timeout error.
- **Cross-tenant access is always a 404**, never a 403 or a leaked record — don't rely on `error.code`
  to distinguish "doesn't exist" from "not yours."

## `Requisition.status` — the master state machine

This single enum on the requisition is the backbone of the whole UI. Drive top-level screen state
from it:

| `status` | Meaning | What the client shows |
| --- | --- | --- |
| `CREATED` | Just created, extraction not yet run | brief loading state |
| `PROCESSING` | A chat turn is being extracted, or downstream work just got queued | spinner |
| `NEEDS_CLARIFICATION` | Requirements incomplete | render `clarificationMessage`, keep the chat composer open |
| `REQUIREMENTS_EXTRACTED` | Requirements complete, sourcing running | spinner — **transient, not a resting state** |
| `SUPPLIER_SELECTED` | Sourcing done | render `sourcing` + `supplierCandidates` (see sourcing doc) |
| `PO_CREATED` | Purchase order generated | render `purchaseOrder` (see purchase-orders doc); may still be `PENDING_APPROVAL`, `APPROVED`, or later |
| `FAILED` | Terminal failure at any stage | render `failureReason`; start a new requisition — this one no longer accepts messages |

Note the requisition's `status` does **not** advance past `PO_CREATED` for shipment/receipt — those
are tracked on `purchaseOrder.status` and the `shipment`/`goodsReceipt` objects instead. Keep
watching those once you're in `PO_CREATED`.

## Suggested frontend build order

1. **Requisition chat.** `POST /requisitions`, then `POST /requisitions/:id/messages` in a loop
   while `status === "NEEDS_CLARIFICATION"`. This alone exercises stage 1 end to end.
2. **Poll-and-render `GET /requisitions/:id`.** Build a single detail screen that switches on
   `status` and progressively reveals `sourcing` → `purchaseOrder`. This is most of the app.
3. **PO approve/reject buttons**, wired to `purchaseOrder.status === "PENDING_APPROVAL"`.
4. **Shipment/receipt screen.** `GET /shipments/:id`, with a "Simulate delivery" form posting to
   `/receipts/simulate`.
5. **Invoice upload.** A file picker posting `multipart/form-data` to `/invoices`, then a poll on
   `GET /invoices/:id` until `status` is `EXTRACTED` or `FAILED` — the same poll-and-reveal pattern
   as step 2. On `FAILED`, stop polling and surface `failureReason` instead of retrying the poll.
6. Stop here until matching/payment/exceptions ship — see below.

## Not yet available

Do not build against these — they will 404 or don't exist:

- Three-way matching, `ThreeWayMatch`/`MatchCheck` endpoints. Invoice extraction *is* built, but
  the matching queue has no consumer, so an invoice rests at `EXTRACTED` and never reaches
  `MATCHING`/`APPROVED`/`PAID`
- Payments (`Payment` is simulated but has no worker/queue consumer wired up yet)
- `GET /exceptions`, `GET /exceptions/:id`, `POST /exceptions/:id/resolve` — `NO_SUPPLIER_FOUND` and
  `INVOICE_EXTRACTION_FAILED` exception rows are written today, but they're only reachable via
  `requisition.failureReason` / `invoice.failureReason`, not a dedicated endpoint
- `GET /suppliers`, `GET /suppliers/:id`
- `GET /audit-logs`
- Socket.IO realtime events — polling is the only mechanism today

When these land, this table and the per-stage docs will be updated — check back before building
against them.
