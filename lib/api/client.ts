import { ApiError, type ApiResponse } from "@/types/api";
import { parseContentDispositionFilename } from "@/lib/documents";

const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
).replace(/\/$/, "");

const ORG_ID = process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "";

export interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
  headers?: Record<string, string>;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "x-organization-id": ORG_ID,
    Accept: "application/json",
    ...extra,
  };
}

// Core fetch wrapper.
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  // For FormData, strip any caller-provided Content-Type (case-insensitive) so
  // the browser can set it with the correct multipart boundary.
  const extraHeaders: Record<string, string> = isFormData
    ? Object.fromEntries(
        Object.entries(options.headers ?? {}).filter(
          ([k]) => k.toLowerCase() !== "content-type"
        )
      )
    : (options.headers ?? {});

  const headers: Record<string, string> = {
    ...buildHeaders(extraHeaders),
    // Only set Content-Type for JSON — FormData must NOT have it set manually
    ...(body !== undefined && !isFormData
      ? { "Content-Type": "application/json" }
      : {}),
  };

  const init: RequestInit = {
    ...options,
    method,
    headers,
    body: body === undefined
      ? undefined
      : isFormData
        ? (body as FormData)
        : JSON.stringify(body),
  };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    // Preserve abort/cancellation errors so callers using AbortController can
    // detect cancellation via error.name === "AbortError".
    if (options.signal?.aborted) {
      throw err;
    }
    throw new ApiError(
      "Network request failed. Check your connection.",
      "NETWORK_ERROR",
      err instanceof Error ? err.message : undefined
    );
  }

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      `Unexpected response from server (HTTP ${res.status}).`,
      "PARSE_ERROR",
      undefined,
      res.status
    );
  }

  if (!json.success) {
    const err = json.error;
    throw new ApiError(
      err?.message ?? "An unexpected error occurred.",
      err?.code ?? "UNKNOWN_ERROR",
      err?.details,
      res.status
    );
  }

  return json.data;
}

export interface BinaryResponse {
  blob: Blob;
  /** Parsed from Content-Disposition, or null if the header is absent/unparseable. */
  filename: string | null;
  /** The response's own Content-Type — a PDF endpoint can still stream PNG/JPEG bytes. */
  mimeType: string;
}

/**
 * GET a binary body (the three /pdf document endpoints — see
 * backend-docs/documents-api.md). A 200 has no JSON envelope, so this bypasses
 * `request()` entirely; a non-2xx response is still the normal
 * `{ success: false, error }` envelope and is parsed the same way.
 */
async function requestBlob(path: string, options: RequestOptions = {}): Promise<BinaryResponse> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    ...buildHeaders(options.headers),
    Accept: "*/*",
  };

  let res: Response;
  try {
    res = await fetch(url, { ...options, method: "GET", headers });
  } catch (err) {
    if (options.signal?.aborted) {
      throw err;
    }
    throw new ApiError(
      "Network request failed. Check your connection.",
      "NETWORK_ERROR",
      err instanceof Error ? err.message : undefined
    );
  }

  if (!res.ok) {
    let json: ApiResponse<unknown>;
    try {
      json = (await res.json()) as ApiResponse<unknown>;
    } catch {
      throw new ApiError(
        `Unexpected response from server (HTTP ${res.status}).`,
        "PARSE_ERROR",
        undefined,
        res.status
      );
    }
    const err = !json.success ? json.error : undefined;
    throw new ApiError(
      err?.message ?? "An unexpected error occurred.",
      err?.code ?? "UNKNOWN_ERROR",
      err?.details,
      res.status
    );
  }

  const blob = await res.blob();
  return {
    blob,
    filename: parseContentDispositionFilename(res.headers.get("Content-Disposition")),
    mimeType: res.headers.get("Content-Type") ?? blob.type ?? "application/octet-stream",
  };
}

// Public API client
export const apiClient = {
  /** GET /path */
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("GET", path, undefined, options);
  },

  /** POST /path with JSON body */
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("POST", path, body, options);
  },

  /** POST /path with FormData body (multipart — Content-Type NOT set manually) */
  upload<T>(path: string, form: FormData, options?: RequestOptions): Promise<T> {
    return request<T>("POST", path, form, options);
  },

  /** PUT /path with JSON body */
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PUT", path, body, options);
  },

  /** PATCH /path with JSON body */
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PATCH", path, body, options);
  },

  /** DELETE /path */
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("DELETE", path, undefined, options);
  },

  /** GET /path expecting a binary body (PDF/PNG/JPEG), not the JSON envelope. */
  getBlob(path: string, options?: RequestOptions): Promise<BinaryResponse> {
    return requestBlob(path, options);
  },
} as const;
