/**
 * MAP DISPLAY — MapLibre GL JS with OpenFreeMap tiles (free, no API key).
 *
 * This only draws a map. Turning ZIP codes / addresses into coordinates
 * (geocoding) is done on the server with the Google Geocoding API
 * (server/_core/map.ts); OpenFreeMap does not provide geocoding.
 *
 * Usage:
 *   <MapView
 *     className="h-80"
 *     initialCenter={{ lat: 40.7128, lng: -74.006 }}
 *     initialZoom={11}
 *     onMapReady={(map) => {
 *       new maplibregl.Marker().setLngLat([-74.006, 40.7128]).addTo(map);
 *     }}
 *   />
 *
 * Attribution ("OpenFreeMap", "© OpenMapTiles", "Data from OpenStreetMap") is
 * supplied by the style and shown by the map's attribution control. Keep it visible.
 */
import { useEffect, useRef } from "react";
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/utils";

// Vite worker setup (once per page load).
setWorkerUrl(workerUrl);

/** OpenFreeMap vector styles. */
export const OPENFREEMAP_STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
  positron: "https://tiles.openfreemap.org/styles/positron",
} as const;

export type MapLatLng = { lat: number; lng: number };

interface MapViewProps {
  className?: string;
  initialCenter?: MapLatLng;
  initialZoom?: number;
  /** One of the OpenFreeMap styles, or a full style URL you host yourself. */
  mapStyle?: keyof typeof OPENFREEMAP_STYLES | (string & {});
  onMapReady?: (map: MapLibreMap) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  mapStyle = "liberty",
  onMapReady,
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  // Keep the latest callback without re-creating the map when it changes.
  const onReady = useRef(onMapReady);
  onReady.current = onMapReady;

  useEffect(() => {
    if (!container.current) return;
    const style =
      mapStyle in OPENFREEMAP_STYLES
        ? OPENFREEMAP_STYLES[mapStyle as keyof typeof OPENFREEMAP_STYLES]
        : mapStyle;
    // MapLibre takes [longitude, latitude].
    const map = new MapLibreMap({
      container: container.current,
      style,
      center: [initialCenter.lng, initialCenter.lat],
      zoom: initialZoom,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    onReady.current?.(map);
    return () => map.remove();
    // The map is created once per mount; later prop changes are not applied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={container} className={cn("w-full h-[500px]", className)} />;
}
