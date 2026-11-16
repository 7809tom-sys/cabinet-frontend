/**
 * Tom, Nov 16 2026 (6:45 AM CT): "the auto design didnt like the 45 angles".
 * In a room with 45° walls (range on the left wall, an angled back-left wall,
 * the sink on the back wall, the refrigerator on the angled back-right wall)
 * the runs stopped short at every angled corner: bare floor in the bases and
 * gaps in the uppers. HANDOFF rule: runs meet at every angled corner with the
 * 45°/135° angled filler, for both bases and uppers, cut from real stock.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { measuredAngledWallTransition } from "./angledWallFiller";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import {
  cabinetPlacementCollisionDetail,
  isFillerItem,
  wallLength,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = "330011";
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const ACCESSORIES = REAL[STYLE]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORIES.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

/** Left wall, 45° back-left, back wall, 45° back-right, right wall (front open). */
function tomsAngledRoom(): RoomData {
  return {
    width: 216, depth: 168, ceilingHeight: 96, openWallPath: true,
    vertices: [
      { id: "v1", x: 0, y: 168 }, { id: "v2", x: 0, y: 48 }, { id: "v3", x: 48, y: 0 },
      { id: "v4", x: 168, y: 0 }, { id: "v5", x: 216, y: 48 }, { id: "v6", x: 216, y: 168 },
    ],
    customWalls: [
      { id: "left", label: "Wall 1", startVertexId: "v1", endVertexId: "v2" },
      { id: "angL", label: "Wall 2", startVertexId: "v2", endVertexId: "v3", lockedAngle: 45 },
      { id: "back", label: "Wall 3", startVertexId: "v3", endVertexId: "v4" },
      { id: "angR", label: "Wall 4", startVertexId: "v4", endVertexId: "v5", lockedAngle: 45 },
      { id: "right", label: "Wall 5", startVertexId: "v5", endVertexId: "v6" },
    ],
  } as RoomData;
}

function build(fillers: DesignCabinet[] = FILLERS): AutoDesignLayoutSuccess {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "u-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 3", centerOffsetIn: 60 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 1", centerOffsetIn: 60 },
      refrigerator: { wallLabel: "Wall 4", centerOffsetIn: 34 },
      dishwasher: null, skipDishwasher: true, tallCabinets: null,
      overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    } as AutoDesignInputs,
    room: tomsAngledRoom(), openings: [],
    baseCatalog: BASES, wallCatalog: WALLS, fillers,
    appliancePalette: [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70)],
    refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
    refrigeratorEndPanels: ACCESSORIES.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
    styleId: Number(STYLE), makeUid: () => `angled-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

function miterPairsBetween(placed: readonly PlacedCabinet[], first: string, second: string, layer: "base" | "wall"): PlacedCabinet[] {
  return placed.filter((item) => item.fillerTransitionKind === "front-miter-pair"
    && item.placement === layer
    && (item.wallId === first || item.wallId === second)
    && (() => {
      const owner = placed.find((other) => other.uid === item.fillerForCabinetUid);
      const peer = placed.find((other) => other.uid === item.fillerTransitionNeighborUid);
      const walls = [owner?.wallId, peer?.wallId].sort();
      return walls[0] === [first, second].sort()[0] && walls[1] === [first, second].sort()[1];
    })());
}

/** Last same-layer cabinet before the vertex at `at`. */
function runEnd(placed: readonly PlacedCabinet[], room: RoomData, wallId: string, layer: "base" | "wall", at: "start" | "end") {
  const len = wallLength(wallId as WallSide, room);
  return placed
    .filter((item) => item.wallId === wallId && item.placement === layer && !isFillerItem(item) && !item.fillerPieceGroupId)
    .map((item) => {
      const start = wallRunOffset(item, wallId, room);
      return { item, gap: at === "start" ? start : len - (start + wallRunSpan(item, wallId, room)) };
    })
    .sort((left, right) => left.gap - right.gap)[0]!;
}

describe("Auto Design closes every 45° corner of an angled-wall room (Tom, Nov 16)", () => {
  const room = tomsAngledRoom();
  const result = build();

  for (const [first, second] of [["left", "angL"], ["angL", "back"]] as const) {
    for (const layer of ["base", "wall"] as const) {
      it(`meets at the ${first}/${second} corner with a real 22.5° pair in the ${layer === "wall" ? "uppers" : "bases"}`, () => {
        const pieces = miterPairsBetween(result.placed, first, second, layer);
        expect(pieces).toHaveLength(2);
        expect(new Set(pieces.map((piece) => piece.wallId))).toEqual(new Set([first, second]));
        expect(pieces.every((piece) => piece.fillerMiterAngle === 22.5)).toBe(true);
        // Cut from stock the line really sells; nothing invented.
        expect(pieces.every((piece) => FILLERS.some((row) => row.masterCode === piece.masterCode))).toBe(true);
        expect(pieces.every((piece) => piece.width >= 0.5 && piece.width <= Number(FILLERS.find((row) => row.masterCode === piece.masterCode)!.width))).toBe(true);
        for (const piece of pieces) {
          expect(cabinetPlacementCollisionDetail(piece, result.placed.filter((item) => item.uid !== piece.uid), room)).toBeNull();
        }
      });
    }
  }

  it("grows only the corner-end upper, never past its own 45° hold, and says so", () => {
    for (const [wallId, at] of [["left", "end"], ["angL", "start"], ["angL", "end"], ["back", "start"]] as const) {
      const end = runEnd(result.placed, room, wallId, "wall", at);
      // 12″ upper hold is 5.5″; the base hold is 11″.
      expect(end.gap).toBeGreaterThanOrEqual(5.5 - 0.05);
      expect(end.gap).toBeLessThan(11);
    }
    expect(result.notes.some((note) => /at the 45° corner on .* became W/.test(note))).toBe(true);
  });

  it("does not leave a measured angled corner open without a finding", () => {
    for (const item of result.placed) {
      if ((item.placement !== "base" && item.placement !== "wall") || isFillerItem(item) || item.fillerPieceGroupId) continue;
      const open = measuredAngledWallTransition(item, room, result.placed);
      if (!open) continue;
      expect(result.reviewFindings.some((finding) => finding.ruleId === "angled-wall-filler")).toBe(true);
    }
  });

  it("closes the refrigerator corner instead of leaving it open (Tom, Nov 16 8:17 AM CT)", () => {
    // A cabinet beside the panel first; the base miter pair against the panel
    // only because no base fits there. No open-corner warning is left.
    const fridgeCorner = result.reviewFindings.filter((finding) => finding.ruleId === "angled-wall-filler"
      && /back and angR|angR and back/.test(finding.title));
    expect(fridgeCorner).toEqual([]);
  });

  it("measures the corner a cabinet actually ends at, not the far end of its wall", () => {
    // angL has a 45° join at both ends. Its last upper must measure the back-wall corner.
    const last = runEnd(result.placed, room, "angL", "wall", "end").item;
    const withoutPairs = result.placed.filter((item) => item.fillerTransitionKind !== "front-miter-pair");
    const measurement = measuredAngledWallTransition(last, room, withoutPairs);
    expect(measurement?.at).toBe("end");
    expect(measurement?.neighborWallId).toBe("back");
  });

  it("reports an upper corner it cannot close when the line has no wall filler wide enough", () => {
    // A line whose only filler stock is 3″: even the grown upper needs a 3⅜″ board.
    const narrow = FILLERS.filter((row) => Number(row.width) <= 3);
    const narrowResult = build(narrow);
    expect(miterPairsBetween(narrowResult.placed, "left", "angL", "base")).toHaveLength(2);
    expect(narrowResult.reviewFindings.some((finding) => finding.code === "angled-upper-corner-open"
      && /left and angL|angL and left/.test(finding.title))).toBe(true);
  });
});
