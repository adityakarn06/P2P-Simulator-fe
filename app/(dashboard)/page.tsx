import { HugeiconsIcon } from "@hugeicons/react";
import {
  FileEditIcon,
  ShoppingCart01Icon,
  Invoice01Icon,
  PackageIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Procurement lifecycle simulator — manage requisitions, purchase orders, invoices and shipments end to end.",
};

const stages = [
  {
    title: "Requisitions",
    description: "Start a procurement via chat. The AI extracts requirements and finds the best supplier.",
    icon: FileEditIcon,
    href: "/requisitions",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "Purchase Orders",
    description: "Review, approve or reject auto-generated purchase orders once a supplier is selected.",
    icon: ShoppingCart01Icon,
    href: "/purchase-orders",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    title: "Invoices",
    description: "Upload supplier invoices. Gemini Vision extracts line items for three-way matching.",
    icon: Invoice01Icon,
    href: "/invoices",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    title: "Shipments",
    description: "Track goods in transit and simulate delivery with a goods receipt.",
    icon: PackageIcon,
    href: "/shipments",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

export default function DashboardPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Hero */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">P2P Simulator</h1>
        <p className="text-sm text-muted-foreground">
          Simulate the full Procure-to-Pay lifecycle end to end.
        </p>
      </div>

      {/* Stage cards */}
      <div className="grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        {stages.map((stage) => (
          <Card key={stage.href} className="group transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <div className={`mb-2 inline-flex size-10 items-center justify-center rounded-lg ${stage.bg}`}>
                <HugeiconsIcon
                  icon={stage.icon}
                  className={`size-5 ${stage.color}`}
                  strokeWidth={2}
                />
              </div>
              <CardTitle className="text-base">{stage.title}</CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                {stage.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={stage.href} className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}>Go to {stage.title}</Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
