"use client";

import { usePaymentList } from "@/hooks/use-payment-list";
import { PageHeader } from "@/components/common/page-header";
import { PaymentsTable } from "@/components/payments/payments-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PaymentListTab } from "@/store/payment-store";
import { CreditCardIcon } from "@/lib/icons";

const EMPTY_COPY: Record<PaymentListTab, string> = {
  all: "Payments appear once an invoice passes three-way matching, or once an approver authorizes an amount while resolving an exception.",
  partial: "No short payments have been settled. A partial payment is recorded when an approver pays for what actually arrived instead of the full invoice.",
  pending: "Nothing is awaiting settlement.",
  blocked: "Nothing has been refused by the payment gate.",
  failed: "No payment has failed at the provider.",
};

export default function PaymentsPage() {
  const { activeTab, setActiveTab, data, isLoading, isError, error, refetch } =
    usePaymentList();

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Payments"
        description="Settlement tranches. An invoice is not paid all-or-nothing, and a purchase order is not limited to one invoice — each row is one movement of money against both."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PaymentListTab)}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="partial" className="text-xs">Partial</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
          <TabsTrigger value="blocked" className="text-xs">Blocked</TabsTrigger>
          <TabsTrigger value="failed" className="text-xs">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      <PaymentsTable
        payments={data?.items ?? []}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={CreditCardIcon}
            title="No payments found"
            description={EMPTY_COPY[activeTab]}
            className="py-12"
          />
        }
      />

      {data?.nextCursor && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Showing first 50 results.
        </p>
      )}
    </div>
  );
}
