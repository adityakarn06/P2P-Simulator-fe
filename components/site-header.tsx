"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SEGMENT_LABELS: Record<string, string> = {
  "": "Home",
  "requisitions": "Requisitions",
  "purchase-orders": "Purchase Orders",
  "invoices": "Invoices",
  "shipments": "Shipments",
  "receipts": "Receipts",
  "activity": "Activity",
  "settings": "Settings",
  "help": "Help",
};

function getLabel(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SiteHeader() {
  const pathname = usePathname();

  // Split pathname into segments, filter empty strings
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {segments.length === 0 ? (
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              )}
            </BreadcrumbItem>

            {segments.map((segment, idx) => {
              const isLast = idx === segments.length - 1;
              const href = "/" + segments.slice(0, idx + 1).join("/");
              const label = getLabel(segment);

              return (
                <span key={href} className="flex items-center gap-1.5">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
