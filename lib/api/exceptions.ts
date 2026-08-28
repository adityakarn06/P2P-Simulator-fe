import { apiClient } from "./client";
import type {
  Exception,
  ExceptionStatus,
  ExceptionType,
  ExceptionDecision,
} from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

export interface ListExceptionsParams {
  status?: ExceptionStatus;
  type?: ExceptionType;
  /** Scope to one entity — e.g. all exceptions blocking one invoice */
  entityId?: string;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}

export interface ResolveExceptionBody {
  decision: ExceptionDecision;
  /**
   * Integer paise > 0. **Required** with `PARTIAL_APPROVE` and **rejected**
   * with anything else — the backend refuses rather than silently ignoring a
   * number someone typed into a payment request. Callers must omit the key
   * entirely (not send `null`) for APPROVE/REJECT; `buildResolveBody` below
   * is the only place that decides this.
   */
  approvedAmountPaise?: number;
  /** Required, 10–1000 characters */
  reason: string;
}

/**
 * Assembles the request body so `approvedAmountPaise` is present for exactly
 * one decision. Sending it alongside APPROVE or REJECT is a 400, and omitting
 * it on PARTIAL_APPROVE is a 400 too, so this must not be inlined at call sites.
 */
export function buildResolveBody(input: {
  decision: ExceptionDecision;
  reason: string;
  approvedAmountPaise?: number | null;
}): ResolveExceptionBody {
  if (input.decision === "PARTIAL_APPROVE") {
    return {
      decision: input.decision,
      reason: input.reason,
      approvedAmountPaise: input.approvedAmountPaise ?? undefined,
    };
  }
  return { decision: input.decision, reason: input.reason };
}

/** GET /exceptions — list response uses `exceptions` key (not `items`) */
interface ExceptionListEnvelope {
  exceptions: Exception[];
  nextCursor: string | null;
}

/** GET /exceptions/:id response nests under `exception` key */
interface ExceptionDetailEnvelope {
  exception: Exception;
}

/** POST /exceptions/:id/resolve response */
export interface ResolveExceptionResponse {
  exception: Exception;
  /** The amount the backend actually recorded; `null` on a full approval. */
  approvedAmountPaise: number | null;
  /**
   * true only when the decision was APPROVE or PARTIAL_APPROVE **and** this was
   * the last exception still open on the invoice. The invoice has moved
   * EXCEPTION → APPROVED and payment is queued automatically.
   *
   * false for any REJECT, or an approval that left other exceptions open — an
   * invoice can carry several at once (e.g. a quantity *and* a price mismatch),
   * so a `false` here is not a failure and the remaining open exceptions must
   * stay visible.
   *
   * After a PARTIAL_APPROVE the terminal state is PARTIALLY_PAID, not PAID.
   */
  releasedForPayment: boolean;
}

/**
 * GET /api/v1/exceptions
 * Cursor-paginated list, newest first.
 * Use `status=OPEN` for an "exceptions inbox" view.
 * Use `entityId={invoiceId}` to scope to one invoice's exceptions.
 */
export async function listExceptions(
  params: ListExceptionsParams = {}
): Promise<CursorPaginatedData<Exception>> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.type) search.set("type", params.type);
  if (params.entityId) search.set("entityId", params.entityId);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();
  const envelope = await apiClient.get<ExceptionListEnvelope>(
    `/exceptions${qs ? `?${qs}` : ""}`
  );

  // Normalise to the standard cursor shape
  return {
    items: envelope.exceptions,
    nextCursor: envelope.nextCursor,
  };
}

/**
 * GET /api/v1/exceptions/:id
 * Full exception detail.
 */
export async function getException(id: string): Promise<Exception> {
  const envelope = await apiClient.get<ExceptionDetailEnvelope>(
    `/exceptions/${id}`
  );
  return envelope.exception;
}

/**
 * POST /api/v1/exceptions/:id/resolve
 * Records a human decision (APPROVE, PARTIAL_APPROVE or REJECT).
 *
 * Re-deciding a closed exception is a 409 INVALID_STATE, so the resolve UI must
 * be gated on the exception's *current* status rather than on the server
 * rejecting a duplicate. Note that "closed" is not forever: the same failure
 * recurring reopens the row (RESOLVED → OPEN), so never cache one as
 * permanently decided.
 *
 * `PO_APPROVAL_REQUIRED` is also a 409 here — it is decided on the purchase
 * order instead. See canResolveException in lib/state/exception-state.ts.
 */
export async function resolveException(
  id: string,
  body: ResolveExceptionBody
): Promise<ResolveExceptionResponse> {
  return apiClient.post<ResolveExceptionResponse>(
    `/exceptions/${id}/resolve`,
    body
  );
}
