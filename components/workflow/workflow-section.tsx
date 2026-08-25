"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useWorkflowSection } from "@/hooks/use-workflow-section";

interface WorkflowSectionProps {
  /** Unique key identifying this section's open/closed state in the store. */
  sectionId: string;
  title: string;
  /** Rendered next to the title, e.g. a StatusBadge */
  status?: ReactNode;
  /** Whether the section starts expanded. Captured once on mount. */
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
  sectionId,
  title,
  status,
  defaultOpen = true,
  children,
  className,
}: WorkflowSectionProps) {
  const { open, toggle } = useWorkflowSection(sectionId, defaultOpen);
  const contentId = `${sectionId}-content`;

  return (
    <Card className={cn("gap-0", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <button
          type="button"
          className="flex flex-1 cursor-pointer select-none items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-expanded={open}
          aria-controls={open ? contentId : undefined}
          onClick={toggle}
        >
          {/* Not <CardTitle> here — it renders a <div>, and a <div> inside
              <button> (phrasing content only) is invalid HTML. Same visual
              styling, a <span> instead. */}
          <span className="font-heading text-sm font-medium">{title}</span>
          <HugeiconsIcon
            icon={open ? ArrowUp01Icon : ArrowDown01Icon}
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
        {status}
      </CardHeader>
      {open && (
        <CardContent id={contentId} className="pt-4">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
