"use client";

import { useState } from "react";
import { useExceptions, useResolveException } from "@/hooks/use-exceptions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ResolveExceptionDialog } from "@/features/exceptions/components/resolve-exception-dialog";
import { isResolvable } from "@/features/exceptions/lib/exception-state";
import { DataTable, type AppColumnDef } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ApiError } from "@/types/api";
import type { Exception, ExceptionDecision, ExceptionStatus } from "@/types/models";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert01Icon,
  TickDouble01Icon,
  Cancel01Icon,
} from "@/lib/icons";

type TabFilter = "open" | "under_review" | "resolved" | "rejected" | "all";

const TAB_STATUS_MAP: Record<TabFilter, ExceptionStatus | undefined> = {
  open: "OPEN",
  under_review: "UNDER_REVIEW",
  resolved: "RESOLVED",
  rejected: "REJECTED",
  all: undefined,
};

// Refresh cadence for the inbox — backend-docs/exceptions-api.md calls this
// "the primary read for 'what needs my attention'". No sockets, so poll.
const INBOX_POLL_MS = 10_000;

// ── Resolve action cell ───────────────────────────────────────────────────────

function ResolveActions({ exception }: { exception: Exception }) {
  const [pendingDecision, setPendingDecision] = useState<ExceptionDecision | null>(null);
  const { mutate, isPending, error, reset } = useResolveException();

  if (!isResolvable(exception.status)) {
    return (
      <span className="text-xs text-muted-foreground">
        {exception.resolution ?? exception.status}
      </span>
    );
  }

  const handleConfirm = (reason: string) => {
    if (!pendingDecision) return;
    mutate(
      { id: exception.id, decision: pendingDecision, reason },
      {
        onSuccess: () => {
          toast.success(
            pendingDecision === "APPROVE" ? "Exception approved" : "Exception rejected"
          );
          setPendingDecision(null);
        },
        onError: (e) => {
          if (e instanceof ApiError && e.isConflict) {
            toast.error("This exception was already decided — refreshed.");
            setPendingDecision(null);
            return;
          }
          toast.error(e.message);
        },
      }
    );
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
          onClick={() => setPendingDecision("APPROVE")}
        >
          <HugeiconsIcon icon={TickDouble01Icon} className="size-3" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
          onClick={() => setPendingDecision("REJECT")}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          Reject
        </Button>
      </div>

      {pendingDecision && (
        <ResolveExceptionDialog
          open={pendingDecision != null}
          onOpenChange={(open) => {
            if (!open) {
              setPendingDecision(null);
              reset();
            }
          }}
          decision={pendingDecision}
          exceptionTitle={exception.title}
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
      <span className="text-xs text-muted-foreground">
        {row.original.entityType}
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
    cell: ({ row }) => <ResolveActions exception={row.original} />,
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ExceptionsPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("open");
  const status = TAB_STATUS_MAP[activeTab];

  const { data, isLoading, isError, error, refetch } = useExceptions(
    status ? { status, limit: 50 } : { limit: 50 },
    { refetchInterval: INBOX_POLL_MS }
  );

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Exceptions"
        description="Review and resolve procurement exceptions blocking payment or workflow progress."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)}>
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
