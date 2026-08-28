export { apiClient } from "./client";
export type { RequestOptions, BinaryResponse } from "./client";

// API modules — one per pipeline stage
export * from "./requisitions";
export * from "./purchase-orders";
export * from "./shipments";
export * from "./receipts";
export * from "./invoices";
export * from "./exceptions";
export * from "./audit-logs";
export * from "./documents";

// Cross-cutting reads
export * from "./analytics";
