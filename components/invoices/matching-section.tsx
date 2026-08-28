"use client";

import { SkeletonLines } from "@/components/common/loading-state";
import { InlineError } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { ThreeWayMatchPanel } from "@/components/invoices/three-way-match-panel";
import { usePurchaseOrder } from "@/hooks/use-purchase-orders";
import { useShipment } from "@/hooks/use-shipments";
import { useInvoices } from "@/hooks/use-invoices";
import { useExceptions } from "@/hooks/use-exceptions";
import { getInvoicePollInterval } from "@/lib/state/invoice-state";
import { Invoice01Icon } from "@/lib/icons";
import type { PurchaseOrder } from "@/types/models";

/**
 * The matching stage of the requisition workflow: the purchase order, the
 * goods receipt and the uploaded invoice, side by side.
 *
 * Every query here is already in cache from the shipment and invoice sections
 * above it on the same screen, so this section costs nothing extra to render —
 * it re-reads the same keys rather than fetching its own copies.
 *
 * Scoped to `source: "UPLOADED"`: a GENERATED invoice is rendered from the
 * purchase order's own numbers and never enters matching, so comparing one
 * back to its PO would show a perfect match that means nothing.
 */
export function MatchingSection({ purchaseOrder }: { purchaseOrder: PurchaseOrder }) {
  const poDetail = usePurchaseOrder(purchaseOrder.id);
  const shipmentId = poDetail.data?.shipment?.id ?? "";
  const shipment = useShipment(shipmentId, { enabled: Boolean(shipmentId) });

  const invoices = useInvoices(
    { purchaseOrderId: purchaseOrder.id, source: "UPLOADED", limit: 50 },
    {
      refetchInterval: (query) => {
        const latest = query.state.data?.items[0];
        return latest ? getInvoicePollInterval(latest.status, latest.source) : false;
      },
    }
  );

  // The most recent upload is the one matching acted on.
  const invoice = invoices.data?.items[0];

  const exceptions = useExceptions(
    { entityId: invoice?.id, limit: 100 },
    { enabled: Boolean(invoice) }
  );

  if (invoices.isLoading) return <SkeletonLines />;
  if (invoices.isError) return <InlineError error={invoices.error} />;

  if (!invoice) {
    return (
      <EmptyState
        icon={Invoice01Icon}
        title="Nothing to match yet"
        description="Upload the supplier invoice above to run three-way matching."
        className="p-6"
      />
    );
  }

  return (
    <ThreeWayMatchPanel
      purchaseOrder={purchaseOrder}
      goodsReceipt={shipment.data?.goodsReceipt ?? null}
      invoice={invoice}
      exceptions={exceptions.data?.items ?? []}
    />
  );
}
