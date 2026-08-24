import { PageHeader } from "@/components/page-header";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileEditIcon } from "@/lib/icons";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RequisitionDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Requisition Detail"
        description={`Viewing requisition ${id.slice(0, 8)}…`}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 py-24 text-center">
        <div className="rounded-2xl bg-blue-100 p-4 dark:bg-blue-900/30">
          <HugeiconsIcon
            icon={FileEditIcon}
            className="size-10 text-blue-600 dark:text-blue-400"
            strokeWidth={1.5}
          />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Coming Soon</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            The requisition detail view is under construction. Check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
