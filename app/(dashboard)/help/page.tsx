import { PageHeader } from "@/components/common/page-header";
import { HugeiconsIcon } from "@hugeicons/react";
import { HelpCircleIcon } from "@/lib/icons";

export default function HelpPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Help"
        description="Documentation, FAQs, and guides for using the P2P Simulator."
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 py-24 text-center">
        <div className="rounded-2xl bg-teal-100 p-4 dark:bg-teal-900/30">
          <HugeiconsIcon
            icon={HelpCircleIcon}
            className="size-10 text-teal-600 dark:text-teal-400"
            strokeWidth={1.5}
          />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Coming Soon</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Help documentation is under construction. Check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
