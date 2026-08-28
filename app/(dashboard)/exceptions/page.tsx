"use client";

import { useRouter } from "next/navigation";
import { useExceptionList } from "@/hooks/use-exception-list";
import { useExceptionResolve } from "@/hooks/use-exception-resolve";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { ResolveExceptionDialog } from "@/components/exceptions/resolve-exception-dialog";
import { canResolveException, isResolvable, isResolvableHere } from "@/lib/state/exception-state";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Exception } from "@/types/models";
import type { ExceptionListTab } from "@/store/exception-store";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert01Icon,
  TickDouble01Icon,
  Cancel01Icon,
} from "@/lib/icons";

// ── Resolve action cell ───────────────────────────────────────────────────────

function ResolveActions({ exception }: { exception: Exception }) {
  const {
    pendingDecision,
    openDecision,
    handleOpenChange,
    reason,
    setReason,
    reasonError,
    handleConfirm,
    isPending,
    error,
  } = useExceptionResolve(exception);

  // A PO_APPROVAL_REQUIRED row is open but not decidable here — it is settled
  // by approving or rejecting the purchase order, which closes it itself.
  if (isResolvable(exception.status) && !isResolvableHere(exception.type)) {
    return (
      <span className="text-xs text-muted-foreground">On the purchase order</span>
    );
  }

  if (!canResolveException(exception)) {
    return (
      <span className="text-xs text-muted-foreground">
        {exception.resolution ?? exception.status}
      </span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
          onClick={() => openDecision("APPROVE")}
        >
          <HugeiconsIcon icon={TickDouble01Icon} className="size-3" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
          onClick={() => openDecision("REJECT")}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          Reject
        </Button>
      </div>

      {pendingDecision && (
        <ResolveExceptionDialog
          open={pendingDecision != null}
          onOpenChange={handleOpenChange}
          decision={pendingDecision}
          exceptionTitle={exception.title}
          reason={reason}
          onReasonChange={setReason}
          validationError={reasonError}
          onConfirm={handleConfirm}
          isPending={isPending}
          error={error}
        />
      )}
    </>
  );
}

// ── Columns ───────────────────────────────────────────────────────────────────

const columns: AppColumnDef<Exception>[] = [
  {
    accessorKey: "severity",
    header: "Sev.",
    cell: ({ row }) => <StatusBadge status={row.original.severity} />,
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground font-mono">
        {row.original.type.replace(/_/g, " ")}
      </span>
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <div className="max-w-xs">
        <p className="text-sm font-medium truncate">{row.original.title}</p>
        {row.original.description && (
          <p className="text-xs text-muted-foreground truncate">{row.original.description}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "entityType",
    header: "Entity",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground font-mono">
        {row.original.entityType} {row.original.entityId.slice(0, 8)}…
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Raised",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatRelativeTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <ResolveActions exception={row.original} />
      </div>
    ),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ExceptionsPage() {
  const router = useRouter();
  const { activeTab, setActiveTab, data, isLoading, isError, error, refetch } =
    useExceptionList();

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Exceptions"
        description="Review and resolve procurement exceptions blocking payment or workflow progress."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ExceptionListTab)}>
        <TabsList className="h-8">
          <TabsTrigger value="open" className="text-xs">Open</TabsTrigger>
          <TabsTrigger value="under_review" className="text-xs">Under Review</TabsTrigger>
          <TabsTrigger value="resolved" className="text-xs">Resolved</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs">Rejected</TabsTrigger>
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        skeletonRows={6}
        onRowClick={(row) => router.push(`/exceptions/${row.id}`)}
        emptyState={
          <EmptyState
            icon={Alert01Icon}
            title={activeTab === "open" ? "No open exceptions" : "No exceptions found"}
            description={
              activeTab === "open"
                ? "All exceptions have been resolved. The workflow is proceeding normally."
                : `No exceptions in "${activeTab}" state.`
            }
            className="py-12"
          />
        }
        rowClassName={(row) =>
          cn(
            row.status === "OPEN" && "bg-orange-50/40 dark:bg-orange-950/10",
            row.severity === "CRITICAL" && "bg-red-50/40 dark:bg-red-950/10"
          )
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
