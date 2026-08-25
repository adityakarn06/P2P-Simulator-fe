import { create } from "zustand";

/**
 * Client/UI state for the requisitions screens. Server data (the
 * requisition itself, messages, etc.) stays in TanStack Query — see
 * hooks/use-requisitions.ts and hooks/use-requisition-detail.ts.
 */

export type RequisitionListTab =
  | "all"
  | "processing"
  | "needs_clarification"
  | "completed"
  | "failed";

interface RequisitionState {
  /** Active tab filter on /requisitions. */
  listTab: RequisitionListTab;
  setListTab: (tab: RequisitionListTab) => void;

  /** Optimistic user text shown while a chat send is in flight, keyed by requisition id. */
  pendingUserText: Record<string, string | null>;
  setPendingUserText: (id: string, text: string | null) => void;
  clearPendingUserText: (id: string) => void;

  /** "Still processing" notice visibility, keyed by requisition id. */
  slowNoticeVisible: Record<string, boolean>;
  setSlowNoticeVisible: (id: string, visible: boolean) => void;

  /** Composer draft text, keyed by a caller-supplied key (requisition id, or "new"). */
  composerDrafts: Record<string, string>;
  setComposerDraft: (key: string, text: string) => void;
  clearComposerDraft: (key: string) => void;
}

export const useRequisitionStore = create<RequisitionState>((set) => ({
  listTab: "all",
  setListTab: (listTab) => set({ listTab }),

  pendingUserText: {},
  setPendingUserText: (id, text) =>
    set((state) => ({ pendingUserText: { ...state.pendingUserText, [id]: text } })),
  clearPendingUserText: (id) =>
    set((state) => {
      const next = { ...state.pendingUserText };
      delete next[id];
      return { pendingUserText: next };
    }),

  slowNoticeVisible: {},
  setSlowNoticeVisible: (id, visible) =>
    set((state) => ({ slowNoticeVisible: { ...state.slowNoticeVisible, [id]: visible } })),

  composerDrafts: {},
  setComposerDraft: (key, text) =>
    set((state) => ({ composerDrafts: { ...state.composerDrafts, [key]: text } })),
  clearComposerDraft: (key) =>
    set((state) => {
      const next = { ...state.composerDrafts };
      delete next[key];
      return { composerDrafts: next };
    }),
}));
