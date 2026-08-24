import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned action buttons or controls */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 pb-4", className)}>
      <div className="min-w-0 flex-1 space-y-0.5">
        <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground leading-snug">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
