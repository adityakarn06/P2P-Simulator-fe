"use client";

import { useExceptions } from "@/hooks/use-exceptions";
import { useExceptionStore } from "@/store/exception-store";
import type { ExceptionListTab } from "@/store/exception-store";
import type { ExceptionStatus } from "@/types/models";

const TAB_STATUS_MAP: Record<ExceptionListTab, ExceptionStatus | undefined> = {
  open: "OPEN",
  under_review: "UNDER_REVIEW",
  resolved: "RESOLVED",
  rejected: "REJECTED",
  all: undefined,
};

// Refresh cadence for the inbox — backend-docs/exceptions-api.md calls this
// "the primary read for 'what needs my attention'". No sockets, so poll.
const INBOX_POLL_MS = 10_000;

export function useExceptionList() {
  const activeTab = useExceptionStore((s) => s.activeTab);
  const setActiveTab = useExceptionStore((s) => s.setActiveTab);
  const status = TAB_STATUS_MAP[activeTab];

  const query = useExceptions(
    status ? { status, limit: 50 } : { limit: 50 },
    { refetchInterval: INBOX_POLL_MS }
  );

  return { activeTab, setActiveTab, ...query };
}
