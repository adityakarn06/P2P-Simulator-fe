import { ProductDetail } from "@/components/suppliers/product-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;

  return <ProductDetail id={id} />;
}
