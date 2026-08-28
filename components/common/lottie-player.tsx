"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Plays a Lottie animation, with a static mark standing in whenever it cannot
 * or should not play.
 *
 * The player itself lives in lottie-animation.tsx and is loaded with
 * `ssr: false`, so neither `lottie-react` nor the animation document is part of
 * the server render or the initial bundle.
 *
 * Three cases render `fallback` instead: a viewer who prefers reduced motion
 * (the player is never even loaded), the moment before the chunk arrives, and
 * a load that failed. An animation confirming a payment must never be the thing
 * that breaks the card telling someone they were paid.
 */

const LottieAnimation = dynamic(
  () => import("@/components/common/lottie-animation").then((m) => m.LottieAnimation),
  { ssr: false }
);

interface LottiePlayerProps {
  /** Path under /public, e.g. "/animations/paid.json". Fetched by the player. */
  src: string;
  /** Rendered until the animation is ready, and instead of it under reduced motion. */
  fallback: ReactNode;
  loop?: boolean;
  className?: string;
  /** Accessible description of what the animation is saying. */
  label?: string;
}

export function LottiePlayer({
  src,
  fallback,
  loop = false,
  className,
  label,
}: LottiePlayerProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className={cn("flex items-center justify-center", className)}>
      {reducedMotion ? (
        <span aria-label={label} role="img">
          {fallback}
        </span>
      ) : (
        <LottieAnimation src={src} loop={loop} label={label} fallback={fallback} />
      )}
    </div>
  );
}
