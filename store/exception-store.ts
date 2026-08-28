import { create } from "zustand";
import type { ExceptionDecision } from "@/types/models";

/**
 * Client/UI state for the exceptions inbox. Server data (the exceptions
 * list, resolve mutation) stays in hooks/use-exceptions.ts.
 */

export type ExceptionListTab = "open" | "under_review" | "resolved" | "rejected" | "all";

interface ExceptionState {
  /** Active tab filter on /exceptions. */
  activeTab: ExceptionListTab;
  setActiveTab: (tab: ExceptionListTab) => void;

  /** The decision (if any) currently being confirmed for each exception row, keyed by exception id. */
  pendingDecisions: Record<string, ExceptionDecision | null>;
  setPendingDecision: (exceptionId: string, decision: ExceptionDecision | null) => void;

  /** Shared resolve-dialog reason text — only one dialog is ever open at a time. */
  resolveReason: string;
  setResolveReason: (reason: string) => void;

  resolveReasonError: string | null;
  setResolveReasonError: (error: string | null) => void;

  /**
   * The PARTIAL_APPROVE amount, held as the raw **rupee** string the user is
   * typing rather than paise. Parsing on every keystroke would fight the user
   * mid-entry ("20616." is not yet a number); it is converted to integer paise
   * once, on submit, by parseApprovedAmount in lib/state/exception-state.ts.
   */
  approvedAmount: string;
  setApprovedAmount: (amount: string) => void;

  approvedAmountError: string | null;
  setApprovedAmountError: (error: string | null) => void;

  resetResolveForm: () => void;
}

export const useExceptionStore = create<ExceptionState>((set) => ({
  activeTab: "open",
  setActiveTab: (activeTab) => set({ activeTab }),

  pendingDecisions: {},
  setPendingDecision: (exceptionId, decision) =>
    set((state) => ({
      pendingDecisions: { ...state.pendingDecisions, [exceptionId]: decision },
    })),

  resolveReason: "",
  setResolveReason: (resolveReason) => set({ resolveReason, resolveReasonError: null }),

  resolveReasonError: null,
  setResolveReasonError: (resolveReasonError) => set({ resolveReasonError }),

  approvedAmount: "",
  setApprovedAmount: (approvedAmount) => set({ approvedAmount, approvedAmountError: null }),

  approvedAmountError: null,
  setApprovedAmountError: (approvedAmountError) => set({ approvedAmountError }),

  resetResolveForm: () =>
    set({
      resolveReason: "",
      resolveReasonError: null,
      approvedAmount: "",
      approvedAmountError: null,
    }),
}));
