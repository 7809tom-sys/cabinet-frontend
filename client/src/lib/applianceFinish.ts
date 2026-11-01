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
  /** Refrigerators, dishwashers, microwaves and hoods recolored in the 3D view (they have no catalog photo in that color). */
  tinted: number;
};

const TINTABLE_APPLIANCE = /^(FRIDGE|DW|MW|HOOD)[-_]/i;

/**
 * Appliance package by color. Ranges carry real color variants in the catalog, so a range keeps its position, size,
 * fuel and control style and only its catalog variant (description, picture, source id) is swapped. The refrigerator,
 * dishwasher, microwave and hood only have a stainless photo, so they keep their catalog item and get an
 * `applianceFinish` that the 3D view uses to recolor that photo.
 */
export function applyApplianceFinish(
  placed: readonly PlacedCabinet[],
  palette: readonly DesignCabinet[],
  finish: ApplianceFinish,
): ApplianceFinishResult {
  let changed = 0;
  let skipped = 0;
  let tinted = 0;
  const next = placed.map((item) => {
    if (TINTABLE_APPLIANCE.test(item.masterCode ?? "") && !/end[-\s]?panel/i.test(`${item.description ?? ""} ${item.masterCode ?? ""}`)) {
      const wanted = finish === "stainless" ? null : finish;
      if ((item.applianceFinish ?? null) === wanted) return item;
      tinted += 1;
      return { ...item, applianceFinish: wanted } as PlacedCabinet;
    }
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
  return { placed: changed + tinted > 0 ? next : (placed as PlacedCabinet[]), changed, skipped, tinted };
}
