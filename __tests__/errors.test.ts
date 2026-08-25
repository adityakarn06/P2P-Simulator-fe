/**
 * categorizeError tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - Typed ApiError branch (validation / notFound / conflict / network / server)
 *   - Regression: plain Error / ZodError / string-matched network error unchanged
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { categorizeError } from "@/lib/errors";
import { ApiError } from "@/types/api";

describe("categorizeError — ApiError branch", () => {
  test("VALIDATION_ERROR / 400 -> validation, not retryable, backend message verbatim", () => {
    const err = new ApiError("Reason is required", "VALIDATION_ERROR", undefined, 400);
    const result = categorizeError(err);
    assert.equal(result.type, "validation");
    assert.equal(result.retryable, false);
    assert.equal(result.details, "Reason is required");
  });

  test("NOT_FOUND / 404 -> notFound, not retryable", () => {
    const err = new ApiError("Purchase order not found", "NOT_FOUND", undefined, 404);
    const result = categorizeError(err);
    assert.equal(result.type, "notFound");
    assert.equal(result.retryable, false);
  });

  test("INVALID_STATE / 409 -> conflict, not retryable", () => {
    const err = new ApiError("Already approved", "INVALID_STATE", undefined, 409);
    const result = categorizeError(err);
    assert.equal(result.type, "conflict");
    assert.equal(result.retryable, false);
  });

  test("NETWORK_ERROR -> network, retryable", () => {
    const err = new ApiError("Network request failed.", "NETWORK_ERROR");
    const result = categorizeError(err);
    assert.equal(result.type, "network");
    assert.equal(result.retryable, true);
  });

  test("INTERNAL_ERROR / 500 -> server, retryable", () => {
    const err = new ApiError("Boom", "INTERNAL_ERROR", undefined, 500);
    const result = categorizeError(err);
    assert.equal(result.type, "server");
    assert.equal(result.retryable, true);
  });
});

describe("categorizeError — regression guards", () => {
  test("a plain Error is still unknown / retryable", () => {
    const result = categorizeError(new Error("boom"));
    assert.equal(result.type, "unknown");
    assert.equal(result.retryable, true);
  });

  test("a message-matched network error is still network / retryable", () => {
    const result = categorizeError(new Error("network failed"));
    assert.equal(result.type, "network");
    assert.equal(result.retryable, true);
  });

  test("a ZodError is still validation", () => {
    const parsed = z.string().min(5).safeParse("hi");
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      const result = categorizeError(parsed.error);
      assert.equal(result.type, "validation");
      assert.equal(result.retryable, false);
    }
  });
});
