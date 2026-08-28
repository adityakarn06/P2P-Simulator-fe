"use client";

import type { ReactNode } from "react";
import { Lottie, LottieDisplay, LottieError, LottieLoading } from "lottie-react";

/**
 * The only module that imports `lottie-react`. Loaded through `next/dynamic`
 * with `ssr: false` by components/common/lottie-player.tsx, so the player and
 * the animation JSON stay out of the server render and out of the initial
 * bundle.
 *
 * `src` is a URL: the library fetches and caches it itself, so a decorative
 * animation is never bundled into the JS of a page that may not show it.
 */
export function LottieAnimation({
  src,
  fallback,
  loop = false,
  label,
}: {
  src: string;
  fallback: ReactNode;
  loop?: boolean;
  label?: string;
}) {
  return (
    <Lottie
      src={src}
      autoplay
      loop={loop}
      className="size-full"
      role="img"
      aria-label={label}
    >
      <LottieDisplay />
      {/* A missing or malformed animation falls back to the static mark rather
          than leaving an empty box — the payment state it decorates is rendered
          by the caller and is unaffected either way. */}
      <LottieError>{fallback}</LottieError>
      <LottieLoading showAfter={400}>{fallback}</LottieLoading>
    </Lottie>
  );
}
