export { apiClient } from "./client";
export type { RequestOptions, BinaryResponse } from "./client";

// API modules — one per pipeline stage
export * from "./requisitions";
export * from "./purchase-orders";
export * from "./shipments";
export * from "./receipts";
export * from "./invoices";
export * from "./exceptions";
export * from "./payments";
export * from "./audit-logs";
export * from "./documents";

// Catalog (read-only reference data)
export * from "./suppliers";

// Cross-cutting reads
export * from "./analytics";
