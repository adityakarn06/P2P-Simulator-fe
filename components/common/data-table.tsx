"use client";

import {
  createTableHook,
  coreFeatures,
  tableFeatures,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SkeletonTable } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// Create a table hook bound to the core feature set (no sorting/pagination/filtering).
// This is the v9-idiomatic pattern — features are registered once, not repeated on every table.
const { useAppTable } = createTableHook({
  features: tableFeatures(coreFeatures),
});

// Export the bound ColumnDef type so pages import from one place and never
// have to spell out TFeatures themselves.
export type { ColumnDef };
type _TableHook = ReturnType<typeof createTableHook<ReturnType<typeof tableFeatures<typeof coreFeatures>>, Record<string, never>, Record<string, never>, Record<string, never>>>;
export type AppFeatures = _TableHook["appFeatures"];
export type AppColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
  AppFeatures,
  TData,
  TValue
>;

interface DataTableProps<TData extends RowData> {
  columns: AppColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  /** Number of skeleton rows while loading */
  skeletonRows?: number;
  /** Rendered when data is empty and not loading */
  emptyState?: ReactNode;
  className?: string;
  /** Return extra Tailwind classes per row */
  rowClassName?: (row: TData) => string | undefined;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  isLoading,
  skeletonRows = 5,
  emptyState,
  className,
  rowClassName,
  onRowClick,
}: DataTableProps<TData>) {
  const table = useAppTable({ columns, data });

  if (isLoading) {
    return (
      <SkeletonTable
        rows={skeletonRows}
        columns={columns.length}
        className={className}
      />
    );
  }

  if (data.length === 0) {
    return (
      <>{emptyState ?? <EmptyState title="No records found" className="py-12" />}</>
    );
  }

  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-9 px-3 text-xs font-medium text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                "text-sm",
                onRowClick && "cursor-pointer",
                rowClassName?.(row.original)
              )}
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className="px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
