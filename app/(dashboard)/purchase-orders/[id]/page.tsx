import { PurchaseOrderDetail } from "@/components/purchase-orders/purchase-order-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PurchaseOrderDetailPage({ params }: Props) {
  const { id } = await params;

  return <PurchaseOrderDetail id={id} />;
}
