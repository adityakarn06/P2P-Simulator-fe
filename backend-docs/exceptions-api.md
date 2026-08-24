# Exceptions API Reference (Frontend)

How a client sees why an invoice is stuck, and how a human clears it. See
`architecture/matching-and-payment.md` for the backend design, and `api-docs/invoices-api.md` for the
stage that precedes this.

Conventions (headers, envelope, error codes) are identical to the requisitions API — see
`api-docs/requisitions-api.md`. Every request carries `x-organization-id`.

## The stage in one picture

```text
Invoice EXTRACTED
        │
        ▼  automatic — matching worker (deterministic, no AI)
Invoice APPROVED  ──▶  automatic — payment worker  ──▶  Invoice PAID           (clean match)
        │
        └─▶  Invoice EXCEPTION, Payment BLOCKED, one or more Exceptions OPEN   (mismatch)
                        │
                        ▼
             GET /exceptions?entityId={invoiceId}      list what's blocking it
             GET /exceptions/:id                        read one in full
                        │
                        ▼
             POST /exceptions/:id/resolve  { decision: "APPROVE" | "REJECT", reason }
                        │
                        ├─ REJECT, or other exceptions on the invoice still open
                        │        → exception closed, invoice stays EXCEPTION
                        │
                        └─ APPROVE and this was the last open exception on the invoice
                                 → Invoice EXCEPTION → APPROVED
                                 → automatic — payment worker → Invoice PAID
```

There is currently **no dedicated endpoint for reading `ThreeWayMatch`/`MatchCheck` or `Payment` rows**
— see [Not yet available](#not-yet-available). The exception's own `description` and `metadata.checks`
are the only place the specific check failures (expected vs. actual values) are exposed today. Drive
the "why is this invoice stuck" screen from the exceptions list, and drive "is this invoice paid yet"
from `GET /invoices/:id`'s `status` field.

## `Invoice.status` values this stage introduces

Building on the table in `api-docs/invoices-api.md`:

| `status` | Meaning | What the client shows |
| --- | --- | --- |
| `MATCHING` | Three-way matching is running | spinner — transient, usually resolves in well under a second since there's no AI call in this stage |
| `APPROVED` | Match passed (or a human overrode a mismatch) | payment is queued automatically; poll a little longer for `PAID` |
| `EXCEPTION` | Match failed, one or more exceptions are open | fetch `GET /exceptions?entityId={invoiceId}` and render them; payment is blocked |
| `PAID` | Settled | terminal, success state |

`FAILED` (extraction failure) is unrelated to this stage — see `api-docs/invoices-api.md`.

## GET /api/v1/exceptions

Cursor-paginated list, newest first. This is the primary read for "what needs my attention" — an
exceptions inbox screen should poll this with no filters, or `status=OPEN` to hide already-decided
ones.

| Query param | Default | Notes |
| --- | --- | --- |
| `status` | — | `OPEN` \| `UNDER_REVIEW` \| `RESOLVED` \| `REJECTED` |
| `type` | — | See [Exception types](#exception-types) below |
| `entityId` | — | Scope to one entity — e.g. all exceptions blocking one invoice |
| `limit` | `20` | Max `100` |
| `cursor` | — | The `nextCursor` from the previous page |

```json
{
  "success": true,
  "data": {
    "exceptions": [
      {
        "id": "exc_abc123",
        "organizationId": "org_dev",
        "type": "QUANTITY_MISMATCH",
        "status": "OPEN",
        "severity": "CRITICAL",
        "entityType": "Invoice",
        "entityId": "inv_abc123",
        "title": "Three-way match failed: quantity mismatch",
        "description": "INVOICED_QUANTITY: expected Wireless Keyboard: 96, got Wireless Keyboard: 100",
        "metadata": {
          "checks": [
            {
              "checkType": "INVOICED_QUANTITY",
              "expected": "Wireless Keyboard: 96",
              "actual": "Wireless Keyboard: 100",
              "variance": 4
            }
          ]
        },
        "resolution": null,
        "resolutionReason": null,
        "resolvedAt": null,
        "resolvedBy": null,
        "createdAt": "2026-08-26T11:05:00.000Z",
        "updatedAt": "2026-08-26T11:05:00.000Z"
      }
    ],
    "nextCursor": null
  },
  "error": null
}
```

`nextCursor` is `null` on the last page.

## GET /api/v1/exceptions/:id

The same shape as one entry above, unwrapped:

```json
{
  "success": true,
  "data": {
    "exception": { "id": "exc_abc123", "...": "" }
  },
  "error": null
}
```

An exception belonging to another organization is a `404`.

## POST /api/v1/exceptions/:id/resolve

The only mutation in this API. Records a human's decision.

```json
{
  "decision": "APPROVE",
  "reason": "Supplier confirmed the remaining 4 units ship next week; approving payment for what arrived."
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `decision` | `"APPROVE"` \| `"REJECT"` | Required |
| `reason` | string | Required, 10–1000 characters. This is a financial judgement — the backend refuses a resolution with no real explanation (CLAUDE.md: "Every resolution needs a reason and AuditLog") |

```js
await fetch(`/api/v1/exceptions/${exceptionId}/resolve`, {
  method: "POST",
  headers: { "x-organization-id": orgId, "Content-Type": "application/json" },
  body: JSON.stringify({ decision: "APPROVE", reason }),
});
```

Response — `200`:

```json
{
  "success": true,
  "data": {
    "exception": {
      "id": "exc_abc123",
      "status": "RESOLVED",
      "resolution": "APPROVE",
      "resolutionReason": "Supplier confirmed the remaining 4 units ship next week; approving payment for what arrived.",
      "resolvedAt": "2026-08-26T12:00:00.000Z",
      "resolvedBy": "user_dev",
      "...": ""
    },
    "releasedForPayment": true
  },
  "error": null
}
```

### Reading `releasedForPayment`

This is the field to branch on for UI feedback, and it means something specific:

- **`true`** only when `decision: "APPROVE"` **and** this was the *last* exception still open against
  the invoice. The invoice has just moved `EXCEPTION → APPROVED` and payment has been queued
  automatically — show "approved, payment processing" and start (or keep) polling
  `GET /invoices/:id` for `PAID`.
- **`false`** in every other case: a `REJECT`, or an `APPROVE` on an invoice that still has other
  exceptions open. **An invoice can have more than one exception** (e.g. both a quantity and a price
  mismatch) — approving one does not release the invoice, and the correct UI is to keep the invoice's
  remaining open exceptions visible rather than treating this response as final. Refetch
  `GET /exceptions?entityId={invoiceId}&status=OPEN` after every resolution to know what's left.

`decision: "REJECT"` always closes the exception (`status: "REJECTED"`) without releasing anything —
the invoice stays `EXCEPTION` and payment stays blocked. There is no separate endpoint to re-open a
rejected exception or retry matching; a rejected mismatch is a terminal human call for that invoice in
this MVP.

### Resolving an already-decided exception

An exception's `status` is terminal once it leaves `OPEN`/`UNDER_REVIEW` — resolving it again is a
`409 INVALID_STATE`. Disable the resolve UI once `status` is `RESOLVED` or `REJECTED`.

## Exception types

The `type` field on every exception. Not all of these originate from this stage — some are opened
earlier in the pipeline and are only reachable through this API now that it exists.

| `type` | Raised by | `entityType` / `entityId` |
| --- | --- | --- |
| `NO_SUPPLIER_FOUND` | Supplier discovery, when no supplier is eligible | `Requisition` |
| `INVOICE_EXTRACTION_FAILED` | Invoice worker, after 3 failed Gemini Vision attempts | `Invoice` |
| `QUANTITY_MISMATCH` | Matching — `ORDERED_QUANTITY`, `RECEIVED_QUANTITY`, or `INVOICED_QUANTITY` check failed | `Invoice` |
| `PRICE_MISMATCH` | Matching — `UNIT_PRICE` or `SUBTOTAL` check failed | `Invoice` |
| `SUPPLIER_MISMATCH` | Matching — invoice's stated supplier doesn't match the PO's | `Invoice` |
| `DUPLICATE_INVOICE` | Matching — invoice number already recorded for this org | `Invoice` |
| `TAX_MISMATCH` | Matching — `TAX` check failed | `Invoice` |
| `TOTAL_MISMATCH` | Matching — `TOTAL` or `CURRENCY` check failed | `Invoice` |
| `PAYMENT_FAILURE` | Payment worker, after 3 failed provider attempts | `Invoice` |
| `SYSTEM_FAILURE` | Either worker, after 3 failed *technical* (non-business) attempts, or an unmapped check | `Invoice` (or `Requisition`) |
| `REQUIREMENT_INCOMPLETE`, `PO_APPROVAL_REQUIRED` | Reserved — not currently raised by any worker | — |

An invoice can accumulate several exceptions at once (one per distinct failing check group — see
`architecture/matching-and-payment.md`), so always filter/group by `entityId` rather than assuming one
exception per invoice.

`metadata.checks` (present on matching-originated exceptions) carries the raw `MatchCheckResult` rows
that were grouped into this exception — `checkType`, `expected`, `actual`, `variance` — useful for a
detail view that wants to show the specific numbers rather than just the prose `description`.

## Errors

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `decision` missing/invalid, or `reason` under 10 or over 1000 characters |
| 404 | `NOT_FOUND` | Unknown exception, or one owned by another organization |
| 409 | `INVALID_STATE` | Exception is already `RESOLVED` or `REJECTED` |

## Not yet available

- No `GET /payments` or `GET /payments/:id` — a payment's progress is only visible indirectly through
  `Invoice.status` (`APPROVED` → processing, `PAID` → settled). There is no way today to fetch
  `providerReference`, `blockedReason`, or `failureReason` directly.
- No `GET` endpoint for `ThreeWayMatch`/`MatchCheck` — the full 12-check breakdown of a *passing*
  match is not exposed anywhere; only failed checks surface, via the exception's `metadata.checks`.
- No Socket.IO events (`exception.created`, `exception.resolved`, `payment.completed`, etc.) — poll
  `GET /invoices/:id` for status and `GET /exceptions?entityId=...&status=OPEN` for what's blocking it.
- `GET /audit-logs` does not exist — `EXCEPTION_RESOLVED`/`PAYMENT_APPROVED`/`PAYMENT_COMPLETED` audit
  rows are written but not queryable.
- No bulk-resolve. Each exception is resolved individually, even when several were opened by the same
  mismatch.
