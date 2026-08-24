import { PageHeader } from "@/components/page-header";
import { HugeiconsIcon } from "@hugeicons/react";
import { PackageIcon } from "@/lib/icons";

export default function ShipmentsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Shipments"
        description="Track inbound shipments and goods receipt for open purchase orders."
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 py-24 text-center">
        <div className="rounded-2xl bg-sky-100 p-4 dark:bg-sky-900/30">
          <HugeiconsIcon
            icon={PackageIcon}
            className="size-10 text-sky-600 dark:text-sky-400"
            strokeWidth={1.5}
          />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Coming Soon</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Shipment tracking is under construction. Check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
