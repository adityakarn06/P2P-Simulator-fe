"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/workflow/activity-timeline";
import { useRequisitionActivity } from "@/hooks/use-requisition-activity";
import type { Requisition } from "@/types/models";

interface RequisitionActivityProps {
  requisition: Requisition;
}

const INITIAL_VISIBLE = 10;
const SHOW_MORE_STEP = 20;

/**
 * The Activity section on /requisitions/[id] — fans out across every entity
 * this requisition's workflow has touched (see useRequisitionActivity) and
 * renders the merged, newest-first result. Only mounted while its
 * WorkflowSection is expanded, so the fan-out and its polling don't run for
 * a collapsed section.
 */
export function RequisitionActivity({ requisition }: RequisitionActivityProps) {
  const { rows, isLoading, isError, error } = useRequisitionActivity(requisition);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const visibleRows = rows.slice(0, visibleCount);
  const hasMore = rows.length > visibleRows.length;

  return (
    <div className="space-y-4">
      <ActivityTimeline rows={visibleRows} isLoading={isLoading} isError={isError} error={error} />

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((count) => count + SHOW_MORE_STEP)}
          >
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
