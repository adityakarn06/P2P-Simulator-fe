"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/common/status-badge";
import { Money } from "@/components/common/money";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { buttonVariants } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/formatters";
import { getPaymentKindLabel, hasShortfall } from "@/lib/state/payment-state";
import type { Payment } from "@/types/payments";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@/lib/icons";
import type { ReactNode } from "react";

/**
 * The settlement ledger as a table. Shared by /payments and any scoped view
 * (one invoice, one purchase order) — the columns are the same either way.
 */
const columns: AppColumnDef<Payment>[] = [
  {
    accessorKey: "invoice",
    header: "Invoice",
    cell: ({ row }) => (
      <Link
        href={`/invoices/${row.original.invoiceId}`}
        className="block max-w-[140px] truncate text-sm font-mono font-medium hover:underline"
      >
        {row.original.invoice?.invoiceNumber ?? `${row.original.invoiceId.slice(0, 8)}…`}
      </Link>
    ),
  },
  {
    accessorKey: "purchaseOrderId",
    header: "PO",
    cell: ({ row }) => (
      <Link
        href={`/purchase-orders/${row.original.purchaseOrderId}`}
        className="text-xs font-mono text-muted-foreground hover:underline"
      >
        {row.original.purchaseOrder?.poNumber ??
          `${row.original.purchaseOrderId.slice(0, 8)}…`}
      </Link>
    ),
  },
  {
    accessorKey: "supplier",
    header: "Supplier",
    cell: ({ row }) => {
      const supplier = row.original.invoice?.supplier;
      return supplier ? (
        <Link
          href={`/suppliers/${supplier.id}`}
          className="block max-w-[160px] truncate text-sm hover:underline"
        >
          {supplier.name}
        </Link>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorKey: "amountPaise",
    header: "Amount",
    cell: ({ row }) => <Money paise={row.original.amountPaise} className="text-sm" />,
  },
  {
    accessorKey: "shortfallPaise",
    header: "Shortfall",
    // `shortfallPaise` is 0 both when the invoice is settled and when its total
    // was never extracted, so a bare "₹0.00" would claim more than the API says.
    cell: ({ row }) =>
      hasShortfall(row.original) ? (
        <Money paise={row.original.shortfallPaise} className="text-sm text-amber-700 dark:text-amber-400" />
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "kind",
    header: "Kind",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {getPaymentKindLabel(row.original)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatRelativeTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Link
        href={`/payments/${row.original.id}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        aria-label="Open payment"
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
      </Link>
    ),
  },
];

interface PaymentsTableProps {
  payments: Payment[];
  isLoading?: boolean;
  emptyState?: ReactNode;
}

export function PaymentsTable({ payments, isLoading, emptyState }: PaymentsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={payments}
      isLoading={isLoading}
      skeletonRows={8}
      emptyState={emptyState}
    />
  );
}
