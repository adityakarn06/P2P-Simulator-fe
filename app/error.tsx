"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Alert01Icon,
    RefreshIcon,
    Home01Icon
} from "@/lib/icons";
import Link from "next/link";
import { categorizeError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const appError = categorizeError(error);

    useEffect(() => {
        // Log error for debugging/monitoring
        console.error("Application error:", error);
    }, [error]);

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="mx-auto w-full max-w-xl border-destructive/50">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Alert01Icon} className="size-5 text-destructive" />
                        <CardTitle className="text-destructive">
                            {appError.message}
                        </CardTitle>
                    </div>
                    <CardDescription>
                        {appError.details || "Something went wrong"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        {appError.retryable
                            ? "This could be a temporary issue. Please try again."
                            : "Please try again later or contact support if the issue persists."}
                    </p>
                    {error.digest && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            Error ID: {error.digest}
                        </p>
                    )}
                </CardContent>
                <CardFooter className="flex gap-2">
                    {appError.retryable && (
                        <Button onClick={reset} className="flex-1" variant="default">
                            <HugeiconsIcon icon={RefreshIcon} className="h-4 w-4 mr-2" />
                            Try Again
                        </Button>
                    )}
                    <Link
                        href="/dashboard"
                        className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
                    >
                        <HugeiconsIcon icon={Home01Icon} className="h-4 w-4 mr-2" />
                        Go Home
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
