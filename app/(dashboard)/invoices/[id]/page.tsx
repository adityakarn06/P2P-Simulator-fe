import { InvoiceDetail } from "@/components/invoices/invoice-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;

  return <InvoiceDetail id={id} />;
}
