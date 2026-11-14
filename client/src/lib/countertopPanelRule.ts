/**
 * Owner rule (Tom, Nov 13 2026): "counter top never go through a panel."
 *
 * The dishwasher panel (DWP) is the one exception, and it is narrow: a 3-inch
 * panel on the exposed side of the dishwasher, which the countertop sits on top
 * of. Any larger panel - a tall end panel, a decorative panel, a peninsula
 * panel - must stop the slab at its face. A slab that overlaps one is a build
 * error the customer would see as the counter passing through the panel.
 *
 * Pure: it measures a finished plan and returns the clashes. It never moves a
 * cabinet or a panel.
 */
import {
  cabinetWall,
  countertopSurfaces,
  isPanelItem,
  placedFootprint,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { kitchenRuleNumber } from "./kitchenRuleParameters";

export type CountertopPanelClash = {
  ruleId: string;
  code: string;
  severity: "attention";
  title: string;
  detail: string;
  cabinetUid?: string;
  cabinetCode?: string;
};

/** A DWP is the narrow panel the counter sits on: about 3 inches wide. */
export const DISHWASHER_PANEL_MAX_WIDTH_IN = 3.5;

export type CountertopPanelInput = {
  placed: readonly PlacedCabinet[];
  room: RoomData;
};

type Rect = { x: number; y: number; w: number; d: number };

function rectOf(item: PlacedCabinet): Rect {
  const footprint = placedFootprint(item);
  return { x: item.x, y: item.y, w: footprint.w, d: footprint.d };
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const d = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y);
  return w > 0 && d > 0 ? w * d : 0;
}

/**
 * Panels that may carry the countertop: a dishwasher panel only. Depth is the
 * panel's thickness into the room; its along-wall run is the narrow one.
 */
export function isCountertopBearingPanel(panel: PlacedCabinet, room: RoomData): boolean {
  if (!isPanelItem(panel)) return false;
  const wall = cabinetWall(panel, room);
  const along = wall ? wallRunSpan(panel, wall, room) : Number(panel.width) || 0;
  return along > 0 && along <= DISHWASHER_PANEL_MAX_WIDTH_IN + 0.05;
}

/**
 * Every place a countertop slab overlaps a panel larger than a dishwasher panel.
 * One finding per panel; it names both codes so a designer can act on it.
 */
export function reviewCountertopPanelClashes(input: CountertopPanelInput): CountertopPanelClash[] {
  if (kitchenRuleNumber("countertop_never_through_panel") <= 0) return [];
  const findings: CountertopPanelClash[] = [];
  const surfaces = countertopSurfaces([...input.placed], input.room);
  const panels = input.placed.filter((item) => isPanelItem(item) && !isCountertopBearingPanel(item, input.room));
  for (const panel of panels) {
    const panelRect = rectOf(panel);
    const hit = surfaces.find((surface) => overlapArea(surface, panelRect) > 1);
    if (!hit) continue;
    findings.push({
      ruleId: "countertop-never-through-panel",
      code: "countertop-through-panel",
      severity: "attention",
      title: "A countertop runs through a panel",
      detail: `${panel.masterCode} is covered by a countertop slab. Only a dishwasher panel (about 3 inches, on the exposed side of the dishwasher) takes the counter on top; every larger panel stops the slab at its face.`,
      cabinetUid: panel.uid,
      cabinetCode: panel.masterCode,
    });
  }
  return findings;
}
