"use client";

import Link from "next/link";
import { useSupplier } from "@/hooks/use-catalog";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { SupplierOtifStats } from "@/components/suppliers/supplier-otif-stats";
import { SupplierOffersTable } from "@/components/suppliers/supplier-offers-table";
import { formatDate } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@/lib/icons";

interface SupplierDetailProps {
  id: string;
}

export function SupplierDetail({ id }: SupplierDetailProps) {
  const { data, isLoading, isError, error, refetch } = useSupplier(id);

  if (isLoading) {
    return <LoadingState message="Loading supplier…" className="flex-1" />;
  }

  if (isError || !data) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  const { supplier, scorecard, products } = data;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <Link
        href="/suppliers"
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
        Back to suppliers
      </Link>

      <PageHeader
        title={supplier.name}
        description={supplier.email ?? undefined}
        actions={
          <Badge variant="outline" className="text-[11px]">
            {supplier.isActive ? "Active" : "Inactive"}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="text-sm">{supplier.email ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Phone</p>
          <p className="text-sm">{supplier.phone ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Catalog offers</p>
          <p className="text-sm tabular-nums">{products.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last delivery</p>
          <p className="text-sm">
            {supplier.lastDeliveryAt ? formatDate(supplier.lastDeliveryAt) : "—"}
          </p>
        </div>
      </div>

      <SupplierOtifStats supplier={supplier} scorecard={scorecard} />

      <div className="space-y-2">
        <p className="text-sm font-medium">Catalog</p>
        <SupplierOffersTable offers={products} />
      </div>
    </div>
  );
}
