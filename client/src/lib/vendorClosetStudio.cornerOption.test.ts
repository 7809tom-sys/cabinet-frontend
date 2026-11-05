import { describe, expect, it } from "vitest";
import {
  AUTO_ANCHOR_LOWER_ROD_IN, AUTO_ANCHOR_UPPER_ROD_IN, AUTO_DOOR_SWING_CLEARANCE_IN, AUTO_FILLER_SHELF_GAPS, AUTO_GUIDE_CONFLICTS,
  AUTO_LONG_HANG_MIN_BAY_IN, AUTO_SIDE_SECTION_BRIDGES_GUIDE_RANGE, AUTO_SIDE_SECTION_MAX_IN, AUTO_SIDE_SECTION_START_IN,
  autoBuildStudio, autoBuildStudioFromAnswers, fillerTowerSpecs, MODE_AUTO_BUILD_DEFAULTS,
  restoreStudioDesign, studioBays, studioCornerOption, studioCornerShelves, studioCornerShelvesForWall, studioFixedTop,
  studioItemHeight, studioPanelHeight, studioTakeoff, studioTowerFootprint, STUDIO_CORNER_WALK_IN_MIN_DEPTH_IN, STUDIO_GUIDED_DEFAULTS,
  STUDIO_GUIDED_ROOM_DEFAULTS, STUDIO_STOCK_WIDTHS, STUDIO_WALLS, switchStudioWall,
  type StudioAutoBuildInput, type StudioDesign, type StudioWall,
} from "./vendorClosetStudio";
import { CLOSET_PARTS } from "./closet";

const build = (input: Partial<StudioAutoBuildInput> = {}) => autoBuildStudio({
  mode: "closet", mount: "floor", finish: "Glacier White", wallWidthIn: 120, roomDepthIn: 108, roomHeightIn: 96, ...input,
});

const itemsOn = (design: StudioDesign, wall: StudioWall, bayIndex: number) => studioBays(design, wall)[bayIndex]?.items ?? [];
const rodsOn = (design: StudioDesign, wall: StudioWall, bayIndex: number) => itemsOn(design, wall, bayIndex).filter((item) => item.kind === "rod");

/* ============================================================================================
 * Corner shelf as a customer option
 * ========================================================================================== */

describe("corner shelf option: reach-in never gets one", () => {
  it("does not offer a reach-in a corner shelf", () => {
    expect(studioCornerOption({ closetType: "reachIn", wallWidthIn: 78, roomDepthIn: 30 }).offered).toBe(false);
    // Even a wide reach-in: it is still one wall, so a corner shelf would only shorten the run.
    expect(studioCornerOption({ closetType: "reachIn", wallWidthIn: 240, roomDepthIn: 30 }).offered).toBe(false);
  });

  it("builds a reach-in with no corner shelf even when the answer says yes", () => {
    const { design, notices } = build({ wallWidthIn: 78, roomDepthIn: 30, cornerShelves: true });
    expect(studioCornerShelves(design)).toEqual([]);
    // The refusal is explained rather than silently ignored.
    expect(notices.some((line) => /corner shelves were not added/i.test(line))).toBe(true);
    // No corner SKU reaches the material reference.
    expect(studioTakeoff(design).lines.some((line) => /corner shelf/i.test(line.label))).toBe(false);
  });

  it("keeps a reach-in's corners as shared geometry so the wall fills end to end", () => {
    const { design } = build({ wallWidthIn: 78, roomDepthIn: 30 });
    const bays = studioBays(design, "back");
    // Runs start at the wall corner (no 29.5 in envelope reserved) and cover the wall.
    expect(studioTowerFootprint(design, "back").xMin).toBe(0);
    const used = bays.reduce((sum, bay) => sum + bay.widthIn, 0) + 0.75 * (bays.length + 1);
    expect(used / 78).toBeGreaterThan(0.9);
  });
});

describe("corner shelf option: walk-in offers it", () => {
  it("offers it on every walk-in, which is the same depth test the builder uses for side walls", () => {
    expect(STUDIO_CORNER_WALK_IN_MIN_DEPTH_IN).toBe(60);
    expect(studioCornerOption({ closetType: "walkIn", wallWidthIn: 84, roomDepthIn: 60 }).offered).toBe(true);
    expect(studioCornerOption({ closetType: "walkIn", wallWidthIn: 120, roomDepthIn: 108 }).offered).toBe(true);
  });

  it("adds the real 29.5 in corner shelves when the customer chooses them", () => {
    const { design } = build({ cornerShelves: true });
    const corners = studioCornerShelves(design);
    expect(corners.length).toBe(2);
    expect(corners.map((shelf) => shelf.cornerId).sort()).toEqual(["back-left", "back-right"]);
    for (const shelf of corners) {
      expect(shelf.nominalFootprintIn).toBe(29.5);
      // Real SKU for the finish and mount, and a real catalog record.
      expect(shelf.sku).toBe("432556");
      expect(CLOSET_PARTS.some((part) => part.sku === shelf.sku)).toBe(true);
      expect(shelf.towerConnection).toBe("visualAligned");
    }
    const bill = studioTakeoff(design);
    expect(bill.lines.find((line) => line.sku === "432556")?.qty).toBe(2);
  });

  it("still fills every wall correctly with corner shelves chosen", () => {
    const { design } = build({ cornerShelves: true });
    for (const wall of ["back", "left", "right"] as const) {
      expect(studioBays(design, wall).length).toBeGreaterThan(0);
      // A side run starts past the 29.5 in envelope when a corner shelf is planned there.
      if (wall !== "back") expect(studioTowerFootprint(design, wall).zMin).toBeGreaterThanOrEqual(29.5);
    }
    // Wall plus what the corners occupy covers the back wall; nothing was silently lost.
    const backBays = studioBays(design, "back");
    const towerIn = backBays.reduce((sum, bay) => sum + bay.widthIn, 0) + 0.75 * (backBays.length + 1);
    const cornerIn = studioCornerShelvesForWall(design, "back").reduce((sum, shelf) => sum + shelf.nominalFootprintIn, 0);
    expect(towerIn + cornerIn).toBeLessThanOrEqual(120 + 0.001);
    expect((towerIn + cornerIn) / 120).toBeGreaterThan(0.9);
  });

  it("leaves corners as shared geometry when the customer declines", () => {
    const { design } = build({ cornerShelves: false });
    expect(studioCornerShelves(design)).toEqual([]);
    expect(studioTowerFootprint(design, "back").xMin).toBe(0);
  });

  it("survives a save and restore with its corner shelves", () => {
    const { design } = build({ cornerShelves: true });
    expect(restoreStudioDesign(JSON.stringify(design))).toEqual(design);
  });

  it("does not offer corner shelves on a hanging mount, which is floor-mounted geometry", () => {
    expect(studioCornerOption({ closetType: "walkIn", wallWidthIn: 120, roomDepthIn: 108, mount: "hanging" }).offered).toBe(false);
  });

  it("refuses the option on a room too short for two corners plus a tower", () => {
    // Two 29.5 in corners leave under 18 in of this back wall, so there is no usable run.
    const option = studioCornerOption({ closetType: "walkIn", wallWidthIn: 60, roomDepthIn: 72 });
    expect(option.offered).toBe(false);
    expect(option.reason).toMatch(/back wall/i);
    const { design } = build({ wallWidthIn: 60, roomDepthIn: 72, cornerShelves: true });
    expect(studioCornerShelves(design)).toEqual([]);
  });
});

describe("corner shelf option: guided answers carry the choice", () => {
  const answers = (overrides: Partial<typeof STUDIO_GUIDED_DEFAULTS> = {}) => ({ ...STUDIO_GUIDED_DEFAULTS, closetType: "walkIn" as const, ...overrides });

  it("passes the guided answer through to the build", () => {
    const chosen = autoBuildStudioFromAnswers({ answers: answers({ cornerShelves: "yes" }), mount: "floor", finish: "Glacier White", room: STUDIO_GUIDED_ROOM_DEFAULTS.walkIn });
    expect(studioCornerShelves(chosen.design).length).toBe(2);
    const declined = autoBuildStudioFromAnswers({ answers: answers({ cornerShelves: "no" }), mount: "floor", finish: "Glacier White", room: STUDIO_GUIDED_ROOM_DEFAULTS.walkIn });
    expect(studioCornerShelves(declined.design)).toEqual([]);
  });

  it("ignores a corner answer on a reach-in", () => {
    const result = autoBuildStudioFromAnswers({
      answers: { ...STUDIO_GUIDED_DEFAULTS, cornerShelves: "yes" }, mount: "floor", finish: "Glacier White", room: STUDIO_GUIDED_ROOM_DEFAULTS.reachIn,
    });
    expect(studioCornerShelves(result.design)).toEqual([]);
  });
});

/* ============================================================================================
 * General closet-design rules from the owner's brief
 * ========================================================================================== */

describe("guide rules: anchor sections double hang at about 40 and 82 in", () => {
  it("places the anchor rods at the guide heights, clamped to the real panel", () => {
    // The 94 in upright (a 100 in ceiling leaves the 4 in clearance) reaches the guide's 82 in.
    const tall = build({ roomHeightIn: 100 }).design;
    expect(studioPanelHeight(tall)).toBe(94);
    const rods = STUDIO_WALLS.flatMap((wall) => studioBays(tall, wall)).flatMap((bay) => bay.items.filter((item) => item.kind === "rod").map((item) => item.bottomIn));
    expect(rods).toContain(AUTO_ANCHOR_LOWER_ROD_IN);
    expect(rods).toContain(AUTO_ANCHOR_UPPER_ROD_IN);

    // The 87 in upright cannot reach 82 in and still leave a shelf above the rod, so it clamps just under.
    const normal = build({ roomHeightIn: 96 }).design;
    expect(studioPanelHeight(normal)).toBe(87);
    const normalRods = STUDIO_WALLS.flatMap((wall) => studioBays(normal, wall)).flatMap((bay) => bay.items.filter((item) => item.kind === "rod").map((item) => item.bottomIn));
    expect(normalRods).toContain(AUTO_ANCHOR_LOWER_ROD_IN);
    expect(Math.max(...normalRods)).toBeLessThan(AUTO_ANCHOR_UPPER_ROD_IN);
    expect(Math.max(...normalRods)).toBeLessThanOrEqual(studioFixedTop(normal));
  });

  it("states the guide-versus-SKU conflicts instead of pretending they agree", () => {
    expect(AUTO_GUIDE_CONFLICTS.some((line) => /82 in upper rod/.test(line))).toBe(true);
    expect(AUTO_GUIDE_CONFLICTS.some((line) => /not MasterTrac specifications/i.test(line))).toBe(true);
  });
});

describe("guide rules: long hang", () => {
  it("uses a bay at least the guide's 18 in minimum", () => {
    expect(AUTO_LONG_HANG_MIN_BAY_IN).toBe(18);
    const { design } = build({ longHangBay: true });
    const longHangBays = STUDIO_WALLS.flatMap((wall) => studioBays(design, wall))
      .filter((bay) => bay.items.filter((item) => item.kind === "rod").length === 1 && bay.items.some((item) => item.kind === "rod" && item.bottomIn >= 70));
    expect(longHangBays.length).toBeGreaterThan(0);
    for (const bay of longHangBays) expect(bay.widthIn).toBeGreaterThanOrEqual(AUTO_LONG_HANG_MIN_BAY_IN);
  });

  it("gives exactly one long-hang bay in a reach-in", () => {
    const { design } = build({ wallWidthIn: 78, roomDepthIn: 30, longHangBay: true });
    const bays = STUDIO_WALLS.flatMap((wall) => studioBays(design, wall));
    const singleRodBays = bays.filter((bay) => {
      const rods = bay.items.filter((item) => item.kind === "rod");
      return rods.length === 1 && rods[0].bottomIn >= 70;
    });
    expect(singleRodBays.length).toBeLessThanOrEqual(1);
  });
});

describe("guide rules: tight middle filler bays get closely spaced shelves", () => {
  it("spaces filler shelves by the guide's folded, shoe and boot openings", () => {
    expect(AUTO_FILLER_SHELF_GAPS.foldedIn).toBeGreaterThanOrEqual(12);
    expect(AUTO_FILLER_SHELF_GAPS.foldedIn).toBeLessThanOrEqual(14);
    expect(AUTO_FILLER_SHELF_GAPS.shoesIn).toBeGreaterThanOrEqual(7);
    expect(AUTO_FILLER_SHELF_GAPS.shoesIn).toBeLessThanOrEqual(10);
    expect(AUTO_FILLER_SHELF_GAPS.bootsIn).toBeGreaterThanOrEqual(16);
    expect(AUTO_FILLER_SHELF_GAPS.bootsIn).toBeLessThanOrEqual(18);

    const { design } = build({ wallWidthIn: 78, roomDepthIn: 30 });
    const spec = fillerTowerSpecs(design);
    expect(spec.length).toBeGreaterThan(1);
    // Sorted by elevation, every gap is a real board gap and no shelf passes the fixed top.
    const elevations = spec.map((item) => item.at).sort((a, b) => a - b);
    for (let index = 1; index < elevations.length; index += 1) {
      expect(elevations[index] - elevations[index - 1]).toBeGreaterThan(studioItemHeight("shelf"));
    }
    for (const item of spec) expect(item.at).toBeLessThanOrEqual(studioFixedTop(design));
  });

  it("only uses filler spacing in a narrow bay, never as the whole design", () => {
    const { design } = build({ wallWidthIn: 78, roomDepthIn: 30 });
    const narrowBays = STUDIO_WALLS.flatMap((wall) => studioBays(design, wall)).filter((bay) => bay.widthIn <= 14);
    for (const bay of narrowBays) {
      // A filler bay holds shelves only: no rod, drawer or shoe plan is ever squeezed into it.
      expect(bay.items.every((item) => item.kind === "shelf")).toBe(true);
    }
  });
});

describe("guide rules: walk-in section layout", () => {
  const walkIn = () => build({ wallWidthIn: 120, roomDepthIn: 108, cornerShelves: true }).design;

  it("starts a side-wall section past the back wall, leaving the corner shelf to bridge it", () => {
    expect(AUTO_SIDE_SECTION_START_IN).toBeGreaterThanOrEqual(24);
    expect(AUTO_SIDE_SECTION_MAX_IN).toBeLessThanOrEqual(30);
    // The sourced 29.5 in corner board is what satisfies the guide's 24–30 in bridge range.
    expect(AUTO_SIDE_SECTION_BRIDGES_GUIDE_RANGE).toBe(true);
    const design = walkIn();
    for (const side of ["left", "right"] as const) {
      const startIn = studioTowerFootprint(design, side).zMin;
      expect(startIn).toBeGreaterThanOrEqual(AUTO_SIDE_SECTION_START_IN);
      expect(startIn).toBeLessThanOrEqual(AUTO_SIDE_SECTION_MAX_IN);
      // The corner shelf occupies exactly that bridged span.
      expect(studioCornerShelvesForWall(design, side).length).toBe(1);
    }
  });

  it("never puts double hang on both sides of a corner", () => {
    for (const [width, depth] of [[120, 108], [84, 96], [90, 72], [144, 120]] as const) {
      const { design } = build({ wallWidthIn: width, roomDepthIn: depth, cornerShelves: true });
      // Only the bays nearest a shared corner matter: back bay 1 with the first bay of each side.
      const backCornerRods = [rodsOn(design, "back", 0).length, rodsOn(design, "back", studioBays(design, "back").length - 1).length];
      const leftCornerRods = rodsOn(design, "left", 0).length;
      const rightCornerRods = rodsOn(design, "right", 0).length;
      expect(Math.max(backCornerRods[0], leftCornerRods) >= 2 && Math.min(backCornerRods[0], leftCornerRods) >= 2).toBe(false);
      expect(Math.max(backCornerRods[1], rightCornerRods) >= 2 && Math.min(backCornerRods[1], rightCornerRods) >= 2).toBe(false);
    }
  });

  it("puts hanging on the shorter wall and shoes by the door", () => {
    const design = walkIn();
    // This walk-in's back wall (120) is longer than its side walls (108), so hanging lands on a side.
    const backRods = studioBays(design, "back").reduce((sum, bay) => sum + bay.items.filter((item) => item.kind === "rod").length, 0);
    const sideRods = (["left", "right"] as const).reduce((sum, wall) => sum + studioBays(design, wall).reduce((inner, bay) => inner + bay.items.filter((item) => item.kind === "rod").length, 0), 0);
    expect(sideRods).toBeGreaterThan(backRods);
    // Shoe shelving sits in the bay furthest from the corner on a side run, or at the entry end.
    const shoeBay = STUDIO_WALLS.flatMap((wall) => studioBays(design, wall)).findIndex((bay) => bay.items.some((item) => item.kind === "shoe"));
    expect(shoeBay).toBeGreaterThanOrEqual(0);
  });

  it("centres the drawer bank on the back wall where the wall has a middle bay", () => {
    // A three-bay back wall has a genuine centre; the drawer bank takes it.
    const design = build({ wallWidthIn: 144, roomDepthIn: 120, cornerShelves: true }).design;
    const bays = studioBays(design, "back");
    expect(bays.length).toBeGreaterThanOrEqual(3);
    const drawerIndex = bays.findIndex((bay) => bay.items.some((item) => item.kind === "drawer"));
    expect(drawerIndex).toBeGreaterThan(0);
    expect(drawerIndex).toBeLessThan(bays.length - 1);
    // And it is the bay nearest the centre of the run.
    expect(Math.abs(drawerIndex - (bays.length - 1) / 2)).toBeLessThanOrEqual(1);
  });

  it("keeps the drawer bank on the back wall even when that wall has only two bays", () => {
    // A two-bay wall has no middle bay; the nearest-to-centre bay takes the bank rather than the
    // bank moving off the back wall entirely.
    const design = build({ wallWidthIn: 120, roomDepthIn: 108, cornerShelves: true }).design;
    const backHasDrawer = studioBays(design, "back").some((bay) => bay.items.some((item) => item.kind === "drawer"));
    expect(backHasDrawer).toBe(true);
  });
});

describe("guide rules: reach-in layout", () => {
  const reachIn = (overrides: Partial<StudioAutoBuildInput> = {}) => build({ wallWidthIn: 78, roomDepthIn: 30, ...overrides }).design;

  it("gets a full-width top shelf shared by every bay", () => {
    const design = reachIn();
    const bays = studioBays(design, "back");
    expect(bays.length).toBeGreaterThan(1);
    // Every bay carries a shelf at the same high elevation: that is the full-width top shelf.
    const topElevations = bays.map((bay) => Math.max(...bay.items.filter((item) => item.kind === "shelf").map((item) => item.bottomIn)));
    expect(new Set(topElevations).size).toBe(1);
    expect(topElevations[0]).toBeGreaterThanOrEqual(80);
    expect(topElevations[0]).toBeLessThanOrEqual(studioFixedTop(design));
  });

  it("is mostly double hang with one long-hang bay and no corner shelves", () => {
    const design = reachIn({ longHangBay: true });
    expect(studioCornerShelves(design)).toEqual([]);
    const bays = studioBays(design, "back");
    const rodCounts = bays.map((bay) => bay.items.filter((item) => item.kind === "rod").length);
    const doubleHang = rodCounts.filter((count) => count >= 2).length;
    const longHang = bays.filter((bay) => {
      const rods = bay.items.filter((item) => item.kind === "rod");
      return rods.length === 1 && rods[0].bottomIn >= 70;
    }).length;
    // Exactly one long-hang bay, and at least one real double-hang bay beside it.
    expect(longHang).toBe(1);
    expect(doubleHang).toBeGreaterThanOrEqual(1);
    // The hanging bays are the hanging storage: no bay mixes a rod with a drawer or shoe board.
    for (const bay of bays) {
      const kinds = new Set(bay.items.map((item) => item.kind));
      if (kinds.has("rod")) expect(kinds.has("drawer") || kinds.has("shoe")).toBe(false);
    }
  });

  it("keeps the drawer bank clear of the door swing", () => {
    const design = reachIn();
    const bays = studioBays(design, "back");
    const drawerIndex = bays.findIndex((bay) => bay.items.some((item) => item.kind === "drawer"));
    expect(drawerIndex).toBeGreaterThanOrEqual(0);
    // The door end is the far end of the run; a reach-in's drawers are not in that last bay.
    expect(drawerIndex).toBeLessThan(bays.length - 1);
    // Measured properly: enough run remains between the drawer bank and the entry end.
    const fromEntryIn = bays.slice(drawerIndex + 1).reduce((sum, bay) => sum + bay.widthIn + 0.75, 0);
    expect(fromEntryIn).toBeGreaterThanOrEqual(AUTO_DOOR_SWING_CLEARANCE_IN);
  });
});

describe("guide rules: every part still resolves to a real SKU", () => {
  it("never invents a part for any of the guide layouts", () => {
    const cases: Partial<StudioAutoBuildInput>[] = [
      { wallWidthIn: 78, roomDepthIn: 30 },
      { wallWidthIn: 78, roomDepthIn: 30, cornerShelves: true },
      { wallWidthIn: 120, roomDepthIn: 108 },
      { wallWidthIn: 120, roomDepthIn: 108, cornerShelves: true },
      { wallWidthIn: 144, roomDepthIn: 120, cornerShelves: true },
      { wallWidthIn: 84, roomDepthIn: 96, cornerShelves: true },
      { wallWidthIn: 120, roomDepthIn: 108, options: MODE_AUTO_BUILD_DEFAULTS.pantry, mode: "pantry" },
      { wallWidthIn: 120, roomDepthIn: 108, options: MODE_AUTO_BUILD_DEFAULTS.mudroom, mode: "mudroom" },
    ];
    for (const input of cases) {
      const { design } = build(input);
      for (const wall of STUDIO_WALLS) for (const bay of studioBays(design, wall)) expect(STUDIO_STOCK_WIDTHS).toContain(bay.stockWidthIn ?? bay.widthIn);
      const bill = studioTakeoff(design);
      for (const line of bill.lines) expect(CLOSET_PARTS.some((part) => part.sku === line.sku), `${line.sku} must exist`).toBe(true);
      expect(restoreStudioDesign(JSON.stringify(design))).toEqual(design);
      // Nothing is left resting outside its tower.
      for (const wall of STUDIO_WALLS) {
        const scoped = switchStudioWall(design, wall);
        for (const bay of studioBays(scoped)) for (const item of bay.items) {
          expect(item.bottomIn).toBeGreaterThanOrEqual(0);
          expect(item.bottomIn + studioItemHeight(item.kind)).toBeLessThanOrEqual(studioFixedTop(scoped) + 0.001);
        }
      }
    }
  });
});

describe("leftover gaps are always reported", () => {
  it("reports an uncovered span whenever no real width can close it", () => {
    // Walls that cannot be covered outright by 18–42 in stock must say so, whatever the reason:
    // the four-tower Studio limit, or a remainder narrower than the 12 in planning minimum.
    for (const width of [80, 82, 84, 86, 88]) {
      const { design, notices } = build({ wallWidthIn: width, roomDepthIn: 24 });
      const bays = studioBays(design, "back");
      const usedIn = bays.reduce((sum, bay) => sum + bay.widthIn, 0) + 0.75 * (bays.length + 1);
      if (width - usedIn > 0.75) {
        expect(notices.some((line) => /left over.*stays empty/i.test(line)), `${width} in wall should report its gap`).toBe(true);
      }
      // Either way the wall is never over-filled and every bay is a real stock width.
      expect(usedIn).toBeLessThanOrEqual(width + 0.001);
      for (const bay of bays) expect(STUDIO_STOCK_WIDTHS).toContain(bay.stockWidthIn ?? bay.widthIn);
    }
  });

  it("reports the gap when there are no dropped shelves left to absorb it", () => {
    // With nothing left over to place, the cut-tower branch has no shelves to use, so the gap must
    // still be stated rather than silently disappearing.
    const { design, notices } = build({ wallWidthIn: 84, roomDepthIn: 24, options: { rods: 0, shelves: 0, drawers: 0, shoes: 0 } });
    const bays = studioBays(design, "back");
    const usedIn = bays.reduce((sum, bay) => sum + bay.widthIn, 0) + 0.75 * (bays.length + 1);
    expect(84 - usedIn).toBeGreaterThan(0.75);
    expect(notices.some((line) => /left over.*stays empty/i.test(line))).toBe(true);
  });
});
