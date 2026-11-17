import { describe, expect, it } from "vitest";
import live from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { ensureBlindCornerFlankCabinets } from "./autoDesignBlindCornerFlank";
import {
  appliancesForRoom,
  applianceAsDesignCabinet,
  isFillerItem,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallOpening,
} from "./design";

/**
 * Corner flank rule (Tom, Nov 17 2026, voice 11:14 AM CT): a blind corner
 * cabinet always gets a real cabinet right beside it on both sides. The Nov 17
 * demo kitchen (144 × 120 L, Aero Solstice, 108 in ceiling) left the upper in
 * front of the WBC2730's blind side blank: W2730 stopped at 120 on the sink
 * wall while the WBC face sits at 132, because the 24 in corner-square
 * reservation kept every gap pass out of 120–132.
 */
const LIVE = live as unknown as {
  base: DesignCabinet[];
  wall: DesignCabinet[];
  accessory: DesignCabinet[];
  tall: DesignCabinet[];
  surround: { deepAbove: DesignCabinet[]; endPanels: DesignCabinet[] };
};

const demoWindow = {
  uid: "demo-sink-window", kind: "window", label: "Window 36\"", side: "top",
  offset: 54, width: 36, height: 42, sill: 42,
} as WallOpening;

function runDemo(): AutoDesignLayoutSuccess {
  const room = { width: 144, depth: 120, ceilingHeight: 108, openWallPath: false } as RoomData;
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape",
      originCorner: "left",
      runDirection: "right",
      wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 72 },
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 54 },
      refrigerator: { wallLabel: "Wall 2", centerOffsetIn: 100 },
      refrigeratorWidthIn: 36,
      dishwasherSide: "right",
      skipDishwasher: false,
      tallCabinets: null,
      overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      designQuestionDoorStyleId: 390019,
      designQuestionDoorStyleName: "Aero Solstice",
      intake: {
        ...emptyAutoDesignIntake(),
        construction: "new",
        preferences: ["glass-uppers", "crown-molding", "dishwasher"],
        islandOrPeninsula: "island",
      },
    },
    room,
    openings: [demoWindow],
    baseCatalog: LIVE.base,
    wallCatalog: LIVE.wall,
    fillers: LIVE.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(LIVE.wall, LIVE.surround.deepAbove),
    refrigeratorEndPanels: LIVE.surround.endPanels,
    tallCatalog: LIVE.tall,
    panelCatalog: LIVE.accessory,
    styleId: 390019,
    makeUid: () => `flank-${++uid}`,
  } as never) as AutoDesignLayoutSuccess;
  expect(result.ok).toBe(true);
  return result;
}

const room = { width: 144, depth: 120, ceilingHeight: 108, openWallPath: false } as RoomData;
const span = (item: PlacedCabinet, wallId: string) => {
  const start = wallRunOffset(item, wallId, room);
  return { start, end: start + wallRunSpan(item, wallId, room) };
};

describe("blind corner flank rule — Nov 17 2026 demo kitchen", () => {
  const result = runDemo();
  const placed = result.placed;
  const wbc = placed.find((item) => item.masterCode === "WBC2730")!;
  const bbc = placed.find((item) => item.masterCode === "BBC36")!;

  it("still seats the WBC2730 and BBC36 at the sink-wall / range-wall corner", () => {
    expect(wbc).toBeTruthy();
    expect(bbc).toBeTruthy();
    expect(wbc.wallId ?? "right").toBe("right");
  });

  it("fills the upper in front of the WBC2730's blind side (sink wall 120–132) with a real wall cabinet", () => {
    const flank = placed.filter((item) => item.placement === "wall" && !isFillerItem(item))
      .filter((item) => (item.wallId ?? "top") === "top" && item.y < 1)
      .find((item) => Math.abs(span(item, "top").end - 132) <= 0.3);
    expect(flank, "an upper must butt the WBC2730 face at 132").toBeTruthy();
    expect(span(flank!, "top").start).toBeCloseTo(120, 1);
    expect(flank!.masterCode).toBe("W1230");
    expect(flank!.cabinetId).toBeGreaterThan(0);
    // Same elevation band as the WBC it flanks.
    expect(Number(flank!.mountBottom)).toBeCloseTo(Number(wbc.mountBottom ?? 54), 1);
    // Nothing else hangs in 120–132 on the sink wall in the flank's own
    // elevation band. A glass stacker (glass-uppers pick) may sit on top of it.
    const flankBottom = Number(flank!.mountBottom ?? 54);
    const flankTop = flankBottom + Number(flank!.height);
    const inSpan = placed.filter((item) => item.uid !== flank!.uid && item.placement === "wall" && item.y < 1 && item.rotation === 0)
      .filter((item) => { const s = span(item, "top"); return s.start < 131.7 && s.end > 120.3; });
    const overlap = inSpan.filter((item) => {
      const bottom = Number(item.mountBottom ?? 54);
      return bottom < flankTop - 0.3 && bottom + Number(item.height) > flankBottom + 0.3;
    });
    expect(overlap.map((item) => item.masterCode)).toEqual([]);
    // Glass is picked in this demo, so the flank carries its own glass stacker
    // on top (Tom, Nov 17 2026: every upper gets a stacker).
    const stackers = inSpan.filter((item) => !overlap.includes(item));
    expect(stackers.map((item) => item.masterCode)).toEqual(["W1218GD"]);
    expect(Number(stackers[0]!.mountBottom)).toBeCloseTo(flankTop, 1);
  });

  it("keeps the WBC2730's open-side flank (W1230 on the range wall at 27–39)", () => {
    const open = placed.find((item) => item.placement === "wall" && item.masterCode === "W1230" && item.rotation === 90);
    expect(open).toBeTruthy();
    expect(span(open!, "right").start).toBeCloseTo(27, 1);
  });

  it("names the BBC36 corner when no base cabinet fits beside it, instead of leaving it silent", () => {
    const flank = result.reviewFindings.filter((finding) => finding.code === "blind-corner-flank-missing");
    expect(flank.map((finding) => finding.title)).toEqual([
      "BBC36 at the Wall 2 / Wall 1 corner has no cabinet on its blind side",
      "BBC36 at the Wall 2 / Wall 1 corner has no cabinet on its open side",
    ]);
    expect(flank.every((finding) => finding.severity === "warning" && finding.cabinetCode === "BBC36")).toBe(true);
    expect(result.warnings.some((warning) => warning.startsWith("BBC36 at the Wall 2 / Wall 1 corner has no cabinet on its blind side"))).toBe(true);
    // No upper blind corner is reported missing: both WBC flanks are real cabinets now.
    expect(flank.some((finding) => finding.cabinetCode === "WBC2730")).toBe(false);
  });
});

describe("ensureBlindCornerFlankCabinets", () => {
  const row = (code: string, width: number, placement: "base" | "wall", extra: Partial<DesignCabinet> = {}) => ({
    id: 1000 + width + (placement === "wall" ? 500 : 0), masterCode: code, description: `${width}" ${placement} cabinet`,
    category: "Cabinet", subCategory: placement === "wall" ? "Standard Wall" : "Standard Base",
    width: String(width), depth: placement === "wall" ? "12" : "24", height: placement === "wall" ? "30" : "34.5",
    placement, numberOfDoors: 1, numberOfDrawers: placement === "base" ? 1 : 0, ...extra,
  }) as DesignCabinet;
  const baseCatalog = [row("B9", 9, "base"), row("B12", 12, "base"), row("B15", 15, "base"), row("B18", 18, "base")];
  const piece = (uid: string, code: string, placement: PlacedCabinet["placement"], x: number, y: number, width: number, depth: number, rotation: number, extra: Partial<PlacedCabinet> = {}) => ({
    uid, cabinetId: 1, masterCode: code, description: code, placement, x, y, width, depth, height: 34.5, rotation, ...extra,
  }) as PlacedCabinet;
  // BBC36 on the right wall pulled 3 in, its blind side toward the top wall.
  const bbc = piece("bbc", "BBC36", "base", 120, 3, 36, 24, 90, { description: "36\" Base Blind Corner" });
  const room2 = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

  it("seats a stock base in an empty blind-side opening, butted to the BBC face", () => {
    const placed = [bbc, piece("b1", "B30", "base", 75, 0, 30, 24, 0), piece("r", "B24", "base", 120, 39, 24, 24, 90)];
    const out = ensureBlindCornerFlankCabinets({
      placed, room: room2, openings: [], wallCatalog: [], baseCatalog, wallHeightIn: 30, styleId: 1, makeUid: () => "new",
    });
    const added = out.additions.map((item) => `${item.masterCode}@${item.x}`);
    expect(added).toEqual(["B15@105"]);
    expect(out.findings).toEqual([]);
  });

  it("swaps a plain filler for a cabinet only when stock widths close its whole span", () => {
    const filler = piece("f", "F342", "base", 108, 0, 12, 24, 0, { description: "3\" x 42\" Filler — cut to 12\"", subCategory: "Filler" });
    const placed = [bbc, piece("b1", "B30", "base", 78, 0, 30, 24, 0), filler, piece("r", "B24", "base", 120, 39, 24, 24, 90)];
    const out = ensureBlindCornerFlankCabinets({
      placed, room: room2, openings: [], wallCatalog: [], baseCatalog, wallHeightIn: 30, styleId: 1, makeUid: () => "new",
    });
    expect(out.additions.map((item) => item.masterCode)).toEqual(["B12"]);
    expect(out.placed.some((item) => item.uid === "f")).toBe(false);
  });

  it("warns, naming the corner, when an appliance sits beside the blind corner", () => {
    const placed = [bbc, piece("dw", "DW-24", "appliance", 96, 0, 24, 24, 0), piece("r", "B24", "base", 120, 39, 24, 24, 90)];
    const out = ensureBlindCornerFlankCabinets({
      placed, room: room2, openings: [], wallCatalog: [], baseCatalog, wallHeightIn: 30, styleId: 1, makeUid: () => "new",
      wallLabelOf: (wallId) => (wallId === "top" ? "Wall 1" : wallId === "right" ? "Wall 2" : null),
    });
    expect(out.additions).toEqual([]);
    expect(out.findings.map((finding) => finding.title)).toEqual(["BBC36 at the Wall 2 / Wall 1 corner has no cabinet on its blind side"]);
    expect(out.findings[0]!.detail).toContain("DW-24 sits there");
  });
});
