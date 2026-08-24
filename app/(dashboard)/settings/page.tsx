import { PageHeader } from "@/components/page-header";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings05Icon } from "@/lib/icons";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Settings"
        description="Configure system preferences, integrations, and workflow rules."
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 py-24 text-center">
        <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-900/30">
          <HugeiconsIcon
            icon={Settings05Icon}
            className="size-10 text-slate-600 dark:text-slate-400"
            strokeWidth={1.5}
          />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Coming Soon</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Settings and configuration panel are under construction. Check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
