import { ZodError } from "zod";

export type ErrorType = "validation" | "network" | "auth" | "notFound" | "server" | "unknown";

export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  retryable: boolean;
}

export function categorizeError(error: unknown): AppError {
  // Zod validation errors
  if (error instanceof ZodError) {
    const messages = error.issues.map((e) => e.message).join(", ");
    return {
      type: "validation",
      message: "Validation Error",
      details: messages,
      retryable: false,
    };
  }

  // Standard Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("timeout") ||
      message.includes("econnrefused")
    ) {
      return {
        type: "network",
        message: "Connection Error",
        details: "Please check your internet connection and try again.",
        retryable: true,
      };
    }

    // Auth errors
    if (
      message.includes("unauthorized") ||
      message.includes("401") ||
      message.includes("forbidden") ||
      message.includes("403")
    ) {
      return {
        type: "auth",
        message: "Authentication Error",
        details: "Your session may have expired. Please log in again.",
        retryable: false,
      };
    }

    // Not found errors
    if (message.includes("not found") || message.includes("404")) {
      return {
        type: "notFound",
        message: "Not Found",
        details: "The requested resource could not be found.",
        retryable: false,
      };
    }

    // Server errors
    if (message.includes("500") || message.includes("server error")) {
      return {
        type: "server",
        message: "Server Error",
        details: "Something went wrong on our end. Please try again later.",
        retryable: true,
      };
    }

    // Generic error with message
    return {
      type: "unknown",
      message: "Something went wrong",
      details: error.message,
      retryable: true,
    };
  }

  // Unknown error type
  return {
    type: "unknown",
    message: "An unexpected error occurred",
    details: "Please try again or contact support if the issue persists.",
    retryable: true,
  };
}

export function getErrorMessage(error: unknown): string {
  const appError = categorizeError(error);
  return appError.details || appError.message;
}

export function isRetryable(error: unknown): boolean {
  return categorizeError(error).retryable;
}

export function formatZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}
