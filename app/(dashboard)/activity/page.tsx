"use client";

import { useActivityLog } from "@/hooks/use-activity-log";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Spinner } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime, formatRelativeTime } from "@/lib/formatters";
import { ActivityIcon } from "@/lib/icons";
import { ACTIVITY_FILTER_ALL } from "@/store/activity-store";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTOR_TYPES,
  AUDIT_ENTITY_TYPES,
  describeAuditLog,
  getAuditActionLabel,
  getAuditActorLabel,
} from "@/lib/state/activity-state";
import type { AuditAction, AuditActorType, AuditLog, EntityType } from "@/types/models";

const ACTOR_TYPES = AUDIT_ACTOR_TYPES;
const ENTITY_TYPES = AUDIT_ENTITY_TYPES;
const ACTIONS = AUDIT_ACTIONS;

/** Renders metadata.stage for WORKFLOW_FAILED rows, else a compact key/value summary. */
function MetadataSummary({ log }: { log: AuditLog }) {
  const { detail } = describeAuditLog(log);
  if (!detail) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className="text-xs text-muted-foreground truncate block max-w-[220px]"
      title={JSON.stringify(log.metadata)}
    >
      {detail}
    </span>
  );
}

const columns: AppColumnDef<AuditLog>[] = [
  {
    accessorKey: "createdAt",
    header: "Time",
    cell: ({ row }) => (
      <span
        className="text-xs text-muted-foreground tabular-nums whitespace-nowrap"
        title={formatDateTime(row.original.createdAt)}
      >
        {formatRelativeTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => (
      <span className="text-sm font-medium">{describeAuditLog(row.original).label}</span>
    ),
  },
  {
    accessorKey: "actorType",
    header: "Actor",
    cell: ({ row }) => (
      <div className="text-xs">
        <span className="text-muted-foreground">{getAuditActorLabel(row.original.actorType)}</span>
        {row.original.actorId && (
          <p className="font-mono text-muted-foreground/80">{row.original.actorId}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "entityType",
    header: "Entity",
    cell: ({ row }) => (
      <div className="text-xs">
        <span>{row.original.entityType}</span>
        <p className="font-mono text-muted-foreground truncate max-w-[140px]">
          {row.original.entityId}
        </p>
      </div>
    ),
  },
  {
    id: "details",
    header: "Details",
    cell: ({ row }) => <MetadataSummary log={row.original} />,
  },
];

export default function ActivityPage() {
  const {
    actorType,
    entityType,
    action,
    setActorType,
    setEntityType,
    setAction,
    rows,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivityLog();

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Activity"
        description="A full audit log of every P2P workflow event across the system."
      />

      <p className="text-xs text-muted-foreground -mt-2">
        Exception rows are filed under entity &quot;Exception&quot;, not the invoice or
        requisition they concern — filter by Action to find them, or use the Exceptions screen.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={actorType} onValueChange={(v) => setActorType(v as AuditActorType | typeof ACTIVITY_FILTER_ALL)}>
          <SelectTrigger>
            <SelectValue placeholder="Actor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ACTIVITY_FILTER_ALL}>All actors</SelectItem>
            {ACTOR_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {getAuditActorLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType | typeof ACTIVITY_FILTER_ALL)}>
          <SelectTrigger>
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ACTIVITY_FILTER_ALL}>All entities</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={action} onValueChange={(v) => setAction(v as AuditAction | typeof ACTIVITY_FILTER_ALL)}>
          <SelectTrigger>
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ACTIVITY_FILTER_ALL}>All actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {getAuditActionLabel(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        skeletonRows={8}
        emptyState={
          <EmptyState
            icon={ActivityIcon}
            title="No activity found"
            description="No workflow events match the current filters."
            className="py-12"
          />
        }
      />

      {hasNextPage && (
        <div className="flex justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="gap-1.5"
          >
            {isFetchingNextPage && <Spinner size="sm" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
