import { create } from "zustand";

/**
 * Which invoices' three-way match animation has already played this session,
 * keyed by invoice id.
 *
 * The animation is a one-off reveal, not a status indicator: collapsing and
 * re-expanding the Three-way Matching section, or a poll re-rendering the
 * card, must not replay it. Kept in a store rather than component state
 * because WorkflowSection unmounts its children while closed.
 *
 * Session-scoped on purpose — a fresh page load is a fresh telling of the
 * story, and there is nothing here worth persisting.
 */

interface MatchAnimationState {
  playedInvoiceIds: Record<string, boolean>;
  hasPlayed: (invoiceId: string) => boolean;
  markPlayed: (invoiceId: string) => void;
}

export const useMatchAnimationStore = create<MatchAnimationState>((set, get) => ({
  playedInvoiceIds: {},
  hasPlayed: (invoiceId) => Boolean(get().playedInvoiceIds[invoiceId]),
  markPlayed: (invoiceId) =>
    set((state) =>
      state.playedInvoiceIds[invoiceId]
        ? state
        : { playedInvoiceIds: { ...state.playedInvoiceIds, [invoiceId]: true } }
    ),
}));
