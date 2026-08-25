"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { categorizeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert01Icon,
  Wifi01Icon,
  File01Icon,
  Cancel01Icon,
  RefreshIcon,
} from "@/lib/icons";

const errorIconMap = {
  network: Wifi01Icon,
  auth: Cancel01Icon,
  notFound: File01Icon,
  validation: Alert01Icon,
  server: Alert01Icon,
  unknown: Alert01Icon,
} as const;

interface InlineErrorProps {
  error: unknown;
  className?: string;
}

export function InlineError({ error, className }: InlineErrorProps) {
  const appError = categorizeError(error);
  return (
    <p className={cn("text-sm text-destructive", className)}>
      {appError.details ?? appError.message}
    </p>
  );
}

interface ErrorStateProps {
  error: unknown;
  /** Called when the user clicks "Try Again" — only shown when retryable */
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const appError = categorizeError(error);
  const Icon = errorIconMap[appError.type] ?? Alert01Icon;

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center p-8",
        className
      )}
    >
      <Card className="mx-auto w-full max-w-md border-destructive/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Icon}
              className="size-5 shrink-0 text-destructive"
            />
            <CardTitle className="text-destructive text-base">
              {appError.message}
            </CardTitle>
          </div>
          {appError.details && (
            <CardDescription>{appError.details}</CardDescription>
          )}
        </CardHeader>

        {(appError.retryable || onRetry) && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {appError.retryable
                ? "This may be a temporary issue. You can try again."
                : "Please contact support if this issue persists."}
            </p>
          </CardContent>
        )}

        {onRetry && appError.retryable && (
          <CardFooter>
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <HugeiconsIcon icon={RefreshIcon} className="size-4" />
              Try Again
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
