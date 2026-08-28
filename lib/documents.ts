/**
 * Pure helpers for the three binary document endpoints
 * (backend-docs/documents-api.md: purchase order, goods receipt and invoice
 * PDFs). Kept free of React/DOM-specific globals where possible so the
 * parsing logic is unit testable — see __tests__/documents.test.ts.
 */

/**
 * Parses a filename out of a `Content-Disposition` header. Handles both the
 * plain `filename="x.pdf"` form and the RFC 5987 `filename*=UTF-8''x.pdf`
 * form (preferred when both are present, since it's percent-decoded and
 * charset-aware). Returns null when the header is missing or has neither.
 */
export function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;

  const extended = header.match(/filename\*\s*=\s*[^']*''([^;]+)/i);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      // Malformed percent-encoding — fall through to the plain form.
    }
  }

  const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (plain?.[1]) {
    return plain[1].trim();
  }

  return null;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

function extensionForMimeType(mimeType: string): string {
  return MIME_EXTENSIONS[mimeType] ?? "pdf";
}

export type DocumentKind = "purchase-order" | "goods-receipt" | "invoice";

/**
 * Filename to use when Content-Disposition is missing or unparseable.
 * `identifier` should be the most human-recognisable id available — a PO
 * number or invoice number when known, otherwise the entity's own id.
 */
export function fallbackDocumentFilename(
  kind: DocumentKind,
  identifier: string,
  mimeType: string
): string {
  const ext = extensionForMimeType(mimeType);
  switch (kind) {
    case "purchase-order":
      return `purchase-order-${identifier}.${ext}`;
    case "goods-receipt":
      return `goods-receipt-${identifier}.${ext}`;
    case "invoice":
      return `invoice-${identifier}.${ext}`;
  }
}

/**
 * Triggers a browser "Save As" for a blob already in hand — object URL, a
 * detached `<a download>` click, then revoke on the next tick. Must only be
 * called from an event handler (a user gesture), never during render.
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export type DocumentPreviewKind = "pdf" | "image" | "unsupported";

/**
 * How the viewer dialog should render a given MIME type.
 * GET /invoices/:id/pdf streams the file's *stored* type — an uploaded scan
 * can be PNG or JPEG even though the endpoint name says "pdf"
 * (backend-docs/documents-api.md).
 */
export function isPreviewableMimeType(mimeType: string): DocumentPreviewKind {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "image/png" || normalized === "image/jpeg") return "image";
  return "unsupported";
}
