"use client";

import { useEffect } from "react";
import { useWorkflowSectionStore } from "@/store/workflow-store";

/**
 * Open/closed state for a WorkflowSection, backed by the zustand store.
 * `defaultOpen` is captured once on first mount for a given `sectionId`,
 * mirroring the `useState(defaultOpen)` semantics this replaced — later
 * changes to `defaultOpen` are ignored once the section has an entry.
 */
export function useWorkflowSection(sectionId: string, defaultOpen: boolean) {
  const hasEntry = useWorkflowSectionStore((s) => sectionId in s.openSections);
  const open = useWorkflowSectionStore((s) => s.openSections[sectionId] ?? defaultOpen);
  const setSectionOpen = useWorkflowSectionStore((s) => s.setSectionOpen);

  useEffect(() => {
    if (!hasEntry) {
      setSectionOpen(sectionId, defaultOpen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capture defaultOpen once per sectionId, like useState's initializer
  }, [sectionId]);

  const toggle = () => setSectionOpen(sectionId, !open);

  return { open, toggle };
}
