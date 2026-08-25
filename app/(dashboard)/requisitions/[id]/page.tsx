import { RequisitionDetail } from "@/components/requisitions/requisition-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RequisitionDetailPage({ params }: Props) {
  const { id } = await params;

  return <RequisitionDetail id={id} />;
}
