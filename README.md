# P2P Procurement Simulator — Frontend

Frontend for the P2P (Procure-to-Pay) Procurement Simulator hackathon project. Drives the workflow:

```
Request → Requirements → Supplier Discovery → Purchase Order
→ Approval → Shipment → Goods Receipt → Invoice
→ Matching → Payment / Exception
```

## Screens

| Route | What it is |
| --- | --- |
| `/` | P2P analytics dashboard — funnel, cycle times, exception breakdown, supplier scorecard, anomaly feed |
| `/requisitions/[id]` | The primary workflow screen: chat intake through to invoice |
| `/purchase-orders`, `/invoices` | Stage lists and detail views, including the three-way match panel |
| `/exceptions` | Exceptions inbox. Resolve with approve, **partial approve**, or reject |
| `/payments` | Settlement ledger. An invoice settles in tranches, so each row is one movement of money against both the invoice and the purchase order |
| `/suppliers`, `/products` | The read-only catalog supplier discovery ranks against |

### Partial settlement

An invoice is not paid all-or-nothing. Resolving an exception with
`PARTIAL_APPROVE` authorizes a specific amount — by default the backend's
"pay for what actually arrived" suggestion, priced off the purchase order rather
than the invoice under suspicion. The invoice becomes `PARTIALLY_PAID` and the
order keeps its remaining balance, so a follow-up invoice for backordered units
can still be matched and settled. See `backend-docs/payments-api.md`.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query · React Hook Form + Zod · Zustand

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Set the backend URL in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:PORT
```

## Scripts

```bash
pnpm dev         # start dev server
pnpm build       # production build
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
pnpm test        # run tests
```

## Project Structure

```text
├── app/          # routes
├── components/   # shared UI components
├── features/     # feature-based modules (requisitions, sourcing, purchase-orders, shipments, receipts, invoices, exceptions)
├── hooks/
├── lib/api/      # API client, kept out of UI components
├── providers/
└── types/
```

See `CLAUDE.md` for detailed workflow, API, and code conventions.
