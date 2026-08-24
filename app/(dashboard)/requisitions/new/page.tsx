import { PageHeader } from "@/components/page-header";
import { NewRequisitionForm } from "@/features/requisitions/components/new-requisition-form";

export default function NewRequisitionPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="New Requisition"
        description="Start a new procurement request via the AI-powered chat interface."
      />
      <NewRequisitionForm />
    </div>
  );
}
