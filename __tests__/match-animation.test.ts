/**
 * Sequencing tests for the animated three-way match.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * The invariants here are the same ones match-state.test.ts protects, applied
 * to the drawing rather than the arithmetic:
 *   - a document that does not exist is never coloured as a failure
 *   - a ring only reddens when an open exception actually implicates it
 *   - a verdict is never revealed while matching is still running
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MATCH_NODE_KEYS,
  MATCH_PHASES,
  finalPhase,
  getDisplayOutcome,
  getFailingNodes,
  getImplicatedNodes,
  getMatchNodes,
  getMatchVerdict,
  getNodeState,
  getNodeTone,
  isConnectorDrawn,
  isVerdictVisible,
  nextPhase,
  type MatchNode,
} from "@/lib/state/match-animation";

const nodes = getMatchNodes({ hasPurchaseOrder: true, hasReceipt: true, hasInvoice: true });
const byKey = (key: MatchNode["key"]) => nodes.find((n) => n.key === key)!;

describe("phase sequence", () => {
  test("runs idle → each ring → verdict for a decided outcome", () => {
    const seen = ["idle"];
    let phase = nextPhase("idle", "passed");
    while (phase) {
      seen.push(phase);
      phase = nextPhase(phase, "passed");
    }
    assert.deepEqual(seen, [...MATCH_PHASES]);
  });

  test("stops at the last ring while matching is still running", () => {
    assert.equal(finalPhase("pending"), "invoice");
    assert.equal(nextPhase("invoice", "pending"), null);
    assert.equal(isVerdictVisible("invoice"), false);
  });

  test("every decided outcome reaches the verdict", () => {
    for (const outcome of ["passed", "exception", "failed", "overridden"] as const) {
      assert.equal(finalPhase(outcome), "verdict", outcome);
    }
    assert.equal(isVerdictVisible("verdict"), true);
  });
});

describe("ring and connector state", () => {
  test("rings are idle before their turn, drawing on it, done after", () => {
    assert.equal(getNodeState("purchaseOrder", "idle"), "idle");
    assert.equal(getNodeState("purchaseOrder", "purchaseOrder"), "drawing");
    assert.equal(getNodeState("purchaseOrder", "goodsReceipt"), "done");

    assert.equal(getNodeState("invoice", "goodsReceipt"), "idle");
    assert.equal(getNodeState("invoice", "invoice"), "drawing");
    assert.equal(getNodeState("invoice", "verdict"), "done");
  });

  test("a connector never runs ahead of the ring it leads to", () => {
    assert.equal(isConnectorDrawn(0, "purchaseOrder"), false);
    assert.equal(isConnectorDrawn(0, "goodsReceipt"), true);
    assert.equal(isConnectorDrawn(1, "goodsReceipt"), false);
    assert.equal(isConnectorDrawn(1, "invoice"), true);
  });

  test("there is no connector after the last ring", () => {
    assert.equal(isConnectorDrawn(MATCH_NODE_KEYS.length - 1, "verdict"), false);
  });
});

describe("which document an exception implicates", () => {
  test("a quantity mismatch points at the receipt and the invoice", () => {
    assert.deepEqual(getImplicatedNodes("QUANTITY_MISMATCH"), ["goodsReceipt", "invoice"]);
  });

  test("money and identity mismatches point at the invoice alone", () => {
    for (const type of ["PRICE_MISMATCH", "TAX_MISMATCH", "TOTAL_MISMATCH", "SUPPLIER_MISMATCH"] as const) {
      assert.deepEqual(getImplicatedNodes(type), ["invoice"], type);
    }
  });

  test("a type that blames no document implicates nothing", () => {
    assert.deepEqual(getImplicatedNodes("SYSTEM_FAILURE"), []);
    assert.deepEqual(getImplicatedNodes("PAYMENT_FAILURE"), []);
  });

  test("several exceptions union their rings", () => {
    const failing = getFailingNodes(["QUANTITY_MISMATCH", "PRICE_MISMATCH"]);
    assert.deepEqual([...failing].sort(), ["goodsReceipt", "invoice"]);
  });
});

describe("ring tone", () => {
  test("a missing document is never a failure", () => {
    const missingReceipt = getMatchNodes({
      hasPurchaseOrder: true,
      hasReceipt: false,
      hasInvoice: true,
    }).find((n) => n.key === "goodsReceipt")!;

    for (const outcome of ["passed", "exception", "failed", "pending"] as const) {
      assert.equal(
        getNodeTone(missingReceipt, outcome, getFailingNodes(["QUANTITY_MISMATCH"])),
        "unavailable",
        outcome
      );
    }
  });

  test("a failed match reddens only the implicated ring", () => {
    const failing = getFailingNodes(["PRICE_MISMATCH"]);
    assert.equal(getNodeTone(byKey("invoice"), "exception", failing), "failure");
    assert.equal(getNodeTone(byKey("purchaseOrder"), "exception", failing), "success");
  });

  test("an exception blaming no document reddens all of them", () => {
    const failing = getFailingNodes(["SYSTEM_FAILURE"]);
    for (const node of nodes) {
      assert.equal(getNodeTone(node, "exception", failing), "failure", node.key);
    }
  });

  test("an overridden match reddens nothing — the exception is already decided", () => {
    for (const node of nodes) {
      assert.equal(getNodeTone(node, "overridden", new Set()), "neutral", node.key);
    }
  });
});

describe("display outcome", () => {
  test("PARTIALLY_PAID is an override, not a pass and not still matching", () => {
    assert.equal(getDisplayOutcome("pending", "PARTIALLY_PAID"), "overridden");
    assert.equal(getDisplayOutcome("exception", "PARTIALLY_PAID"), "overridden");
  });

  test("every other status leaves the backend's verdict alone", () => {
    assert.equal(getDisplayOutcome("passed", "PAID"), "passed");
    assert.equal(getDisplayOutcome("exception", "EXCEPTION"), "exception");
    assert.equal(getDisplayOutcome("pending", "MATCHING"), "pending");
    assert.equal(getDisplayOutcome("failed", "FAILED"), "failed");
  });
});

describe("verdict copy", () => {
  test("only a passing match is described as passing", () => {
    assert.match(getMatchVerdict("passed", true).title, /passed/i);
    assert.doesNotMatch(getMatchVerdict("exception", true).title, /passed/i);
    assert.doesNotMatch(getMatchVerdict("overridden", true).title, /passed/i);
    assert.doesNotMatch(getMatchVerdict("pending", true).title, /passed/i);
  });

  test("a pending match with no receipt says what it is waiting for", () => {
    assert.match(getMatchVerdict("pending", false).title, /goods receipt/i);
    assert.equal(getMatchVerdict("pending", true).tone, "progress");
  });

  test("an overridden match says a balance is still outstanding", () => {
    const verdict = getMatchVerdict("overridden", true);
    assert.equal(verdict.tone, "warning");
    assert.match(verdict.detail, /outstanding/i);
  });
});
