// Pure, dependency-free location/availability helpers shared by client + server.
// Distance is computed with the haversine formula over lat/lng centroids.
// We keep a small built-in ZIP3 (first 3 digits) centroid table so availability
// works without a live geocode round-trip; the server may refine a customer's
// exact ZIP via Google geocoding and pass precise coordinates in.

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_MI = 3958.7613;

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points, in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Normalize any zip-ish input to its 5-digit (or padded) form, or null. */
export function normalizeZip(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = String(input).trim().match(/\b(\d{5})(?:-\d{4})?\b/);
  if (m) return m[1];
  const digits = String(input).replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(0, 5);
  if (digits.length === 3) return digits.padEnd(5, "0"); // ZIP3 → approximate
  return null;
}

// Centroid table keyed by ZIP3 prefix (approximate geographic center of the
// 3-digit ZIP region). Covers the prefixes used by seeded warehouses plus broad
// coverage of populous regions so most US customer ZIPs resolve offline.
// Coordinates are approximate region centroids (public-domain geographic data).
const ZIP3_CENTROIDS: Record<string, LatLng> = {
  // Seeded warehouse regions
  "300": { lat: 33.96, lng: -83.99 }, // Atlanta/Suwanee GA (30024)
  "850": { lat: 33.45, lng: -112.07 }, // Phoenix AZ (85040)
  "606": { lat: 41.79, lng: -87.77 }, // Chicago/Bedford Park IL (60638)
  "752": { lat: 32.82, lng: -96.87 }, // Dallas TX (75247 / 75234)
  "980": { lat: 47.38, lng: -122.23 }, // Kent/Seattle WA (98032)
  "330": { lat: 25.91, lng: -80.27 }, // Miami/Opa-locka FL (33054)
  "191": { lat: 39.88, lng: -75.24 }, // Philadelphia PA (19153)
  "071": { lat: 40.72, lng: -74.17 }, // Newark NJ (07105)
  "324": { lat: 30.17, lng: -85.67 }, // Panama City FL (32401)
  // Broad regional coverage (approximate centroids)
  "100": { lat: 40.75, lng: -73.99 }, // New York NY
  "021": { lat: 42.36, lng: -71.06 }, // Boston MA
  "200": { lat: 38.9, lng: -77.04 }, // Washington DC
  "load": { lat: 0, lng: 0 },
  "770": { lat: 29.76, lng: -95.37 }, // Houston TX
  "787": { lat: 30.27, lng: -97.74 }, // Austin TX
  "782": { lat: 29.42, lng: -98.49 }, // San Antonio TX
  "900": { lat: 34.05, lng: -118.24 }, // Los Angeles CA
  "941": { lat: 37.77, lng: -122.42 }, // San Francisco CA
  "921": { lat: 32.72, lng: -117.16 }, // San Diego CA
  "petal": { lat: 0, lng: 0 },
  "802": { lat: 39.74, lng: -104.99 }, // Denver CO
  "891": { lat: 36.17, lng: -115.14 }, // Las Vegas NV
  "972": { lat: 45.52, lng: -122.68 }, // Portland OR
  "331": { lat: 25.76, lng: -80.19 }, // Miami FL
  "327": { lat: 28.54, lng: -81.38 }, // Orlando FL
  "336": { lat: 27.95, lng: -82.46 }, // Tampa FL
  "load2": { lat: 0, lng: 0 },
  "load3": { lat: 0, lng: 0 },
  "load4": { lat: 0, lng: 0 },
  "load5": { lat: 0, lng: 0 },
};
// Remove placeholder keys (kept the object literal tidy above without trailing-comma churn)
for (const k of ["load", "petal", "load2", "load3", "load4", "load5"]) delete ZIP3_CENTROIDS[k];

/** Approximate lat/lng for a 5-digit ZIP using its ZIP3 prefix centroid. */
export function approxZipCentroid(zip: string | null | undefined): LatLng | null {
  const z = normalizeZip(zip);
  if (!z) return null;
  const p3 = z.slice(0, 3);
  return ZIP3_CENTROIDS[p3] ?? null;
}

export type WarehouseRef = { zip: string; coord: LatLng | null };

/**
 * Given a customer coordinate and a set of warehouse coordinates, return the
 * nearest warehouse distance in miles (or null if none resolvable).
 */
export function nearestWarehouseMiles(
  customer: LatLng | null,
  warehouses: (LatLng | null)[]
): number | null {
  if (!customer) return null;
  let best: number | null = null;
  for (const w of warehouses) {
    if (!w) continue;
    const d = haversineMiles(customer, w);
    if (best === null || d < best) best = d;
  }
  return best;
}

/**
 * Given a customer coordinate and a list of warehouse refs (zip + resolved
 * coordinate), return the ZIP of the nearest warehouse. Falls back to the first
 * warehouse zip when the customer cannot be located, and null when the list is
 * empty. Used to pick the freight ORIGIN so an order ships from the closest
 * warehouse instead of one fixed origin ZIP.
 */
export function pickNearestWarehouseZip(
  customer: LatLng | null,
  warehouses: WarehouseRef[]
): string | null {
  const valid = warehouses.filter((w) => !!w.zip);
  if (valid.length === 0) return null;
  if (!customer) return valid[0].zip;
  let bestZip: string | null = null;
  let best: number | null = null;
  for (const w of valid) {
    if (!w.coord) continue;
    const d = haversineMiles(customer, w.coord);
    if (best === null || d < best) {
      best = d;
      bestZip = w.zip;
    }
  }
  // If none of the warehouses had a resolvable coordinate, fall back to the
  // first zip so we still ship from a real warehouse rather than the global one.
  return bestZip ?? valid[0].zip;
}

export const DEFAULT_SERVICE_RADIUS_MI = 250;

/** Is a supply line available to a customer location within the radius? */
export function isWithinRadius(
  customer: LatLng | null,
  warehouses: (LatLng | null)[],
  radiusMi: number = DEFAULT_SERVICE_RADIUS_MI
): boolean {
  const d = nearestWarehouseMiles(customer, warehouses);
  if (d === null) return false;
  return d <= radiusMi;
}
