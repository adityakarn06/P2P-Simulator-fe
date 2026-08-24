export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  error: null;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status?: number;

  constructor(
    message: string,
    code: string,
    details?: unknown,
    status?: number
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }

  get isRetryable(): boolean {
    const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);
    return (
      this.code === "DEPENDENCY_UNAVAILABLE" ||
      this.code === "INTERNAL_ERROR" ||
      (this.status !== undefined && TRANSIENT_STATUSES.has(this.status))
    );
  }

  /** True for not-found errors (cross-tenant access returns 404 per backend docs) */
  get isNotFound(): boolean {
    return this.code === "NOT_FOUND" || this.status === 404;
  }

  /** True for validation errors */
  get isValidation(): boolean {
    return this.code === "VALIDATION_ERROR" || this.status === 400;
  }
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
