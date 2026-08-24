import { PageHeader } from "@/components/page-header";
import { HugeiconsIcon } from "@hugeicons/react";
import { ReceiptIcon } from "@/lib/icons";

export default function ReceiptsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Receipts"
        description="Goods receipts confirming delivery and quantity for three-way matching."
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 py-24 text-center">
        <div className="rounded-2xl bg-emerald-100 p-4 dark:bg-emerald-900/30">
          <HugeiconsIcon
            icon={ReceiptIcon}
            className="size-10 text-emerald-600 dark:text-emerald-400"
            strokeWidth={1.5}
          />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Coming Soon</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Goods receipt management is under construction. Check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
