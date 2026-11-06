/**
 * Reading a cabinet's width, height and depth out of its SKU.
 *
 * This mirrors `wallCabinetSkuDimensions` in `client/src/lib/design.ts` — the
 * parser the 3D Designer itself uses — so a dimension derived here builds the
 * same box the plan will. It lives in `shared/` because the server needs the same
 * answer when it validates an admin override.
 *
 * Only unambiguous codes resolve. A code that does not match one of these exact
 * shapes returns null, and the caller must then refuse rather than guess.
 */

export type CabinetDimensionsIn = { width: number; height: number; depth: number };

/** The wall-cabinet code shapes, in the Designer's own precedence order. */
export function wallCabinetSkuDimensions(masterCode: string | null | undefined): CabinetDimensionsIn | null {
  const code = (masterCode ?? "").trim().toUpperCase();
  const match = (pattern: RegExp) => code.match(pattern);
  let parsed = match(/(?:^|[^A-Z0-9])W-(\d{2})-(\d{2})$/);
  if (parsed) return { width: Number(parsed[1]), height: Number(parsed[2]), depth: 12 };
  parsed = match(/(?:^|[^A-Z0-9])WR(\d{2})(\d{2})$/);
  if (parsed) return { width: Number(parsed[1]), height: Number(parsed[2]), depth: 24 };
  parsed = match(/(?:^|[^A-Z0-9])W(\d{2})(\d{2})GD$/);
  if (parsed) return { width: Number(parsed[1]), height: Number(parsed[2]), depth: 12 };
  parsed = match(/(?:^|[^A-Z0-9])W(\d{2})(\d{2})(\d{2})$/);
  if (parsed) return { width: Number(parsed[1]), height: Number(parsed[2]), depth: Number(parsed[3]) };
  parsed = match(/(?:^|[^A-Z0-9])W(\d{2})(\d{2})$/);
  if (parsed) return { width: Number(parsed[1]), height: Number(parsed[2]), depth: 12 };
  return null;
}

/**
 * Standard base-cabinet depth. Base codes carry width and height but not depth,
 * so 24" is the convention rather than a parse — it is only used when the code
 * really is a base cabinet (B24, B30FH, 3DB18 …).
 */
export const BASE_CABINET_DEPTH_IN = 24;

/** `B24` → 24W × 34.5H × 24D. `B30FH` → 30W × 34.5H × 24D. */
export function baseCabinetSkuDimensions(masterCode: string | null | undefined): CabinetDimensionsIn | null {
  const code = (masterCode ?? "").trim().toUpperCase();
  const parsed = code.match(/(?:^|[^A-Z0-9])(?:B|3DB|2DB|DB)(\d{2})(?:FH)?$/);
  if (!parsed) return null;
  return { width: Number(parsed[1]), height: 34.5, depth: BASE_CABINET_DEPTH_IN };
}

/**
 * Dimensions from a SKU, wall first then base. Returns null when neither shape
 * matches — never a best guess.
 */
export function cabinetSkuDimensions(masterCode: string | null | undefined): CabinetDimensionsIn | null {
  return wallCabinetSkuDimensions(masterCode) ?? baseCabinetSkuDimensions(masterCode);
}
