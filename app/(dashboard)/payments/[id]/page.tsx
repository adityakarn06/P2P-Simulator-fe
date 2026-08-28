import { PaymentDetail } from "@/components/payments/payment-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaymentDetailPage({ params }: Props) {
  const { id } = await params;

  return <PaymentDetail id={id} />;
}
