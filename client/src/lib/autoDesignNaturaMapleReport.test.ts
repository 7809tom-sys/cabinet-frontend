/**
 * Tom's standard-mode 12 x 10 ft L report (Natura Maple, pasted Nov 19 2026, 7:44 AM CT), replayed on
 * the real-catalog line that carries the same SKUs (LSB36 / BBC36 corner, REPV2496 refrigerator panels,
 * F342 / F396 fillers and WFF342 / WFF396 fluted fillers): style 330011 in autoDesignRealCatalog.json.
 *
 *  before (main):  wall row on Wall 1 ... DP1230 | W-15-30 | WFF342 2¼ (fluted, auto) | W1230 ...
 *                  base row: REPV | FRIDGE-36 | BFF3 ½ | REPV | B21 | BFF3 1¾ | RANGE-30 | 3DB18 | LSB36
 *                  notes: "lazy Susan" AND "BBC36 blind corner pulled 6″" for the same corner;
 *                  finding: "Under 15 in between range and range: Only -30 in of counter".
 *  after (branch): wall row ... DP1230 | W1830 (was W-15-30) | F342 1½ | W1230 ... (no WFF)
 *                  base row: FRIDGE-36 (against the wall, no wall-side panel/filler) | REPV | B21 | RANGE-30
 *                  (slid 2¼ in with MW + bridge) | 3DB18 | F342 2¼ | LSB36
 *                  one corner note (lazy Susan), no range-vs-range landing finding.
 */
import { describe, expect, it } from "vitest";
import real from "./__fixtures__/autoDesignRealCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { appliancesForRoom, applianceAsDesignCabinet, cabinetWall, isRefrigerator, wallRunOffset, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const pack = (real as unknown as Record<string, Pack>)["330011"]!;
const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function build() {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      stove: { wallLabel: "Wall 1", centerOffsetIn: 75 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 70 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: [], islandOrPeninsula: "none",
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, []),
    refrigeratorEndPanels: pack.accessory.filter((row) => /^REP/.test(row.masterCode)),
    tallCatalog: [], panelCatalog: pack.accessory,
    styleId: 330011, makeUid: () => `n-${++uid}`,
  } as never) as { ok: boolean; placed: PlacedCabinet[]; notes: string[]; reviewFindings?: Array<{ title: string; detail?: string }> };
  expect(result.ok).toBe(true);
  return result;
}

describe("Natura Maple 12x10 L report (standard mode)", () => {
  const r = build();
  const onWall1 = r.placed.filter((p) => String(cabinetWall(p, ROOM)) === "top");

  it("(a) no fluted filler is auto-placed; the upper after the corner is upgraded instead", () => {
    expect(r.placed.some((p) => /^WFF/i.test(p.masterCode))).toBe(false);
    expect(r.notes.some((n) => /WFF/.test(n))).toBe(false);
    expect(onWall1.some((p) => p.placement === "wall" && p.masterCode === "W1830")).toBe(true);
  });

  it("(b) the landing check never measures the range against itself", () => {
    expect((r.reviewFindings ?? []).some((f) => /range and range/.test(f.title) || /-\d+ in of counter/.test(f.detail ?? ""))).toBe(false);
  });

  it("(c) refrigerator: no wall-side panel or filler, so no '¾ in beside the wall stays open' note", () => {
    const fridge = onWall1.find((p) => isRefrigerator(p) && p.placement === "appliance")!;
    expect(wallRunOffset(fridge, "top", ROOM)).toBeCloseTo(0, 2);
    const panels = onWall1.filter((p) => p.refrigeratorAssemblyId === fridge.uid && /panel/.test(String(p.refrigeratorAssemblyRole ?? "")));
    expect(panels.every((p) => wallRunOffset(p, "top", ROOM) > 1)).toBe(true);
    expect(r.notes.some((n) => /beside the wall stays open/.test(n))).toBe(false);
  });

  it("(e) a lazy Susan corner is not also described as a pulled blind corner", () => {
    const corner = r.notes.filter((n) => n.startsWith("Corner between Wall 1 and Wall 2"));
    expect(corner.some((n) => /lazy Susan/.test(n))).toBe(true);
    expect(corner.some((n) => /blind corner pulled/.test(n))).toBe(false);
  });

});
