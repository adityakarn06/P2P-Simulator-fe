import { SupplierDetail } from "@/components/suppliers/supplier-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SupplierDetailPage({ params }: Props) {
  const { id } = await params;

  return <SupplierDetail id={id} />;
}
