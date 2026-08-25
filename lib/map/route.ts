/**
 * Delhi → Kolkata shipment-corridor route math for the shipment simulation
 * animation (components/shipments/shipment-map.tsx).
 *
 * Pure math, no React and no Mapbox — kept separate so it's unit-testable
 * with plain node:test (see __tests__/map-route.test.ts), matching the
 * lib/state/*-state.ts convention of React-free derivation modules.
 *
 * The route is a fixed demo visualization, not real shipment geodata — the
 * Shipment model (types/models.ts) carries no origin/destination/lat-lng.
 */

/** [lng, lat] pairs, matching Mapbox/GeoJSON coordinate order throughout. */
export type LngLat = [number, number];

export interface RoutePath {
  /** Densely sampled, constant-arc-spacing points along the curved route. */
  points: LngLat[];
  /** Cumulative great-circle-ish distance (in the same units as points) up to points[i]. */
  cumulative: number[];
  /** cumulative[cumulative.length - 1] */
  totalLength: number;
}

export interface RoutePosition {
  coord: LngLat;
  /** Compass bearing in degrees, 0–360, direction of travel at this point. */
  bearing: number;
}

export const DELHI: LngLat = [77.209, 28.6139];
export const KOLKATA: LngLat = [88.3639, 22.5726];

/**
 * Waypoints roughly tracing the NH19 corridor so the curve reads as a real
 * shipment lane (Delhi → Agra → Kanpur → Prayagraj → Varanasi → Dhanbad →
 * Kolkata) rather than a generic great-circle arc.
 */
export const ROUTE_WAYPOINTS: LngLat[] = [
  DELHI,
  [78.0081, 27.1767], // Agra
  [80.3319, 26.4499], // Kanpur
  [81.8463, 25.4358], // Prayagraj
  [83.0, 25.3176], // Varanasi
  [86.4304, 23.7957], // Dhanbad
  KOLKATA,
];

const SAMPLE_COUNT = 400;

/**
 * Catmull-Rom spline interpolation through 4 control points at parameter t
 * in [0, 1], evaluated independently per coordinate axis.
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function catmullRomPoint(pts: LngLat[], i: number, t: number): LngLat {
  const p0 = pts[Math.max(i - 1, 0)];
  const p1 = pts[i];
  const p2 = pts[Math.min(i + 1, pts.length - 1)];
  const p3 = pts[Math.min(i + 2, pts.length - 1)];
  return [catmullRom(p0[0], p1[0], p2[0], p3[0], t), catmullRom(p0[1], p1[1], p2[1], p3[1], t)];
}

/** Flat-earth approximation, fine for interpolation/bearing over this distance scale. */
function distance(a: LngLat, b: LngLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function bearingBetween(a: LngLat, b: LngLat): number {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Builds a smooth curved path through ROUTE_WAYPOINTS by sampling a
 * Catmull-Rom spline, plus a cumulative arc-length table so pointAt() can
 * interpolate at constant speed (raw parameter-t samples are NOT
 * equal-arc-length — they bunch up on tight curves and spread out on
 * straight segments).
 */
export function buildRoute(waypoints: LngLat[] = ROUTE_WAYPOINTS): RoutePath {
  const segments = waypoints.length - 1;
  const points: LngLat[] = [];

  for (let i = 0; i < segments; i++) {
    const stepsInSegment = Math.round(SAMPLE_COUNT / segments);
    for (let s = 0; s < stepsInSegment; s++) {
      const t = s / stepsInSegment;
      points.push(catmullRomPoint(waypoints, i, t));
    }
  }
  points.push(waypoints[waypoints.length - 1]);

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
  }

  return { points, cumulative, totalLength: cumulative[cumulative.length - 1] };
}

/**
 * Cubic ease-in-out, applied to the raw elapsed/duration fraction before
 * calling pointAt so the truck accelerates away from Delhi and decelerates
 * into Kolkata instead of moving at a constant on-screen speed.
 */
export function easeInOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
}

/**
 * Resolves the coordinate + direction of travel at arc-length fraction t
 * (0 = start, 1 = end) via binary search over the cumulative-length table,
 * so animation speed is constant along the curve regardless of how sample
 * density varies segment to segment.
 */
export function pointAt(path: RoutePath, t: number): RoutePosition {
  const { points, cumulative, totalLength } = path;
  const clampedT = Math.min(1, Math.max(0, t));
  const targetLength = clampedT * totalLength;

  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] < targetLength) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const upper = Math.max(lo, 1);
  const lower = upper - 1;

  const segLength = cumulative[upper] - cumulative[lower];
  const segT = segLength > 0 ? (targetLength - cumulative[lower]) / segLength : 0;

  const a = points[lower];
  const b = points[upper];
  const coord: LngLat = [a[0] + (b[0] - a[0]) * segT, a[1] + (b[1] - a[1]) * segT];
  const bearing = bearingBetween(a, b);

  return { coord, bearing };
}
