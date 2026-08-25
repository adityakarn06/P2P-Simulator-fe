"use client";

import Link from "next/link";
import { useInvoiceList } from "@/hooks/use-invoice-list";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Money } from "@/components/common/money";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime, formatDate } from "@/lib/formatters";
import type { Invoice } from "@/types/models";
import type { InvoiceListTab } from "@/store/invoice-store";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Invoice01Icon,
} from "@/lib/icons";

const columns: AppColumnDef<Invoice>[] = [
  {
    accessorKey: "invoiceNumber",
    header: "Invoice #",
    cell: ({ row }) => (
      <span className="text-sm font-mono font-medium">
        {row.original.invoiceNumber ?? <span className="text-muted-foreground">—</span>}
      </span>
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
        {row.original.purchaseOrderId.slice(0, 8)}…
      </Link>
    ),
  },
  {
    accessorKey: "supplierNameRaw",
    header: "Supplier",
    cell: ({ row }) => (
      <span className="text-sm max-w-[140px] truncate block">
        {row.original.supplierNameRaw ?? <span className="text-muted-foreground">—</span>}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "totalPaise",
    header: "Total",
    cell: ({ row }) =>
      row.original.totalPaise != null ? (
        <Money paise={row.original.totalPaise} className="text-sm" />
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "invoiceDate",
    header: "Invoice Date",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {row.original.invoiceDate ? formatDate(row.original.invoiceDate) : "—"}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Uploaded",
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
        href={`/invoices/${row.original.id}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
      </Link>
    ),
  },
];

export default function InvoicesPage() {
  const { activeTab, setActiveTab, data, isLoading, isError, error, refetch } = useInvoiceList();

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Invoices"
        description="Upload supplier invoices. Gemini Vision extracts line items for three-way matching."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InvoiceListTab)}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="processing" className="text-xs">Processing</TabsTrigger>
          <TabsTrigger value="extracted" className="text-xs">Extracted</TabsTrigger>
          <TabsTrigger value="exception" className="text-xs">Exception</TabsTrigger>
          <TabsTrigger value="paid" className="text-xs">Paid</TabsTrigger>
          <TabsTrigger value="failed" className="text-xs">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        skeletonRows={8}
        emptyState={
          <EmptyState
            icon={Invoice01Icon}
            title="No invoices found"
            description={
              activeTab === "all"
                ? "Invoices are created when you upload a supplier invoice for an approved PO."
                : `No invoices in "${activeTab}" state.`
            }
            className="py-12"
          />
        }
      />

      {data?.nextCursor && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Showing first 50 results.
        </p>
      )}
    </div>
  );
}
