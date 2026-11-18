import { describe, expect, it } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { cabinetWall, isFillerItem, wallRunFrame, isSinkBaseCabinet, wallRunOffset, wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

// Tom, Nov 14 2026: a B27 got a W24 (plus filler) above it instead of the W27
// the line sells. The 15-rule repack re-tiled the wall level apart from the bases.
type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const CATALOG = matrixCatalog as unknown as Record<string, Pack>;
const appliance = (code: string, w: number, d: number, h: number) => ({ id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance", width: String(w), depth: String(d), height: String(h), placement: "appliance" }) as DesignCabinet;
const PALETTE = [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70), appliance("HOOD-30", 30, 18, 18)];

function build(styleId: string, roomWidth: number, rangeCenter: number) {
  const pack = CATALOG[styleId]!;
  const room = { width: roomWidth, depth: 120, ceilingHeight: 96 } as RoomData;
  let uid = 0;
  const input = {
    layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
    sink: { wallLabel: "Wall 2", centerOffsetIn: 60 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
    stove: { wallLabel: "Wall 1", centerOffsetIn: rangeCenter }, dishwasher: null, dishwasherSide: "none", skipDishwasher: true,
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
    refrigeratorPanels: "both", refrigeratorEnclosure: "cabinet-above", sinkWindowCenter: null,
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    intake: { ...emptyAutoDesignIntake(), construction: "new" },
  } as AutoDesignInputs;
  const run = runAutoDesignLayout({
    input, room, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: PALETTE, refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    styleId: Number(styleId), makeUid: () => `u-${++uid}`,
  });
  if (!run.ok) throw new Error(run.message);
  return { run, room };
}

function mismatches(placed: readonly PlacedCabinet[], room: RoomData, wallCatalog: readonly DesignCabinet[]): string[] {
  const out: string[] = [];
  // Only a base whose width the line sells as a 30" wall cabinet must match.
  const sold = new Set(wallCatalog.filter((row) => /^W\d{4}$/.test(row.masterCode) && Math.abs(Number(row.height) - 30) <= 0.5).map((row) => Number(row.width)));
  for (const base of placed.filter((item) => item.placement === "base" && /^B\d+$/.test(item.masterCode) && !isSinkBaseCabinet(item) && sold.has(Number(item.width)))) {
    const wall = cabinetWall(base, room) as string;
    const start = wallRunOffset(base, wall, room);
    const end = start + wallRunSpan(base, wall, room);
    const above = placed.filter((item) => item.placement === "wall" && cabinetWall(item, room) === wall && !isFillerItem(item))
      .filter((item) => { const s = wallRunOffset(item, wall, room); return s < end - 0.1 && s + wallRunSpan(item, wall, room) > start + 0.1; });
    if (!above.length) continue;
    const exact = above.some((item) => Math.abs(wallRunOffset(item, wall, room) - start) <= 0.25 && Math.abs(wallRunSpan(item, wall, room) - (end - start)) <= 0.25);
    if (!exact) out.push(`${base.masterCode}@${start.toFixed(2)} under ${above.map((item) => item.masterCode).join("+")}`);
  }
  return out;
}

describe("Auto Design wall cabinets match the base below", () => {
  it("B27 + B12 between the refrigerator and the range get W2730 + W1230, not W3030 + W0930", () => {
    const { run, room } = build("510004", 132, 93);
    const codes = run.placed.filter((item) => item.placement === "base").map((item) => item.masterCode);
    expect(codes).toEqual(expect.arrayContaining(["B27", "B12"]));
    expect(mismatches(run.placed, room, CATALOG["510004"]!.wall)).toEqual([]);
    // This line sells no W4230, so each B42 gets two 21s at the design height
    // (Tom, Nov 18 2026 hard fallback) and nothing over a B42 is "kept".
    expect(run.reviewFindings.some((finding) => finding.code === "upper-width-not-matched" && /42/.test(finding.detail))).toBe(false);
    for (const base of run.placed.filter((item) => item.placement === "base" && item.masterCode === "B42")) {
      const wall = cabinetWall(base, room) as string;
      const start = wallRunOffset(base, wall, room);
      const over = run.placed.filter((item) => item.placement === "wall" && cabinetWall(item, room) === wall && !isFillerItem(item)
        && wallRunOffset(item, wall, room) < start + 41.9 && wallRunOffset(item, wall, room) + wallRunSpan(item, wall, room) > start + 0.1);
      expect(over.map((item) => item.masterCode)).toEqual(["W2130", "W2130"]);
    }
    expect(run.placed.some((item) => item.masterCode === "W2730")).toBe(true);
    expect(run.placed.some((item) => item.masterCode === "W1230")).toBe(true);
  });

  it("holds across other recorded lines and run lengths", () => {
    for (const [styleId, width, range] of [["540005", 132, 96], ["330014", 138, 102], ["510004", 144, 90]] as const) {
      const { run, room } = build(styleId, width, range);
      expect({ styleId, width, range, mismatches: mismatches(run.placed, room, CATALOG[styleId]!.wall) }).toEqual({ styleId, width, range, mismatches: [] });
    }
  });

  it("keeps every wall run inside its wall with no overlapping or open upper seams", () => {
    for (const [styleId, width, range] of [["510004", 132, 93], ["540005", 132, 96], ["330014", 138, 102], ["510004", 144, 90]] as const) {
      const { run, room } = build(styleId, width, range);
      for (const wall of ["top", "left", "right", "bottom"]) {
        const frame = wallRunFrame(wall, room);
        if (!frame) continue;
        const uppers = run.placed.filter((item) => item.placement === "wall" && cabinetWall(item, room) === wall)
          .map((item) => ({ code: item.masterCode, start: wallRunOffset(item, wall, room), end: wallRunOffset(item, wall, room) + wallRunSpan(item, wall, room) }))
          .sort((a, b) => a.start - b.start);
        for (const upper of uppers) {
          expect(upper.start, `${styleId} ${wall} ${upper.code}`).toBeGreaterThanOrEqual(-0.05);
          expect(upper.end, `${styleId} ${wall} ${upper.code}`).toBeLessThanOrEqual(frame.length + 0.05);
        }
        for (let i = 1; i < uppers.length; i += 1) {
          expect(uppers[i]!.start - uppers[i - 1]!.end, `${styleId} ${wall} ${uppers[i - 1]!.code}/${uppers[i]!.code} overlap`).toBeGreaterThanOrEqual(-0.05);
        }
      }
    }
  });
});
