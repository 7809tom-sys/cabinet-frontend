import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AEF_PRINTED_GEOMETRY_MARKER, FRAMELESS_STANDARD_WALL_DEPTH_IN, isFramelessDeepWallCabinet } from "@shared/aefFramelessGeometry";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import { keepSingleAutoDesignSink, autoBuildStraightBaseCatalog } from "./autoDesignAutoBuild";
import { autoDesignRunWallIds } from "./autoDesignCornerStage";
import { AUTO_DESIGN_FILLER_MAX_IN, planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import { autoDesignRangeHood } from "./autoDesignRangeHood";
import { buildAutoDesignWallCabinets, sinkHasWindowAbove } from "./autoDesignWallCabinets";
import { QUALIFIED_AUTO_PANEL_REASONS } from "./exposedSidePanels";
import { requiresAutoEndPanels } from "./autoEndPanels";
import { AEF_END_PANEL_THICKNESS_IN } from "./aefEndPanelStock";
import { DEFAULT_ROOM, footprintDepth, wallPlacementAt, type DesignCabinet, type PlacedCabinet, type WallOpening } from "./design";
import { kitchenRuleNumber, resetKitchenRuleParameters } from "./kitchenRuleParameters";

const fixture = catalogFixture as unknown as Record<string, { base: DesignCabinet[]; wall: DesignCabinet[] }>;
const framelessWall = fixture["540005"]!.wall;
const framelessBase = fixture["540005"]!.base;

function wallBox(partial: Partial<DesignCabinet> & Pick<DesignCabinet, "masterCode">): DesignCabinet {
  return {
    id: 1,
    description: partial.masterCode,
    category: "Wall",
    subCategory: "Standard Wall",
    width: "30",
    height: "30.25",
    depth: "13.5",
    placement: "wall",
    constructionMethod: AEF_PRINTED_GEOMETRY_MARKER,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    isCornerCabinet: false,
    ...partial,
  } as DesignCabinet;
}

describe("Auto-Design rule: frameless walls are 13.5 inches deep", () => {
  it("places a standard frameless wall at 13.5 even when the stored depth is the old 12 inch fallback", () => {
    const cabinet = wallBox({ masterCode: "W3030", depth: "12" });
    expect(footprintDepth(cabinet)).toBe(FRAMELESS_STANDARD_WALL_DEPTH_IN);
    expect(isFramelessDeepWallCabinet(cabinet)).toBe(false);
  });

  it("keeps a 24 inch deep wall box at 24 and refuses it in a normal upper run", () => {
    const deep = wallBox({
      id: 2,
      masterCode: "W361224",
      description: "36 x 12 x 24 Refrigerator Wall",
      subCategory: "Refrigerator Wall",
      width: "36",
      height: "30.25",
      depth: "24",
    });
    const standard = wallBox({ id: 3, masterCode: "W3630", width: "36", depth: "13.5" });
    expect(footprintDepth(deep)).toBe(24);
    expect(isFramelessDeepWallCabinet(deep)).toBe(true);
    const base = {
      uid: "b36", cabinetId: 9, masterCode: "B36", description: "Base", placement: "base",
      ...wallPlacementAt(0, 36, 24, "top", DEFAULT_ROOM), width: 36, depth: 24, height: 34.5,
    } as PlacedCabinet;
    const result = buildAutoDesignWallCabinets({
      placed: [base], room: DEFAULT_ROOM, openings: [], catalog: [deep, standard],
      wallCabinetHeightIn: 30, styleId: 540005, makeUid: () => "upper",
    });
    expect(result.additions.map((item) => item.masterCode)).toContain("W3630");
    expect(result.additions.map((item) => item.masterCode)).not.toContain("W361224");
    expect(result.additions.find((item) => item.masterCode === "W3630")?.depth).toBe(13.5);
  });
});

describe("Auto-Design rule: an empty wall is filled", () => {
  it("includes the 120 inch left wall of a closed room and covers that length with bases plus at most a 3 inch filler", () => {
    expect(autoDesignRunWallIds({
      layoutType: "u-shape", room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
      wallIds: ["top", "right", "bottom", "left"],
    })).toContain("left");
    const plan = planAutoDesignBaseSegment({
      length: 120, catalog: autoBuildStraightBaseCatalog(framelessBase), rangeAtStart: false, rangeAtEnd: false,
    });
    const covered = plan.items.reduce((sum, item) => sum + item.width, 0);
    const filler = plan.items.filter((item) => item.isFiller).reduce((sum, item) => sum + item.width, 0);
    expect(covered).toBeCloseTo(120, 2);
    expect(filler).toBeLessThanOrEqual(AUTO_DESIGN_FILLER_MAX_IN + 0.001);
  });

  it("puts 3/4 inch panels on an open frameless run end and not on an end that sits against a wall", () => {
    expect(AEF_END_PANEL_THICKNESS_IN).toBe(0.75);
    expect(QUALIFIED_AUTO_PANEL_REASONS).toContain("open-end-of-run");
    expect(QUALIFIED_AUTO_PANEL_REASONS).not.toContain("end-of-run-against-wall");
    expect(requiresAutoEndPanels({ styleCode: "LSC", isFrameless: true, ourName: "Luxe Classic LSC" })).toBe(true);
  });
});

describe("Auto-Design rule: a corner refrigerator stays put", () => {
  it("keeps the corner-occupant refrigerator in the bay module (PR 133 landed) and out of the seating module", () => {
    const designTool = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
    const seating = readFileSync(resolve(process.cwd(), "client/src/lib/autoDesignCornerSeating.ts"), "utf8");
    const bay = readFileSync(resolve(process.cwd(), "client/src/lib/autoDesignRefrigeratorBay.ts"), "utf8");
    expect(designTool).toContain("PR #133");
    expect(designTool).toContain("cursor/frameless-corner-fridge-a890");
    expect(seating).not.toContain("autoDesignLaysOutAroundCornerRefrigerator");
    // PR #133's measured-corner bay acceptance now lives in the bay module (one definition, used by DesignTool).
    expect(bay.match(/export function acceptMeasuredCornerRefrigeratorBay\b/g)).toHaveLength(1);
  });
});

describe("Auto-Design rule: one sink", () => {
  it("keeps the fixture on the measured sink base and drops a second basin", () => {
    const sinks = [
      { uid: "real", cabinetUid: "sb" },
      { uid: "extra", cabinetUid: "other" },
    ];
    expect(keepSingleAutoDesignSink(sinks, "sb")).toEqual([{ uid: "real", cabinetUid: "sb" }]);
    expect(autoBuildStraightBaseCatalog(framelessBase).some((row) => /^SB/i.test(row.masterCode))).toBe(false);
  });
});

describe("Auto-Design rule: uppers over the sink and the range", () => {
  it("leaves the sink wall open only when a window is there, and says so", () => {
    const sink = {
      uid: "sb", cabinetId: 1, masterCode: "SB36", description: "Sink Base", subCategory: "Sink Base",
      placement: "base", ...wallPlacementAt(40, 36, 24, "top", DEFAULT_ROOM), width: 36, depth: 24, height: 34.5,
    } as PlacedCabinet;
    const windowOverSink: WallOpening = { uid: "win", kind: "window", label: "Window", side: "top", offset: 40, width: 36, height: 36, sill: 42 };
    expect(sinkHasWindowAbove(sink, [], DEFAULT_ROOM)).toBe(false);
    expect(sinkHasWindowAbove(sink, [windowOverSink], DEFAULT_ROOM)).toBe(true);
    const result = buildAutoDesignWallCabinets({
      placed: [sink], room: DEFAULT_ROOM, openings: [windowOverSink], catalog: framelessWall,
      wallCabinetHeightIn: 30, styleId: 540005, makeUid: () => "w",
    });
    expect(result.skipped.join(" ")).toMatch(/window is over the sink/);
    expect(result.additions.some((item) => item.placement === "wall" && item.width >= 30)).toBe(false);
  });

  it("raises only the 42 inch hood to 60 inches and places W3012 at 13.5 before the depth SQL", () => {
    resetKitchenRuleParameters();
    expect(kitchenRuleNumber("hood_bottom_in")).toBe(60);
    const w3012 = framelessWall.find((row) => row.masterCode === "W3012");
    expect(w3012).toBeTruthy();
    expect(Number(w3012!.depth)).toBe(12);
    expect(footprintDepth(w3012!)).toBe(13.5);
    const range = {
      uid: "range", cabinetId: 0, masterCode: "RANGE-42", description: "Range", placement: "appliance",
      ...wallPlacementAt(40, 42, 25, "right", DEFAULT_ROOM), width: 42, depth: 25, height: 36,
    } as PlacedCabinet;
    const hood = autoDesignRangeHood({
      range, room: DEFAULT_ROOM, uid: "hood",
      palette: [{ id: 0, masterCode: "HOOD-42", description: "42 inch hood", width: "42", depth: "18", height: "18", placement: "appliance", mountBottom: 66 } as DesignCabinet],
    });
    expect(hood.ok).toBe(true);
    if (hood.ok) expect(hood.hood.mountBottom).toBe(60);
  });
});

describe("Auto-Design rule: base runs close to the measured length", () => {
  it("covers a 29.25 inch top-wall gap with cabinets and at most a 3 inch filler", () => {
    const plan = planAutoDesignBaseSegment({
      length: 29.25, catalog: autoBuildStraightBaseCatalog(framelessBase), rangeAtStart: false, rangeAtEnd: false,
    });
    const covered = plan.items.reduce((sum, item) => sum + item.width, 0);
    const filler = plan.items.filter((item) => item.isFiller);
    expect(covered).toBeCloseTo(29.25, 2);
    expect(filler.every((item) => item.width <= AUTO_DESIGN_FILLER_MAX_IN + 0.001)).toBe(true);
  });
});
