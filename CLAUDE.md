@AGENTS.md

# CLAUDE.md

## P2P Procurement Frontend

Build the frontend for the P2P Procurement Simulator hackathon.

### Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form + Zod where useful
- Lucide React
- Zustand (if required)

Do not add Redux, Socket.IO, GraphQL, or authentication unless explicitly required.

## Architecture

```text
├── app/
├── components/
├── features/
│   ├── requisitions/
│   ├── sourcing/
│   ├── purchase-orders/
│   ├── shipments/
│   ├── receipts/
│   ├── invoices/
│   └── exceptions/
├── hooks/
├── lib/api/
├── providers/
└── types/
```

Use feature-based organization. Keep API calls out of UI components.

## API Rules

Backend base URL: `NEXT_PUBLIC_API_URL`

Every request must include `x-organization-id`.

Responses use:

```ts
{ success: true, data: T, error: null }
{ success: false, data: null, error: { code, message, details? } }
```

Always check `success`.

Money is integer paise. Never use floating-point money arithmetic.

Use TanStack Query for all server state. Use `refetchInterval` for worker-driven states. Do not use Socket.IO or custom polling loops.

Never invent undocumented endpoints or response fields.

## Main Workflow

Primary screen: `/requisitions/[id]`

```text
Request → Requirements → Supplier Discovery → Purchase Order
→ Approval → Shipment → Goods Receipt → Invoice
→ Matching → Payment / Exception
```

Drive UI from actual backend state. Never fake completed stages.

### Requisition

States:
`CREATED` `PROCESSING` `NEEDS_CLARIFICATION` `REQUIREMENTS_EXTRACTED` `SUPPLIER_SELECTED` `PO_CREATED` `FAILED`

`GET /requisitions/:id` is the main source of truth. Poll while processing; stop when actionable or terminal.

### Purchase Order

Show approval actions only when `purchaseOrder.status === "PENDING_APPROVAL"`.

Approve: `POST /purchase-orders/:id/approve`
Reject: `POST /purchase-orders/:id/reject` and require a reason.

### Shipment / Receipt

Use `GET /shipments/:id`.

MVP delivery simulation: `POST /receipts/simulate`.

Display Ordered, Received, Damaged, Accepted. `accepted = received - damaged`.

### Invoice

Upload with `POST /invoices` using FormData. Do not manually set Content-Type.

Poll `GET /invoices/:id` while `UPLOADED` / `PROCESSING`; stop at `EXTRACTED` / `FAILED`.

Raw extracted supplier/PO fields are document claims, not verified facts.

### Exceptions

Only build exception UI when the backend endpoints are available. Do not build against unavailable APIs.

## UI Rules

Use shadcn/ui. Keep the design clean, modern, professional, enterprise-focused, and responsive.

Prioritize clear workflow states, loading skeletons, empty states, useful errors, disabled/pending mutation states, and accessibility.

Avoid excessive gradients, excessive animation, fake analytics/data, and unnecessary abstractions.

## Code Rules

- TypeScript strict.
- Reuse components.
- Keep components focused.
- Centralize API types.
- Keep server state in TanStack Query.
- Invalidate relevant queries after mutations.
- Never hardcode organization IDs or secrets.
- Never persist signed/temporary file URLs.
- Never silently swallow API errors.

## Definition of Done

Before finishing any phase:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

All must pass.

## Build Priority

1. Requisition chat
2. Workflow + polling
3. Supplier discovery
4. PO approval
5. Shipment + receipt
6. Invoice upload + extraction
7. Exceptions
8. Final polish
