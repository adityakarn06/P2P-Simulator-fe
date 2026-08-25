import { PageHeader } from "@/components/common/page-header";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShoppingCart01Icon } from "@/lib/icons";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PurchaseOrderDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Purchase Order Detail"
        description={`Viewing purchase order ${id.slice(0, 8)}…`}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 py-24 text-center">
        <div className="rounded-2xl bg-violet-100 p-4 dark:bg-violet-900/30">
          <HugeiconsIcon
            icon={ShoppingCart01Icon}
            className="size-10 text-violet-600 dark:text-violet-400"
            strokeWidth={1.5}
          />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Coming Soon</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            The purchase order detail view is under construction. Check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
