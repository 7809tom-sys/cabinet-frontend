export type KitchenCabinetBreakdown = { base: number; wall: number; tall: number; total: number };
export type KitchenCabinetWorkQuantities = KitchenCabinetBreakdown & {
  cabinetAssembly: number;
  cabinetInstallation: number;
  cabinetHanging: number;
  pantryCabinet: number;
  countertopSquareFeet: number;
  fillerLinearFeet: number;
  crownMoldingLinearFeet: number;
  toeKickLinearFeet: number;
  lightRailLinearFeet: number;
  quarterRoundLinearFeet: number;
  decoDoors: number;
  rollOuts: number;
  lazySusanInserts: number;
  trashCanPullOuts: number;
  fridgePanels: number;
  dishwasherPanels: number;
  handles: number;
};
export type KitchenCabinetClassificationRow = {
  category?: string | null;
  subCategory?: string | null;
  productType?: string | null;
  placementType?: string | null;
  isNotCabinet?: boolean | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  height?: number | string | null;
  depth?: number | string | null;
};
export type KitchenPlanPlacement = { uid?: string | null; cabinetId?: number | null; qty?: number | null; [key: string]: unknown };

export function emptyKitchenCabinetBreakdown(): KitchenCabinetBreakdown {
  return { base: 0, wall: 0, tall: 0, total: 0 };
}

/** Catalog families, not a substring of an accessory's placement/description. */
export function classifyKitchenCabinet(row: KitchenCabinetClassificationRow): "base" | "wall" | "tall" | null {
  if (row.isNotCabinet) return null;
  const category = row.category?.trim().toLowerCase() ?? "";
  if (["base", "base cabinet", "base cabinets"].includes(category)) return "base";
  if (["wall", "wall cabinet", "wall cabinets"].includes(category)) return "wall";
  if (["tall", "tall cabinet", "tall cabinets"].includes(category)) return "tall";
  // These additional real catalog families are cabinets, but only their
  // documented cabinet placement determines which installation bucket they use.
  if (["ada", "american disability act cabinet", "corner", "vanity"].includes(category)) {
    const placement = row.placementType?.toLowerCase();
    if (placement === "wall" || placement === "tall") return placement;
    if (placement === "base" || placement === "island" || placement === "vanity") return "base";
  }
  return null;
}

export function countKitchenCabinets(placements: unknown, cabinetById: Map<number, KitchenCabinetClassificationRow>): KitchenCabinetBreakdown {
  const counts = emptyKitchenCabinetBreakdown();
  const seen = new Set<string>();
  if (!Array.isArray(placements)) return counts;
  for (const item of placements) {
    if (!item || typeof item !== "object") continue;
    const placement = item as KitchenPlanPlacement;
    const id = Number(placement.cabinetId);
    if (!Number.isInteger(id) || id <= 0) continue;
    const family = classifyKitchenCabinet(cabinetById.get(id) ?? {});
    if (!family) continue;
    const quantity = placement.qty == null ? 1 : Number(placement.qty);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10_000) continue;
    const uid = typeof placement.uid === "string" ? placement.uid.trim() : "";
    if (uid && seen.has(uid)) continue;
    if (uid) seen.add(uid);
    counts[family] += quantity;
    counts.total += quantity;
  }
  return counts;
}

/** Quantities directly knowable from saved catalog placements; prices stay editable. */
export function countKitchenCabinetWork(placements: unknown, cabinetById: Map<number, KitchenCabinetClassificationRow>): KitchenCabinetWorkQuantities {
  const counts = countKitchenCabinets(placements, cabinetById);
  const work: KitchenCabinetWorkQuantities = { ...counts, cabinetAssembly: counts.total, cabinetInstallation: counts.total, cabinetHanging: counts.wall, pantryCabinet: 0, countertopSquareFeet: 0, fillerLinearFeet: 0, crownMoldingLinearFeet: 0, toeKickLinearFeet: 0, lightRailLinearFeet: 0, quarterRoundLinearFeet: 0, decoDoors: 0, rollOuts: 0, lazySusanInserts: 0, trashCanPullOuts: 0, fridgePanels: 0, dishwasherPanels: 0, handles: 0 };
  const seen = new Set<string>();
  let wallCrownCandidateInches = 0;
  if (!Array.isArray(placements)) return work;
  for (const item of placements) {
    if (!item || typeof item !== "object") continue;
    const placement = item as KitchenPlanPlacement;
    const id = Number(placement.cabinetId);
    const row = cabinetById.get(id);
    const source = { ...placement, ...(row ?? {}) } as KitchenCabinetClassificationRow & KitchenPlanPlacement;
    const family = classifyKitchenCabinet(row ?? source);
    const quantity = placement.qty == null ? 1 : Number(placement.qty);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10_000) continue;
    const uid = typeof placement.uid === "string" ? placement.uid.trim() : "";
    if (uid && seen.has(uid)) continue;
    if (uid) seen.add(uid);
    const text = `${source.category ?? ""} ${source.subCategory ?? ""} ${source.productType ?? ""} ${source.description ?? ""} ${source.masterCode ?? ""}`.toLowerCase();
    const width = Number(source.width ?? 0);
    const linearFeet = Number.isFinite(width) && width > 0 ? quantity * width / 12 : 0;
    if (/filler|scribe/.test(text)) work.fillerLinearFeet += linearFeet;
    if (/crown|cornice|moulding|molding/.test(text)) work.crownMoldingLinearFeet += quantity * (width + 3) / 12;
    if (/toe.?kick|kick board/.test(text)) work.toeKickLinearFeet += linearFeet;
    if (/light.?rail/.test(text)) work.lightRailLinearFeet += linearFeet;
    if (/1\/4\s*round|quarter.?round/.test(text)) work.quarterRoundLinearFeet += linearFeet;
    if (/deco(rative)?\s+door/.test(text)) work.decoDoors += quantity;
    if (/roll.?out/.test(text)) work.rollOuts += quantity;
    if (/lazy\s*susan|lazy\s* susan|easy.?reach/.test(text)) work.lazySusanInserts += quantity;
    if (/trash|waste\s*pull/.test(text)) work.trashCanPullOuts += quantity;
    if (/refrigerator.*panel|fridge.*panel|end\s*panel/.test(text)) work.fridgePanels += quantity;
    if (/dishwasher.*panel/.test(text)) work.dishwasherPanels += quantity;
    if (!family) continue;
    if (Number(row?.height ?? 0) >= 84) work.pantryCabinet += quantity;
    const placementType = String((placement as KitchenPlanPlacement & { placement?: unknown }).placement ?? "").toLowerCase();
    const isCountertopSupport = family === "base" && placementType !== "tall";
    const depth = Number((placement as KitchenPlanPlacement & { depth?: unknown }).depth ?? row?.depth ?? 24);
    if (isCountertopSupport && Number.isFinite(width) && width > 0 && Number.isFinite(depth) && depth > 0) {
      const finishedDepth = placementType === "island" ? depth + 3 : 25.5;
      work.countertopSquareFeet += quantity * width * finishedDepth / 144;
    }
    if (family === "base") work.toeKickLinearFeet += linearFeet;
    if (family === "wall") wallCrownCandidateInches += quantity * width;
    work.handles += quantity * Math.max(0, Number(row?.numberOfDoors ?? 0) + Number(row?.numberOfDrawers ?? 0));
  }
  if (work.crownMoldingLinearFeet === 0 && wallCrownCandidateInches > 0) work.crownMoldingLinearFeet = (wallCrownCandidateInches + counts.wall * 3) / 12;
  for (const key of ["fillerLinearFeet", "crownMoldingLinearFeet", "toeKickLinearFeet", "lightRailLinearFeet", "quarterRoundLinearFeet"] as const) work[key] = Math.ceil(work[key] * 10) / 10;
  work.countertopSquareFeet = Math.ceil(work.countertopSquareFeet * 10) / 10;
  return work;
}
