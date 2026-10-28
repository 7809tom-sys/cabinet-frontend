import {
  cabinetWall,
  isCustomDim,
  isRefrigerator,
  isRefrigeratorEndPanel,
  refrigeratorAssemblyMemberRole,
  wallPlacementAtUnbounded,
  wallRunOffset,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "@/lib/design";

/** Ignore sub-1/16 inch catalog noise when deciding whether a panel is field-cut. */
export const REFRIGERATOR_PANEL_CUT_EPSILON_IN = 1 / 16;

export function formatRefrigeratorPanelCutInches(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Math.abs(rounded - Math.round(rounded)) < 0.001 ? String(Math.round(rounded)) : String(rounded);
}

export function refrigeratorEndPanelInstalledDepth(
  stockDepth: number,
  refrigeratorDepth: number,
): { installedDepth: number; stockDepth: number; cutDown: boolean } {
  const stock = Math.max(0, Number(stockDepth) || 0);
  const fridge = Math.max(0, Number(refrigeratorDepth) || 0);
  const cutDown = fridge > 0 && stock > fridge + REFRIGERATOR_PANEL_CUT_EPSILON_IN;
  return {
    installedDepth: cutDown ? fridge : stock,
    stockDepth: stock,
    cutDown,
  };
}

/** Master-BOM sentence. Null when the panel is not cut shallower than stock. */
export function refrigeratorEndPanelCutDownNote(
  stockDepth: number | null | undefined,
  installedDepth: number | null | undefined,
): string | null {
  const stock = Number(stockDepth);
  const installed = Number(installedDepth);
  if (!Number.isFinite(stock) || !Number.isFinite(installed)) return null;
  if (stock <= installed + REFRIGERATOR_PANEL_CUT_EPSILON_IN) return null;
  return `${formatRefrigeratorPanelCutInches(stock)} inch panel cut down to ${formatRefrigeratorPanelCutInches(installed)}`;
}

const PANEL_CUT_NOTE_PATTERN = /\d+(?:\.\d+)? inch panel cut down to \d+(?:\.\d+)?/g;

export function refrigeratorPanelCutNotesIn(text: string | null | undefined): string {
  if (!text) return "";
  return Array.from(new Set(text.match(PANEL_CUT_NOTE_PATTERN) ?? [])).join("; ");
}

function positive(value: number | null | undefined): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function stockDepthOf(panel: PlacedCabinet): number | null {
  const recorded = positive(panel.refrigeratorPanelStockDepth);
  if (recorded != null) return recorded;
  const live = positive(panel.depth);
  const nominal = positive(panel.nominalDepth);
  // A saved panel that was already cut keeps the deeper catalog nominal as stock.
  if (nominal != null && live != null && nominal > live + REFRIGERATOR_PANEL_CUT_EPSILON_IN) return nominal;
  return live;
}

function owningRefrigerator(
  panel: PlacedCabinet,
  placed: readonly PlacedCabinet[],
  room: RoomData,
): PlacedCabinet | null {
  if (panel.refrigeratorAssemblyId) {
    const linked = placed.find((item) => item.uid === panel.refrigeratorAssemblyId && isRefrigerator(item));
    if (linked) return linked;
  }
  for (const candidate of placed) {
    if (!isRefrigerator(candidate)) continue;
    const role = refrigeratorAssemblyMemberRole(panel, candidate, room);
    if (role === "left-panel" || role === "right-panel") return candidate;
  }
  return null;
}

/**
 * Installed refrigerator end panels match a shallower refrigerator. The stock
 * depth is remembered for the master BOM; a deeper refrigerator keeps the
 * stock panel. Pricing and the ordered SKU are unchanged.
 */
export function applyRefrigeratorEndPanelFieldCuts(
  placed: readonly PlacedCabinet[],
  room: RoomData,
): PlacedCabinet[] {
  let changed = false;
  const next = placed.map((panel) => {
    if (!isRefrigeratorEndPanel(panel)) return panel;
    const refrigerator = owningRefrigerator(panel, placed, room);
    if (!refrigerator) return panel;
    const stock = stockDepthOf(panel);
    const fridgeDepth = positive(refrigerator.depth);
    if (stock == null || fridgeDepth == null) return panel;
    const cut = refrigeratorEndPanelInstalledDepth(stock, fridgeDepth);
    const installed = cut.installedDepth;
    const stockField = cut.cutDown ? cut.stockDepth : null;
    const wasCustomDepth = isCustomDim(panel.depth, panel.nominalDepth);
    const nominalDepth = wasCustomDepth ? panel.nominalDepth : installed;
    const side = (panel.wallId ?? cabinetWall(panel, room)) as WallSide;
    const along = panel.wallOffset != null && Number.isFinite(Number(panel.wallOffset))
      ? Number(panel.wallOffset)
      : wallRunOffset(panel, side, room);
    const spot = panel.wallId
      ? wallPlacementAtUnbounded(along, Math.max(0, panel.width), installed, side, room, panel.peninsulaSide)
      : null;
    const same = Math.abs(panel.depth - installed) <= REFRIGERATOR_PANEL_CUT_EPSILON_IN
      && (panel.refrigeratorPanelStockDepth ?? null) === stockField
      && (spot == null || (
        Math.abs(panel.x - spot.x) <= REFRIGERATOR_PANEL_CUT_EPSILON_IN
        && Math.abs(panel.y - spot.y) <= REFRIGERATOR_PANEL_CUT_EPSILON_IN
      ))
      && (wasCustomDepth || panel.nominalDepth == null || Math.abs(Number(panel.nominalDepth) - installed) <= REFRIGERATOR_PANEL_CUT_EPSILON_IN);
    if (same) return panel;
    changed = true;
    return {
      ...panel,
      ...(spot ?? {}),
      depth: installed,
      nominalDepth,
      refrigeratorPanelStockDepth: stockField,
    };
  });
  return changed ? next : placed as PlacedCabinet[];
}
