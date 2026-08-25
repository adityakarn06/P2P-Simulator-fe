import { ExceptionDetail } from "@/components/exceptions/exception-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ExceptionDetailPage({ params }: Props) {
  const { id } = await params;

  // `key` forces a full remount on navigation between exceptions — without
  // it, useResolveException's mutation state (resolveResult) would survive
  // across ids and could show the payment-processing banner for the wrong
  // exception. See ExceptionResolutionPanel in exception-detail.tsx.
  return <ExceptionDetail id={id} key={id} />;
}
