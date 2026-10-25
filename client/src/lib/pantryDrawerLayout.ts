export type PantryDrawerInput = {
  masterCode?: string | null;
  graphicType?: string | null;
  category?: string | null;
  placementType?: string | null;
  description?: string | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  doorHeight?: number | null;
  drawerHeight?: number | null;
  drawerLayout?: string | null;
  openingType?: string | null;
  ovenType?: string | null;
};

/** A tall drawer pantry is not a regular base, an oven tower, or a plain four-door pantry. */
export function isTallPantryDrawerCabinet(input: PantryDrawerInput): boolean {
  const placement = input.placementType?.toLowerCase();
  if (placement && placement !== "tall") return false;
  if (input.ovenType || (input.openingType && input.openingType !== "none")) return false;
  if (!(Number(input.numberOfDoors) > 0 && Number(input.numberOfDrawers) > 0)) return false;
  const code = (input.masterCode ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (/^(?:TOS|TOD|UOC|O\d|0\d)/.test(code)) return false;
  if (/^(?:VT|T)[23]DB(?:ID)?\d/.test(code)) return true;
  if (/^tall_\d+door_\d+drawer/i.test(input.graphicType ?? "")) return true;
  return (placement === "tall" || input.category?.toLowerCase() === "tall")
    && /\bpantry\b/i.test(input.description ?? "")
    && !/\boven\b/i.test(input.description ?? "");
}

/**
 * Heights are inches and rows remain TOP-TO-BOTTOM even when the whole bank is
 * anchored at the bottom. V8 pantry 2DR fronts are 15/15; 3DR fronts are
 * 7-3/8, 7-3/8, 15. Authored rows always take precedence. No source data is mutated.
 */
export function pantryDrawerFrontLayout(input: PantryDrawerInput, availableHeightIn: number) {
  if (!isTallPantryDrawerCabinet(input) || !Number.isFinite(availableHeightIn) || availableHeightIn <= 0) return null;
  let rows: Array<{ count: number; height: number }> = [];
  try {
    const parsed: unknown = JSON.parse(input.drawerLayout ?? "null");
    if (Array.isArray(parsed) && parsed.length && parsed.every(row =>
      row && Number.isFinite(Number(row.height)) && Number(row.height) > 0
      && Number.isFinite(Number(row.count)) && Number(row.count) > 0)) {
      rows = parsed.map(row => ({ count: Math.max(1, Math.round(Number(row.count))), height: Number(row.height) }));
    }
  } catch {
    // A legacy saved layout may omit row JSON; only known source families have a measured fallback.
  }
  const code = (input.masterCode ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const sourceFamily = /^(?:VT|T)([23])DB(?:ID)?\d/.exec(code);
  if (!rows.length && sourceFamily) {
    rows = (sourceFamily[1] === "3" ? [7.375, 7.375, 15] : [15, 15]).map(height => ({ count: 1, height }));
  }
  if (!rows.length) {
    const count = Math.max(1, Math.round(Number(input.numberOfDrawers)));
    const bankHeight = Number(input.drawerHeight) > 0 ? Number(input.drawerHeight) : availableHeightIn * 0.35;
    rows = Array.from({ length: count }, () => ({ count: 1, height: bankHeight / count }));
  }
  const requestedHeight = rows.reduce((sum, row) => sum + row.height, 0);
  const availableDrawerHeight = Math.max(0, availableHeightIn - (Number(input.doorHeight) > 0 ? Math.min(Number(input.doorHeight), availableHeightIn) : 0));
  const scale = requestedHeight > availableDrawerHeight ? availableDrawerHeight / requestedHeight : 1;
  rows = rows.map(row => ({ ...row, height: row.height * scale }));
  const drawerHeight = rows.reduce((sum, row) => sum + row.height, 0);
  return {
    doorCount: Math.max(1, Math.round(Number(input.numberOfDoors))),
    rows,
    drawerHeight,
    doorHeight: availableHeightIn - drawerHeight,
  };
}
