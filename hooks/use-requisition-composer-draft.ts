"use client";

import { useRequisitionStore } from "@/store/requisition-store";

/**
 * Draft text for a RequisitionComposer instance, keyed by a caller-supplied
 * key (a requisition id for chat replies, or "new" for the create form).
 */
export function useRequisitionComposerDraft(key: string) {
  const text = useRequisitionStore((s) => s.composerDrafts[key] ?? "");
  const setComposerDraft = useRequisitionStore((s) => s.setComposerDraft);
  const clearComposerDraft = useRequisitionStore((s) => s.clearComposerDraft);

  return {
    text,
    setText: (value: string) => setComposerDraft(key, value),
    clear: () => clearComposerDraft(key),
  };
}
