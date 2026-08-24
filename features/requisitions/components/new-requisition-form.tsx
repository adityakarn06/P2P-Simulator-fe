"use client";

import { useRouter } from "next/navigation";
import { RequisitionComposer } from "@/features/requisitions/components/requisition-composer";
import { useCreateRequisition } from "@/hooks/use-requisitions";

export function NewRequisitionForm() {
  const router = useRouter();
  const { mutate, isPending, error, reset } = useCreateRequisition();

  const handleSend = (input: string) => {
    mutate(
      { input },
      {
        onSuccess: (data) => {
          // Do not branch on `data.status` / `data.requirements` here — the
          // detail screen re-reads the truth from GET /requisitions/:id.
          router.push(`/requisitions/${data.requisitionId}`);
        },
      }
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold">What do you need to procure?</h2>
        <p className="text-sm text-muted-foreground">
          Describe it in plain language — product, quantity, budget, and timeline if you know
          them. The assistant will ask for anything missing.
        </p>
      </div>

      <RequisitionComposer
        placeholder="e.g. 100 wireless keyboards under ₹2000 each, delivered within 7 days…"
        onSend={handleSend}
        isPending={isPending}
        error={error}
        onRetry={reset}
        autoFocus
      />
    </div>
  );
}
