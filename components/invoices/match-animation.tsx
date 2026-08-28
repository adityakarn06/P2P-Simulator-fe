"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert01Icon,
  Invoice01Icon,
  PackageIcon,
  ShoppingCart01Icon,
  TickDouble01Icon,
} from "@/lib/icons";
import { Spinner } from "@/components/common/loading-state";
import {
  MATCH_STEP_MS,
  finalPhase,
  getFailingNodes,
  getMatchAriaLabel,
  getMatchNodes,
  getMatchVerdict,
  getNodeState,
  getNodeTone,
  isConnectorDrawn,
  isVerdictVisible,
  nextPhase,
  type MatchNode,
  type MatchNodeKey,
  type MatchDisplayOutcome,
  type MatchNodeTone,
  type MatchPhase,
} from "@/lib/state/match-animation";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useMatchAnimationStore } from "@/store/match-store";
import { cn } from "@/lib/utils";
import type { ExceptionType } from "@/types/models";

const NODE_ICONS: Record<MatchNodeKey, typeof ShoppingCart01Icon> = {
  purchaseOrder: ShoppingCart01Icon,
  goodsReceipt: PackageIcon,
  invoice: Invoice01Icon,
};

const RING_SIZE = 96;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const TONE_RING: Record<MatchNodeTone, string> = {
  neutral: "stroke-primary",
  success: "stroke-emerald-500",
  failure: "stroke-amber-500",
  unavailable: "stroke-muted-foreground/40",
};

const TONE_ICON: Record<MatchNodeTone, string> = {
  neutral: "text-primary",
  success: "text-emerald-600 dark:text-emerald-400",
  failure: "text-amber-600 dark:text-amber-400",
  unavailable: "text-muted-foreground",
};

const VERDICT_TONE: Record<
  ReturnType<typeof getMatchVerdict>["tone"],
  { text: string; border: string; bg: string }
> = {
  success: {
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
  },
  warning: {
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
  },
  error: {
    text: "text-destructive",
    border: "border-destructive/40",
    bg: "bg-destructive/5",
  },
  progress: {
    text: "text-muted-foreground",
    border: "border-primary/40",
    bg: "bg-primary/5",
  },
};

/**
 * Advances the phase on a timer chain, or reports the finished state outright
 * when the viewer prefers reduced motion or this invoice's reveal has already
 * played.
 *
 * The outcome is read on every tick rather than captured once: matching
 * resolves while the section is on screen, and a sequence that started as
 * "pending" must be allowed to run on into the verdict the moment one arrives.
 */
function useMatchPhase(invoiceId: string, outcome: MatchDisplayOutcome): MatchPhase {
  const hasPlayed = useMatchAnimationStore((s) => Boolean(s.playedInvoiceIds[invoiceId]));
  const markPlayed = useMatchAnimationStore((s) => s.markPlayed);
  const reducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = useState<MatchPhase>("idle");

  // Skipping is decided during render rather than by writing state from an
  // effect: nothing is being synchronised, the answer is simply already known.
  const skip = reducedMotion || hasPlayed;
  const current = skip ? finalPhase(outcome) : phase;

  useEffect(() => {
    if (skip) return;

    const upcoming = nextPhase(current, outcome);
    if (upcoming == null) {
      // Rest reached. Only a real verdict is worth remembering — a sequence
      // that stopped at "pending" should replay when matching finishes.
      if (outcome !== "pending") markPlayed(invoiceId);
      return;
    }

    const timer = setTimeout(() => setPhase(upcoming), MATCH_STEP_MS);
    return () => clearTimeout(timer);
  }, [current, outcome, skip, invoiceId, markPlayed]);

  return current;
}

interface MatchRingProps {
  node: MatchNode;
  phase: MatchPhase;
  tone: MatchNodeTone;
}

function MatchRing({ node, phase, tone }: MatchRingProps) {
  const state = getNodeState(node.key, phase);
  const drawn = state === "drawing" || state === "done";

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_STROKE}
            className="stroke-muted"
            strokeDasharray={node.present ? undefined : "4 6"}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            className={cn(
              "transition-[stroke-dashoffset,stroke] duration-700 ease-out motion-reduce:transition-none",
              TONE_RING[tone]
            )}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={drawn ? 0 : RING_CIRCUMFERENCE}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <HugeiconsIcon
            icon={NODE_ICONS[node.key]}
            className={cn(
              "size-7 transition-colors duration-500 motion-reduce:transition-none",
              drawn ? TONE_ICON[tone] : "text-muted-foreground/50"
            )}
          />
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs font-medium">{node.label}</p>
        {!node.present && <p className="text-[11px] text-muted-foreground">Not recorded</p>}
      </div>
    </div>
  );
}

function Connector({ drawn }: { drawn: boolean }) {
  return (
    <div
      className="h-0.5 min-w-4 flex-1 rounded-full bg-muted"
      style={{ marginTop: RING_SIZE / 2 - 1 }}
      aria-hidden
    >
      <div
        className={cn(
          "h-full origin-left rounded-full bg-primary/60 transition-transform duration-700 ease-out motion-reduce:transition-none",
          drawn ? "scale-x-100" : "scale-x-0"
        )}
      />
    </div>
  );
}

interface MatchAnimationProps {
  /** Keys the "already played" flag, so the reveal runs once per invoice. */
  invoiceId: string;
  outcome: MatchDisplayOutcome;
  hasReceipt: boolean;
  /** Types of the invoice's *open* exceptions — decides which ring reddens. */
  openExceptionTypes: ExceptionType[];
  className?: string;
}

/**
 * The three-way match as three rings that draw in sequence and connect, ending
 * in the backend's verdict.
 *
 * The verdict comes from `outcome` (matchOutcome → the invoice's real status
 * plus its open exceptions), never from the drawing. A ring only reddens when
 * an open exception actually implicates that document, and a document that
 * does not exist yet — typically a goods receipt before delivery — is drawn
 * dashed and grey rather than as a failed check.
 */
export function MatchAnimation({
  invoiceId,
  outcome,
  hasReceipt,
  openExceptionTypes,
  className,
}: MatchAnimationProps) {
  const phase = useMatchPhase(invoiceId, outcome);
  const nodes = getMatchNodes({
    hasPurchaseOrder: true,
    hasReceipt,
    hasInvoice: true,
  });
  const failingNodes = getFailingNodes(openExceptionTypes);
  const verdict = getMatchVerdict(outcome, hasReceipt);
  const verdictShown = isVerdictVisible(phase);
  const tone = VERDICT_TONE[verdict.tone];

  return (
    <div
      className={cn("space-y-4 rounded-lg border p-6", className)}
      role="img"
      aria-label={getMatchAriaLabel(outcome, hasReceipt)}
    >
      <div className="flex items-start justify-center gap-2 sm:gap-4">
        {nodes.map((node, index) => (
          <div key={node.key} className="contents">
            <MatchRing
              node={node}
              phase={phase}
              tone={getNodeTone(node, outcome, failingNodes)}
            />
            {index < nodes.length - 1 && (
              <Connector drawn={isConnectorDrawn(index, phase)} />
            )}
          </div>
        ))}
      </div>

      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border p-3 text-sm transition-opacity duration-500 motion-reduce:transition-none",
          tone.border,
          tone.bg,
          verdictShown || outcome === "pending" ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="mt-0.5 shrink-0">
          {outcome === "pending" ? (
            <Spinner size="sm" />
          ) : (
            <HugeiconsIcon
              icon={outcome === "passed" ? TickDouble01Icon : Alert01Icon}
              className={cn("size-4", tone.text)}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", tone.text)}>{verdict.title}</p>
          <p className="text-pretty text-muted-foreground">{verdict.detail}</p>
        </div>
      </div>
    </div>
  );
}
