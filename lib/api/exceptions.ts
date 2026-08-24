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
  /** Required, 10–1000 characters */
  reason: string;
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
  /**
   * true only when decision=APPROVE AND this was the last open exception on
   * the invoice. Invoice transitions EXCEPTION → APPROVED and payment is queued.
   * false for any REJECT, or an APPROVE that left other exceptions open.
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
 * Records a human decision (APPROVE or REJECT).
 * An exception is terminal once resolved — calling again returns 409.
 * Disable the resolve UI once status is RESOLVED or REJECTED.
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
