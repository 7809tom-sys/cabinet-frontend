import type { PlacedCabinet } from "./design";

/** True when two placement lists hold the same cabinets with the same field values (shallow). */
export function samePlacementsShallow(a: readonly PlacedCabinet[], b: readonly PlacedCabinet[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index] as unknown as Record<string, unknown>;
    const right = b[index] as unknown as Record<string, unknown>;
    if (left === right) continue;
    const leftKeys = Object.keys(left);
    if (leftKeys.length !== Object.keys(right).length) return false;
    for (const key of leftKeys) {
      if (!Object.is(left[key], right[key])) return false;
    }
  }
  return true;
}
