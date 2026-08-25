# P2P Procurement Simulator — Frontend

Frontend for the P2P (Procure-to-Pay) Procurement Simulator hackathon project. Drives the workflow:

```
Request → Requirements → Supplier Discovery → Purchase Order
→ Approval → Shipment → Goods Receipt → Invoice
→ Matching → Payment / Exception
```

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query · React Hook Form + Zod · Zustand

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Set the backend URL in `.env.local` (replace `8080` with the port your backend uses):

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
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
