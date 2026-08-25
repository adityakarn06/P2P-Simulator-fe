/**
 * Purchase-order approval-flow state-derivation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - isAwaitingApproval / isApproved / isRejected — keyed on status only
 *   - formatTaxRate — integer bps arithmetic
 *   - validateRejectReason — 1–500 chars, trimmed, per backend-docs/purchase-orders-api.md
 *   - arePoActionsDisabled — duplicate-click guard
 *   - PO_LIST_TAB_STATUS — /purchase-orders tab -> status filter map
 *   - getPurchaseOrderListPollInterval — poll while a row is worker-driven
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isAwaitingApproval,
  isApproved,
  isRejected,
  formatTaxRate,
  validateRejectReason,
  arePoActionsDisabled,
  PO_LIST_TAB_STATUS,
  getPurchaseOrderListPollInterval,
} from "@/lib/state/purchase-order-state";
import type { PurchaseOrderStatus } from "@/types/models";

const ALL_STATUSES: PurchaseOrderStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SHIPPED",
  "RECEIVED",
  "COMPLETED",
];

describe("isAwaitingApproval", () => {
  test("true only for PENDING_APPROVAL", () => {
    for (const status of ALL_STATUSES) {
      assert.equal(
        isAwaitingApproval({ status }),
        status === "PENDING_APPROVAL",
        `status ${status}`
      );
    }
  });
});

describe("isApproved", () => {
  test("true only for APPROVED", () => {
    for (const status of ALL_STATUSES) {
      assert.equal(isApproved({ status }), status === "APPROVED", `status ${status}`);
    }
  });
});

describe("isRejected", () => {
  test("true only for REJECTED", () => {
    for (const status of ALL_STATUSES) {
      assert.equal(isRejected({ status }), status === "REJECTED", `status ${status}`);
    }
  });
});

describe("formatTaxRate", () => {
  test("1800 bps -> 18%", () => {
    assert.equal(formatTaxRate(1800), "18%");
  });

  test("1250 bps -> 12.5%", () => {
    assert.equal(formatTaxRate(1250), "12.5%");
  });

  test("0 bps -> 0%", () => {
    assert.equal(formatTaxRate(0), "0%");
  });
});

describe("validateRejectReason", () => {
  test("rejects an empty reason", () => {
    const result = validateRejectReason("");
    assert.equal(result.ok, false);
  });

  test("rejects a whitespace-only reason", () => {
    const result = validateRejectReason("      ");
    assert.equal(result.ok, false);
  });

  test("rejects 501 characters", () => {
    const result = validateRejectReason("a".repeat(501));
    assert.equal(result.ok, false);
  });

  test("accepts 1 character", () => {
    const result = validateRejectReason("x");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.reason, "x");
  });

  test("accepts exactly 500 characters", () => {
    const reason = "a".repeat(500);
    const result = validateRejectReason(reason);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.reason, reason);
  });

  test("trims the accepted reason", () => {
    const result = validateRejectReason("  Budget exceeded  ");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.reason, "Budget exceeded");
  });
});

describe("arePoActionsDisabled", () => {
  const base = {
    approvePending: false,
    rejectPending: false,
    approveSucceeded: false,
    rejectSucceeded: false,
  };

  test("false when nothing is pending or succeeded", () => {
    assert.equal(arePoActionsDisabled(base), false);
  });

  test("true while approve is pending", () => {
    assert.equal(arePoActionsDisabled({ ...base, approvePending: true }), true);
  });

  test("true while reject is pending", () => {
    assert.equal(arePoActionsDisabled({ ...base, rejectPending: true }), true);
  });

  test("true once approve has succeeded (closes the race before refetch)", () => {
    assert.equal(arePoActionsDisabled({ ...base, approveSucceeded: true }), true);
  });

  test("true once reject has succeeded (closes the race before refetch)", () => {
    assert.equal(arePoActionsDisabled({ ...base, rejectSucceeded: true }), true);
  });
});

describe("PO_LIST_TAB_STATUS", () => {
  test("all has no status filter", () => {
    assert.equal(PO_LIST_TAB_STATUS.all, undefined);
  });

  test("every other tab maps to its matching status", () => {
    assert.equal(PO_LIST_TAB_STATUS.pending, "PENDING_APPROVAL");
    assert.equal(PO_LIST_TAB_STATUS.approved, "APPROVED");
    assert.equal(PO_LIST_TAB_STATUS.shipped, "SHIPPED");
    assert.equal(PO_LIST_TAB_STATUS.received, "RECEIVED");
    assert.equal(PO_LIST_TAB_STATUS.rejected, "REJECTED");
  });
});

describe("getPurchaseOrderListPollInterval", () => {
  test("false for an empty list", () => {
    assert.equal(getPurchaseOrderListPollInterval([]), false);
  });

  test("polls while a row is PENDING_APPROVAL", () => {
    assert.notEqual(
      getPurchaseOrderListPollInterval([{ status: "PENDING_APPROVAL" }]),
      false
    );
  });

  test("polls while a row is SHIPPED", () => {
    assert.notEqual(getPurchaseOrderListPollInterval([{ status: "SHIPPED" }]), false);
  });

  test("false when every row is terminal", () => {
    assert.equal(
      getPurchaseOrderListPollInterval([
        { status: "APPROVED" },
        { status: "REJECTED" },
        { status: "RECEIVED" },
        { status: "COMPLETED" },
      ]),
      false
    );
  });
});
