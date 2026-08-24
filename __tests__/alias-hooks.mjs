/**
 * Companion hooks module for alias-loader.mjs.
 * Exports the ESM `resolve` hook that maps `@/…` to the project root.
 */

import { resolve as nodeResolve } from "node:path";

let root = "";

export function initialize(data) {
  root = data.root;
}

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }
  // Strip the `@/` prefix and resolve relative to the project root. The
  // specifier is usually extensionless (e.g. `@/lib/formatters`), which
  // Node's ESM resolver won't infer on its own, so try the .ts source file
  // and index form before falling back to the bare path. nextResolve is
  // async, so failures surface as rejections, not thrown errors.
  const abs = nodeResolve(root, specifier.slice(2));
  for (const candidate of [abs, `${abs}.ts`, `${abs}.tsx`, `${abs}/index.ts`]) {
    try {
      return await nextResolve(candidate, context);
    } catch {
      // try the next candidate
    }
  }
  return nextResolve(abs, context);
}
