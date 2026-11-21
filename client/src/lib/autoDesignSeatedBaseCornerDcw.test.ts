/**
 * Seated base corner gets a DCW upper, never WBC + filler; the span over the
 * dishwasher is a regular wall cabinet (Tom, Nov 20 2026, 9:08-9:10 PM CT).
 *
 * Repro: 144 × 120 L, style 330011, standard mode, sink 72 / range 72.
 * On main 8d2db51 that room seated BBC36 + WBC2730 + a 3 in BFF filler, with
 * the top-wall uppers stopping at W1830 90–108 over the dishwasher.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import {
  cabinetWall,
  isFillerItem,
  isStacker,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { isTrueBlindCornerCode } from "./designerCornerSection";
import { isDiagonalCornerUpperSource } from "./autoDesignWallCabinets";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = 330011;
const BASES = REAL["330011"]!.base as DesignCabinet[];
const WALLS = REAL["330011"]!.wall as DesignCabinet[];
const ACCESSORIES = REAL["330011"]!.accessory as DesignCabinet[];
const FILLERS = ACCESSORIES.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));
const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

function build(opts: { budget: boolean; sinkCenter?: number; rangeCenter?: number }): AutoDesignLayoutSuccess {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: opts.sinkCenter ?? 72 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: opts.rangeCenter ?? 72 },
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 },
      dishwasherSide: "right", skipDishwasher: false,
      tallCabinets: null, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: {
        ...emptyAutoDesignIntake(),
        construction: "new",
        islandOrPeninsula: "none",
        preferences: opts.budget ? ["budget-friendly"] : [],
      },
    } as AutoDesignInputs,
    room: ROOM, openings: [],
    baseCatalog: BASES, wallCatalog: WALLS, fillers: FILLERS,
    appliancePalette: [
      appliance("RANGE-30", 30, 25, 36),
      appliance("DW-24", 24, 24, 34.5),
      appliance("FRIDGE-36", 36, 30, 70),
      appliance("MW-30", 30, 15, 16),
    ],
    refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
    refrigeratorEndPanels: ACCESSORIES.filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
    panelCatalog: ACCESSORIES.filter((row) => /end panel|DWR|WEP|BEP/i.test(`${row.masterCode} ${row.description}`)),
    styleId: STYLE, makeUid: () => `dcw-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

function isUpper(item: PlacedCabinet) {
  return item.placement === "wall" || (item.placement === "appliance" && (Number(item.mountBottom) || 0) > 30);
}

function onWall(placed: readonly PlacedCabinet[], wall: string, upper: boolean) {
  return placed
    .filter((item) => cabinetWall(item, ROOM) === wall && (upper ? isUpper(item) || item.placement === "tall" : !isUpper(item)))
    .map((item) => ({
      item,
      start: wallRunOffset(item, wall, ROOM),
      end: wallRunOffset(item, wall, ROOM) + wallRunSpan(item, wall, ROOM),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function codes(entries: ReturnType<typeof onWall>) {
  return entries.map(({ item, start, end }) =>
    `${item.masterCode}${isFillerItem(item) ? "/F" : ""}${isStacker(item) ? "/S" : ""}:${start}-${end}`).join(" | ");
}

function overlaps(entry: { start: number; end: number }, from: number, to: number) {
  return Math.min(entry.end, to) - Math.max(entry.start, from) > 0.5;
}

describe("standard 144x120 L 330011, sink 72 / range 72: seated BBC gets a DCW, not WBC + filler", () => {
  const result = build({ budget: false, sinkCenter: 72, rangeCenter: 72 });
  const placed = result.placed;
  const bbc = placed.find((item) => item.masterCode === "BBC36");
  const dcw = placed.find((item) => isDiagonalCornerUpperSource(item) && item.placement === "wall" && !isStacker(item));
  const wallBlinds = placed.filter((item) => isTrueBlindCornerCode(item.masterCode) && item.placement === "wall" && !isFillerItem(item));
  const topWall = onWall(placed, "top", true);
  const rightWall = onWall(placed, "right", true);
  const dishwasher = onWall(placed, "top", false).find((entry) => /DW-?24/i.test(entry.item.masterCode));

  it("still seats the BBC36 base corner at the inside 90°", () => {
    expect(bbc, `bases: top ${codes(onWall(placed, "top", false))} | right ${codes(onWall(placed, "right", false))}`).toBeTruthy();
  });

  it("seats a DCW2430 at that corner and never a WBC plus 3 in filler", () => {
    expect(dcw, `uppers: top ${codes(topWall)} | right ${codes(rightWall)}`).toBeTruthy();
    expect(dcw!.masterCode).toBe("DCW2430");
    expect(wallBlinds.map((item) => item.masterCode)).toEqual([]);
    const bffBesideBlind = placed.filter((item) => isFillerItem(item) && /BFF3|F342/.test(item.masterCode)
      && item.placement === "wall"
      && wallBlinds.some((blind) => cabinetWall(item, ROOM) === cabinetWall(blind, ROOM)));
    expect(bffBesideBlind.map((item) => item.masterCode)).toEqual([]);
    expect(result.notes.join("\n")).toMatch(/DCW2430/);
  });

  it("fills the span over the dishwasher with a regular wall cabinet, not a blind corner or filler-only gap", () => {
    expect(dishwasher).toBeTruthy();
    const overDw = topWall.filter((entry) => !isFillerItem(entry.item) && !isStacker(entry.item)
      && overlaps(entry, dishwasher!.start, dishwasher!.end));
    const regular = overDw.filter((entry) =>
      !isTrueBlindCornerCode(entry.item.masterCode)
      && !isDiagonalCornerUpperSource(entry.item)
      && /^W\d/.test(entry.item.masterCode));
    expect(regular, `top wall over DW ${dishwasher!.start}–${dishwasher!.end}: ${codes(topWall)}`).not.toHaveLength(0);
    // Least-filler: a stock width such as W2730 / W2430 / W1830, not a 3 in leftover next to a WBC.
    expect(regular.some((entry) => entry.end - entry.start >= 15 - 0.1)).toBe(true);
  });
});

describe("budget mode on the same 144x120 L keeps the previous BBC/WBC path unless it already used a DCW", () => {
  const result = build({ budget: true, sinkCenter: 72, rangeCenter: 72 });
  const placed = result.placed;
  const bbc = placed.find((item) => item.masterCode === "BBC36");
  const wbc = placed.filter((item) => /^WBC/i.test(item.masterCode) && item.placement === "wall" && !isFillerItem(item));

  it("does not switch a seated budget BBC from its existing wall-blind path to this standard-mode rule", () => {
    // Budget may seat a BBC (then WBC is still allowed) or use an empty-corner /
    // economy path (then a DCW may already be present). Either way this PR must
    // not remove a budget WBC that was already the seated-base path.
    if (bbc && wbc.length === 0) {
      throw new Error(`budget BBC36 is seated but the wall-blind path was removed; uppers: top ${codes(onWall(placed, "top", true))} | right ${codes(onWall(placed, "right", true))}`);
    }
    expect(true).toBe(true);
  });
});
