import { create } from "zustand";

/**
 * Open/closed state for collapsible WorkflowSection cards, keyed by a
 * caller-supplied sectionId (see hooks/use-workflow-section.ts). Each
 * section captures its `defaultOpen` once, the first time it mounts —
 * mirroring the `useState(defaultOpen)` semantics this replaced.
 */

interface WorkflowSectionState {
  openSections: Record<string, boolean>;
  setSectionOpen: (sectionId: string, open: boolean) => void;
}

export const useWorkflowSectionStore = create<WorkflowSectionState>((set) => ({
  openSections: {},
  setSectionOpen: (sectionId, open) =>
    set((state) => ({ openSections: { ...state.openSections, [sectionId]: open } })),
}));
