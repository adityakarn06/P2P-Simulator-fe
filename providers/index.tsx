import { type ReactNode } from "react";
import { QueryProvider } from "./query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <TooltipProvider delay={300}>
        {children}
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryProvider>
  );
}
