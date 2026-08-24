
// Formats an integer amount in paise (minor units) to an INR string.
export function formatCurrency(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

// Formats paise as a compact string (e.g. ₹1.82L, ₹18.2K).
export function formatCurrencyCompact(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(rupees);
}

// Formats an ISO 8601 timestamp as a locale date string.
export function formatDate(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

// Formats an ISO 8601 timestamp as a locale date-time string.
export function formatDateTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

// Formats an ISO 8601 timestamp as a human-readable relative time.
export function formatRelativeTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, "second");
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, "minute");
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, "hour");
  if (Math.abs(diffDay) < 30) return rtf.format(-diffDay, "day");

  // Fall back to formatted date for older timestamps
  return formatDate(date);
}

// Status labels
export function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
