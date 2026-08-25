/**
 * Exception resolve-flow state-derivation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - resolveReasonSchema — 10–1000 chars, trimmed, per backend-docs/exceptions-api.md
 *   - isResolvable — true only for OPEN / UNDER_REVIEW
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  resolveReasonSchema,
  isResolvable,
} from "@/features/exceptions/lib/exception-state";

describe("resolveReasonSchema", () => {
  test("rejects a reason under 10 characters", () => {
    const result = resolveReasonSchema.safeParse("too short");
    assert.equal(result.success, false);
  });

  test("rejects a whitespace-only reason", () => {
    const result = resolveReasonSchema.safeParse("            ");
    assert.equal(result.success, false);
  });

  test("accepts exactly 10 characters", () => {
    const result = resolveReasonSchema.safeParse("1234567890");
    assert.equal(result.success, true);
  });

  test("rejects 1001 characters", () => {
    const result = resolveReasonSchema.safeParse("a".repeat(1001));
    assert.equal(result.success, false);
  });

  test("accepts exactly 1000 characters", () => {
    const result = resolveReasonSchema.safeParse("a".repeat(1000));
    assert.equal(result.success, true);
  });

  test("trims surrounding whitespace", () => {
    const result = resolveReasonSchema.safeParse("  Approving payment for arrived units.  ");
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data, "Approving payment for arrived units.");
    }
  });
});

describe("isResolvable", () => {
  test("true for OPEN", () => {
    assert.equal(isResolvable("OPEN"), true);
  });

  test("true for UNDER_REVIEW", () => {
    assert.equal(isResolvable("UNDER_REVIEW"), true);
  });

  test("false for RESOLVED", () => {
    assert.equal(isResolvable("RESOLVED"), false);
  });

  test("false for REJECTED", () => {
    assert.equal(isResolvable("REJECTED"), false);
  });
});
