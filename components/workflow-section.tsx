"use client";

import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface WorkflowSectionProps {
  title: string;
  /** Rendered next to the title, e.g. a StatusBadge */
  status?: ReactNode;
  /** Whether the section starts expanded. Uncontrolled after mount. */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A titled, collapsible workflow-stage card. Used to stack the sections of
 * /requisitions/[id] (Request, Conversation, Requirements, Supplier
 * Discovery, Purchase Order, …) under the timeline.
 */
export function WorkflowSection({
  title,
  status,
  defaultOpen = true,
  children,
  className,
}: WorkflowSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={cn("gap-0", className)}>
      <CardHeader
        className="cursor-pointer select-none flex-row items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <CardTitle>{title}</CardTitle>
          {status}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          <HugeiconsIcon icon={open ? ArrowUp01Icon : ArrowDown01Icon} className="size-4" />
        </Button>
      </CardHeader>
      {open && <CardContent className="pt-4">{children}</CardContent>}
    </Card>
  );
}
