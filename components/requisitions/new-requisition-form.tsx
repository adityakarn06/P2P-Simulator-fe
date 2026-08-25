"use client";

import { useRouter } from "next/navigation";
import { RequisitionComposer } from "@/components/requisitions/requisition-composer";
import { useCreateRequisition } from "@/hooks/use-requisitions";
import { useRequisitionComposerDraft } from "@/hooks/use-requisition-composer-draft";
import { Button } from "@/components/ui/button";

const NEW_REQUISITION_DRAFT_KEY = "new";

interface QuickStartOption {
  label: string;
  description: string;
  prompt: string;
}

const QUICK_START_OPTIONS: QuickStartOption[] = [
  {
    label: "Keyboards",
    description: "TechSource wins — ₹1,820, 5-day delivery",
    prompt: "I need 100 wireless keyboards under ₹2000 each within 7 days",
  },
  {
    label: "Wireless mice",
    description: "TechSource wins — ₹450, 4-day delivery",
    prompt: "Order 50 wireless mice under ₹500 each within 6 days",
  },
  {
    label: "USB headsets",
    description: "BudgetBulk wins — ₹1,200, 3-day delivery",
    prompt: "Need 100 USB headsets under ₹1500 each within 5 days",
  },
  {
    label: "A4 paper",
    description: "BudgetBulk wins — ₹240, 2-day delivery",
    prompt: "Order 200 reams of A4 paper under ₹300 each within 4 days",
  },
];

export function NewRequisitionForm() {
  const router = useRouter();
  const { mutate, isPending, error, reset } = useCreateRequisition();
  const { clear: clearDraft } = useRequisitionComposerDraft(NEW_REQUISITION_DRAFT_KEY);

  const handleSend = (input: string) => {
    mutate(
      { input },
      {
        onSuccess: (data) => {
          // Do not branch on `data.status` / `data.requirements` here — the
          // detail screen re-reads the truth from GET /requisitions/:id.
          clearDraft();
          router.push(`/requisitions/${data.requisitionId}`);
        },
      }
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="space-y-1.5 pb-8">
        <h2 className="text-2xl font-semibold">What do you need to procure?</h2>
      </div>

      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {QUICK_START_OPTIONS.map((option, index) => (
          <Button
            key={option.label}
            type="button"
            variant="outline"
            style={{ animationDelay: `${index * 75}ms`, animationFillMode: "backwards" }}
            className="h-auto flex-col items-start gap-0.5 whitespace-normal px-3 py-2.5 text-left animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500 ease-out"
            disabled={isPending}
            onClick={() => handleSend(option.prompt)}
          >
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-xs font-normal text-muted-foreground">{option.description}</span>
          </Button>
        ))}
      </div>

      <div
        style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
        className="w-full origin-top animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500 ease-out"
      >
        <RequisitionComposer
          storeKey={NEW_REQUISITION_DRAFT_KEY}
          placeholder="e.g. 100 wireless keyboards under ₹2000 each, delivered within 7 days…"
          onSend={handleSend}
          isPending={isPending}
          error={error}
          onRetry={reset}
          autoFocus
        />
      </div>
    </div>
  );
}
