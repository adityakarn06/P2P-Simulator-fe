import { RequisitionDetail } from "@/features/requisitions/components/requisition-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RequisitionDetailPage({ params }: Props) {
  const { id } = await params;

  return <RequisitionDetail id={id} />;
}
