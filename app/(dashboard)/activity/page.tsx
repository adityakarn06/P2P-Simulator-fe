import { PageHeader } from "@/components/page-header";
import { HugeiconsIcon } from "@hugeicons/react";
import { ActivityIcon } from "@/lib/icons";

export default function ActivityPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Activity"
        description="A full audit log of all P2P workflow events across the system."
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 py-24 text-center">
        <div className="rounded-2xl bg-indigo-100 p-4 dark:bg-indigo-900/30">
          <HugeiconsIcon
            icon={ActivityIcon}
            className="size-10 text-indigo-600 dark:text-indigo-400"
            strokeWidth={1.5}
          />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Coming Soon</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Activity feed and audit log are under construction. Check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
