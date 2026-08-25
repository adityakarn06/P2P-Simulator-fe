"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  buildRoute,
  pointAt,
  pathUpTo,
  easeInOutCubic,
  DELHI,
  KOLKATA,
  type LngLat,
} from "@/lib/map/route";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const ANIMATION_DURATION_MS = 10_000;

// Padding (px) kept around the route so Delhi/Kolkata never sit flush
// against the card edge. The camera itself is still computed once, at
// construction, from the route's bounds — never adjusted again afterwards
// (no fitBounds/flyTo/easeTo once the animation starts).
const CAMERA_PADDING = 36;

const ROUTE_SOURCE_ID = "shipment-route";
const ROUTE_PROGRESS_SOURCE_ID = "shipment-route-progress";

interface LineFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "LineString"; coordinates: LngLat[] };
}

function emptyLineFeature(): LineFeature {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}

function lineFeature(coords: LngLat[]): LineFeature {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
}

interface ShipmentMapProps {
  /** Called exactly once, after the truck reaches Kolkata. */
  onArrive: () => void;
  className?: string;
}

/**
 * Plays a fixed-camera, 10s animation of a truck travelling the Delhi →
 * Kolkata corridor along a smooth curved route (lib/map/route.ts), then
 * calls onArrive() once.
 *
 * This is a demo visualization, not real shipment geodata — the Shipment
 * model carries no origin/destination coordinates. It never touches
 * shipment state itself; the caller (useShipmentSection) records the real
 * delivery via POST /receipts/simulate after onArrive fires.
 *
 * Everything below the initial `map.on("load")` setup runs inside a single
 * requestAnimationFrame loop that mutates the map/marker imperatively and
 * never calls setState, so this component renders once and never re-renders
 * during the animation.
 */
export function ShipmentMap({ onArrive, className }: ShipmentMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onArriveRef = useRef(onArrive);

  useEffect(() => {
    onArriveRef.current = onArrive;
  }, [onArrive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const route = buildRoute();
    const bounds = route.points.reduce(
      (b, [lng, lat]) => b.extend([lng, lat]),
      new mapboxgl.LngLatBounds(route.points[0], route.points[0])
    );

    // `bounds` computes the camera once, synchronously, at construction —
    // this is the initial framing, not a mid-animation camera move, so it
    // doesn't violate the "fixed camera during the animation" requirement.
    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/light-v11",
      bounds,
      fitBoundsOptions: { padding: CAMERA_PADDING },
      interactive: false,
      attributionControl: false,
    });

    let rafId = 0;
    let firstFrameTime: number | null = null;
    let fired = false;
    let cancelled = false;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const truckEl = document.createElement("img");
    truckEl.src = "/truck.png";
    truckEl.alt = "";
    truckEl.style.width = "36px";
    truckEl.style.height = "36px";
    truckEl.style.objectFit = "contain";
    truckEl.style.transformOrigin = "center center";

    const marker = new mapboxgl.Marker({
      element: truckEl,
      rotationAlignment: "map",
      pitchAlignment: "map",
    })
      .setLngLat(DELHI)
      .addTo(map);

    function pinMarker(coord: LngLat) {
      const pinEl = document.createElement("img");
      pinEl.src = "/pin.png";
      pinEl.alt = "";
      pinEl.style.width = "28px";
      pinEl.style.height = "28px";
      pinEl.style.objectFit = "contain";
      return new mapboxgl.Marker({ element: pinEl, anchor: "bottom" })
        .setLngLat(coord)
        .addTo(map);
    }

    const startPin = pinMarker(DELHI);
    const destinationPin = pinMarker(KOLKATA);

    // truck.png faces east (0°); Mapbox marker rotation is clockwise from
    // north, so a due-east bearing (90°) needs 0° rotation — hence -90.
    function setTruck(coord: LngLat, bearing: number) {
      marker.setLngLat(coord);
      marker.setRotation(bearing - 90);
    }

    function drawRoute(driven: LngLat[]) {
      const progressSource = map.getSource(ROUTE_PROGRESS_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;
      progressSource?.setData(lineFeature(driven));
    }

    function finish() {
      if (fired || cancelled) return;
      fired = true;
      setTruck(KOLKATA, pointAt(route, 1).bearing);
      drawRoute(route.points);
      onArriveRef.current();
    }

    function frame(now: number) {
      if (cancelled) return;
      if (firstFrameTime === null) firstFrameTime = now;
      const elapsed = now - firstFrameTime;
      const rawT = Math.min(1, elapsed / ANIMATION_DURATION_MS);
      const easedT = easeInOutCubic(rawT);

      const { coord, bearing } = pointAt(route, easedT);
      setTruck(coord, bearing);
      drawRoute(pathUpTo(route, easedT));

      if (rawT >= 1) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    map.on("load", () => {
      if (cancelled) return;

      map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: lineFeature(route.points) });
      map.addLayer({
        id: ROUTE_SOURCE_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        paint: { "line-color": "#94a3b8", "line-width": 2, "line-dasharray": [1, 1.5] },
      });

      map.addSource(ROUTE_PROGRESS_SOURCE_ID, { type: "geojson", data: emptyLineFeature() });
      map.addLayer({
        id: ROUTE_PROGRESS_SOURCE_ID,
        type: "line",
        source: ROUTE_PROGRESS_SOURCE_ID,
        paint: { "line-color": "#2563eb", "line-width": 3 },
      });

      if (prefersReducedMotion) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(frame);
    });

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      marker.remove();
      startPin.remove();
      destinationPin.remove();
      map.remove();
    };
    // Intentionally empty: the map/animation is created once and onArrive is
    // read through a ref so a changing callback identity never restarts it.
  }, []);

  if (!MAPBOX_TOKEN) return null;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Map animation of a truck travelling from Delhi to Kolkata"
      className={className}
    />
  );
}
