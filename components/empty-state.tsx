"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import type { HugeiconsProps } from "@hugeicons/react";
import { InboxIcon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: HugeiconsProps["icon"];
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: HugeiconsProps["icon"];
  };
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon = InboxIcon,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center",
        className
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <HugeiconsIcon icon={icon} className="size-8 text-muted-foreground" strokeWidth={1.5} />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
        )}
      </div>

      {action && (
        <Button onClick={action.onClick} size="sm" className="gap-2">
          {action.icon && (
            <HugeiconsIcon icon={action.icon} className="size-4" />
          )}
          {action.label}
        </Button>
      )}

      {children}
    </div>
  );
}
