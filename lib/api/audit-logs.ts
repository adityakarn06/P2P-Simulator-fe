import { apiClient } from "./client";
import type { AuditLog, AuditAction, AuditActorType, EntityType } from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

export interface ListAuditLogsParams {
  action?: AuditAction;
  actorType?: AuditActorType;
  entityType?: EntityType;
  /** Scope to one record's timeline — pair with entityType for an exact match */
  entityId?: string;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}

/** GET /audit-logs — list response uses `auditLogs` key (not `items`) */
interface AuditLogListEnvelope {
  auditLogs: AuditLog[];
  nextCursor: string | null;
}

/**
 * GET /api/v1/audit-logs
 * Cursor-paginated list, newest first (createdAt, with id as a tiebreaker).
 * The cross-stage activity trail — every workflow transition writes one
 * immutable row here. Read-only; there is no create/update/delete.
 *
 * Note: exception rows are filed under entityType="Exception", not the
 * invoice/requisition they concern (that's in metadata.entityType /
 * metadata.entityId) — see backend-docs/audit-logs-api.md.
 */
export async function listAuditLogs(
  params: ListAuditLogsParams = {}
): Promise<CursorPaginatedData<AuditLog>> {
  const search = new URLSearchParams();
  if (params.action) search.set("action", params.action);
  if (params.actorType) search.set("actorType", params.actorType);
  if (params.entityType) search.set("entityType", params.entityType);
  if (params.entityId) search.set("entityId", params.entityId);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();
  const envelope = await apiClient.get<AuditLogListEnvelope>(
    `/audit-logs${qs ? `?${qs}` : ""}`
  );

  // Normalise to the standard cursor shape
  return {
    items: envelope.auditLogs,
    nextCursor: envelope.nextCursor,
  };
}
