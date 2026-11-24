// Location/availability helpers shared by client + server.
// Distance is computed with the haversine formula over lat/lng centroids.
// Every US ZIP3 prefix that has a published point is in US_ZIP3_CENTROIDS, so
// origin selection does not depend on a live geocode. The server may still
// refine a customer's exact ZIP via Google geocoding and pass those coordinates in.

import { US_ZIP3_CENTROIDS } from "./data/usZip3Centroids";

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

/** Approximate lat/lng for a 5-digit ZIP using its ZIP3 prefix centroid. */
export function approxZipCentroid(zip: string | null | undefined): LatLng | null {
  const z = normalizeZip(zip);
  if (!z) return null;
  return US_ZIP3_CENTROIDS[z.slice(0, 3)] ?? null;
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
 * ZIP of the warehouse nearest the customer.
 *
 * Returns null when the list is empty, when the customer cannot be placed, or
 * when no warehouse can be placed. An unplaced ZIP has no distance, so callers
 * must not substitute list order. Warehouses that cannot be placed are left
 * out of the ranking; a placed warehouse can still win. Equal distances keep
 * the earlier warehouse.
 */
export function pickNearestWarehouseZip(
  customer: LatLng | null,
  warehouses: WarehouseRef[]
): string | null {
  const valid = warehouses.filter((w) => !!w.zip);
  if (valid.length === 0 || !customer) return null;
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
  return bestZip;
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
