import {
  isRangeOrOven, rangeVisualAppearance,
  type DesignCabinet, type PlacedCabinet, type RangeVisualAppearance,
} from "./design";

export type ApplianceFinish = RangeVisualAppearance["finish"];

export const APPLIANCE_FINISH_CHOICES: ReadonlyArray<{ finish: ApplianceFinish; label: string; swatch: string }> = [
  { finish: "stainless", label: "Stainless", swatch: "#c7cbd0" },
  { finish: "black-stainless", label: "Black stainless", swatch: "#343a40" },
  { finish: "black", label: "Black", swatch: "#15191e" },
  { finish: "white", label: "White", swatch: "#f1f3f5" },
];

export type ApplianceFinishResult = {
  placed: PlacedCabinet[];
  /** Ranges that were switched to the requested color. */
  changed: number;
  /** Ranges left as they were because no matching catalog range exists in that color. */
  skipped: number;
};

/**
 * Appliance package by color. Only ranges carry a real color variant in the catalog today, so those are the
 * pieces that change; the refrigerator, dishwasher, hood and microwave are left exactly as placed. A range keeps
 * its position, size and fuel (gas/electric) and control style; only the catalog variant (description, picture and
 * source id) is swapped for the same-style range in the requested color.
 */
export function applyApplianceFinish(
  placed: readonly PlacedCabinet[],
  palette: readonly DesignCabinet[],
  finish: ApplianceFinish,
): ApplianceFinishResult {
  let changed = 0;
  let skipped = 0;
  const next = placed.map((item) => {
    if (item.placement !== "appliance" || !isRangeOrOven(item.masterCode, item.description) || /^HOOD|^MW/i.test(item.masterCode)) return item;
    const current = rangeVisualAppearance(item);
    if (current.finish === finish) return item;
    const candidates = palette.filter((entry) => entry.masterCode === item.masterCode
      && Number(entry.width) === Number(item.width)
      && rangeVisualAppearance({ description: entry.description, catalogImageUrl: entry.catalogImageUrl }).finish === finish);
    const rank = (entry: DesignCabinet) => {
      const look = rangeVisualAppearance({ description: entry.description, catalogImageUrl: entry.catalogImageUrl });
      return (look.fuel === current.fuel ? 0 : 2) + (look.controlPosition === current.controlPosition ? 0 : 1);
    };
    const source = [...candidates].sort((a, b) => rank(a) - rank(b))[0];
    if (!source) { skipped += 1; return item; }
    changed += 1;
    return {
      ...item,
      cabinetId: source.id,
      description: source.description,
      catalogImageUrl: source.catalogImageUrl ?? null,
    } as PlacedCabinet;
  });
  return { placed: changed > 0 ? next : (placed as PlacedCabinet[]), changed, skipped };
}
