import { z } from "zod";
import type { ExceptionStatus } from "@/types/models";

/**
 * All derivation logic for the exceptions inbox lives here, kept free of
 * React so it can be unit tested directly (see
 * __tests__/exception-state.test.ts).
 *
 * Source of truth: backend-docs/exceptions-api.md.
 */

/**
 * Mirrors the backend contract for POST /exceptions/:id/resolve: `reason`
 * is required, 10–1000 characters — "this is a financial judgement, the
 * backend refuses a resolution with no real explanation."
 */
export const resolveReasonSchema = z
  .string()
  .trim()
  .min(10, "Give at least a short explanation (10 characters).")
  .max(1000, "Reason must be 1000 characters or fewer.");

/**
 * True only while OPEN or UNDER_REVIEW. An exception's status is terminal
 * once it leaves either — resolving again is always a 409 INVALID_STATE,
 * never a replayed 200, so the resolve UI must be disabled rather than
 * relying on the server to reject a duplicate.
 */
export function isResolvable(status: ExceptionStatus): boolean {
  return status === "OPEN" || status === "UNDER_REVIEW";
}
