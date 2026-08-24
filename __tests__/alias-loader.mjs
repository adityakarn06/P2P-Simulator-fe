/**
 * Node.js ESM resolution hook — rewrites `@/…` specifiers to absolute
 * file-system paths so `node --experimental-strip-types --test` can import
 * production Next.js modules that use the `@/` path alias.
 *
 * Register with:  node --import ./__tests__/alias-loader.mjs
 */

import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve as nodeResolve } from "node:path";

// Absolute path to the project root (one level above __tests__/)
const ROOT = nodeResolve(fileURLToPath(import.meta.url), "../..");

// register() accepts a string URL for the hooks module.
// We point it at the companion file that exports the actual `resolve` hook.
register(new URL("./alias-hooks.mjs", import.meta.url).href, {
  data: { root: ROOT },
});
