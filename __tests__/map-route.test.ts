/**
 * Route-math tests for the shipment simulation animation.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Exercises the real module at lib/map/route.ts directly — no inlined
 * copies. Covers: route endpoints match Delhi/Kolkata, t is monotonic in
 * arc-length (constant-speed interpolation), bearing stays in [0, 360),
 * and sampled steps are near-uniform in length.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildRoute, pointAt, easeInOutCubic, DELHI, KOLKATA } from "@/lib/map/route";

describe("buildRoute", () => {
  test("starts at Delhi and ends at Kolkata", () => {
    const path = buildRoute();
    assert.deepEqual(path.points[0], DELHI);
    assert.deepEqual(path.points[path.points.length - 1], KOLKATA);
  });

  test("cumulative length is monotonically non-decreasing and matches totalLength", () => {
    const path = buildRoute();
    for (let i = 1; i < path.cumulative.length; i++) {
      assert.ok(path.cumulative[i] >= path.cumulative[i - 1]);
    }
    assert.equal(path.cumulative[path.cumulative.length - 1], path.totalLength);
    assert.ok(path.totalLength > 0);
  });

  test("consecutive sample points are near-uniform in spacing (no huge gaps/clusters)", () => {
    const path = buildRoute();
    const stepLengths: number[] = [];
    for (let i = 1; i < path.points.length; i++) {
      stepLengths.push(path.cumulative[i] - path.cumulative[i - 1]);
    }
    const mean = stepLengths.reduce((a, b) => a + b, 0) / stepLengths.length;
    const max = Math.max(...stepLengths);
    // No single raw sample step should be wildly larger than the mean —
    // guards against the spline blowing up between distant waypoints.
    assert.ok(max < mean * 10, `max step ${max} vs mean ${mean}`);
  });
});

describe("pointAt", () => {
  test("t=0 resolves to Delhi, t=1 resolves to Kolkata", () => {
    const path = buildRoute();
    const start = pointAt(path, 0);
    const end = pointAt(path, 1);
    assert.ok(Math.abs(start.coord[0] - DELHI[0]) < 1e-6);
    assert.ok(Math.abs(start.coord[1] - DELHI[1]) < 1e-6);
    assert.ok(Math.abs(end.coord[0] - KOLKATA[0]) < 1e-6);
    assert.ok(Math.abs(end.coord[1] - KOLKATA[1]) < 1e-6);
  });

  test("t is monotonic in distance along the route (constant-speed interpolation)", () => {
    const path = buildRoute();
    const samples = Array.from({ length: 21 }, (_, i) => i / 20);
    let prevDistFromStart = -1;
    for (const t of samples) {
      const { coord } = pointAt(path, t);
      const dx = coord[0] - DELHI[0];
      const dy = coord[1] - DELHI[1];
      const distFromStart = Math.sqrt(dx * dx + dy * dy);
      // Arc-length-based t should trend outward from Delhi; allow tiny
      // float slack but expect no large regressions given the corridor
      // doesn't double back on itself.
      assert.ok(
        distFromStart >= prevDistFromStart - 0.05,
        `t=${t} regressed: ${distFromStart} < ${prevDistFromStart}`
      );
      prevDistFromStart = distFromStart;
    }
  });

  test("equal steps in t cover roughly equal arc-length (constant speed)", () => {
    const path = buildRoute();
    const steps = 10;
    const lengths: number[] = [];
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const p0 = pointAt(path, t0).coord;
      const p1 = pointAt(path, t1).coord;
      lengths.push(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]));
    }
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    for (const len of lengths) {
      // Each equal-t segment should be within ~30% of the mean arc-length —
      // loose enough to tolerate the corridor's curvature, tight enough to
      // catch a non-arc-length (naive parameter) interpolation regression.
      assert.ok(Math.abs(len - mean) / mean < 0.3, `segment length ${len} vs mean ${mean}`);
    }
  });

  test("bearing is always within [0, 360)", () => {
    const path = buildRoute();
    for (let i = 0; i <= 20; i++) {
      const { bearing } = pointAt(path, i / 20);
      assert.ok(bearing >= 0 && bearing < 360, `bearing ${bearing} out of range`);
    }
  });

  test("clamps t outside [0, 1]", () => {
    const path = buildRoute();
    const below = pointAt(path, -0.5);
    const above = pointAt(path, 1.5);
    const start = pointAt(path, 0);
    const end = pointAt(path, 1);
    assert.deepEqual(below.coord, start.coord);
    assert.deepEqual(above.coord, end.coord);
  });
});

describe("easeInOutCubic", () => {
  test("endpoints are fixed", () => {
    assert.equal(easeInOutCubic(0), 0);
    assert.equal(easeInOutCubic(1), 1);
  });

  test("midpoint is 0.5 (symmetric easing)", () => {
    assert.equal(easeInOutCubic(0.5), 0.5);
  });

  test("is monotonically non-decreasing", () => {
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = easeInOutCubic(i / 20);
      assert.ok(v >= prev);
      prev = v;
    }
  });

  test("clamps outside [0, 1]", () => {
    assert.equal(easeInOutCubic(-1), 0);
    assert.equal(easeInOutCubic(2), 1);
  });
});
