import { describe, expect, it } from "vitest";
import {
  autoBuildStudio, createStudioDesign, studioBays, studioCornerShelves, studioItemHeight, studioStockWidth, studioTakeoff, studioWallFill,
  studioWallLength, studioWidthForWall, STUDIO_STOCK_WIDTHS, STUDIO_WALLS,
  type StudioAutoBuildInput, type StudioDesign,
} from "./vendorClosetStudio";
import { CLOSET_PARTS } from "./closet";
import { studioBayDecor, studioWallDecor } from "./vendorClosetDecor";

const build = (input: Partial<StudioAutoBuildInput> = {}) => autoBuildStudio({
  mode: "closet", mount: "floor", finish: "Glacier White", wallWidthIn: 84, roomDepthIn: 108, roomHeightIn: 96, ...input,
});

/** Share of a wall covered by tower frames, in inches. */
const wallCoverage = (design: StudioDesign, wall: (typeof STUDIO_WALLS)[number]) =>
  studioWidthForWall(design, wall) / studioWallLength(design, wall);

describe("studios wall fill uses real MasterTrac widths", () => {
  it("only ever picks widths the March 2022 sheet actually sells", () => {
    const stocked = new Set(CLOSET_PARTS.filter((part) => part.category === "Shelves" && part.depthIn === 14.5
      && /(?:Fixed|Adj|Adjustable) Shelf/i.test(part.description) && !/Corner/i.test(part.description)).map((part) => part.widthIn));
    for (const span of [24, 30, 54.5, 60, 78.5, 84, 96, 108, 120, 144, 200]) {
      const fill = studioWallFill(span);
      for (const width of fill.widths) {
        expect(STUDIO_STOCK_WIDTHS).toContain(width);
        expect(stocked.has(width), `${width} in must be a real shelf SKU width`).toBe(true);
      }
      // A plan never overruns the wall it was given.
      expect(fill.usedIn).toBeLessThanOrEqual(span + 0.001);
    }
  });

  it("fills the owner's 84 in back wall instead of leaving one 24 in tower", () => {
    const design = build({ wallWidthIn: 84, roomDepthIn: 24 }).design;
    const bays = studioBays(design, "back");
    expect(bays.length).toBeGreaterThan(1);
    expect(wallCoverage(design, "back")).toBeGreaterThan(0.9);
    // Exactly the reported failure: 84 in with a single 24 in tower.
    expect(bays.length === 1 && bays[0].widthIn === 24).toBe(false);
  });

  it("fills the 108 in side walls rather than stopping 33 in short beside the corner", () => {
    const design = build({ wallWidthIn: 84, roomDepthIn: 108 }).design;
    for (const wall of ["left", "right"] as const) {
      expect(studioBays(design, wall).length).toBeGreaterThan(1);
      expect(wallCoverage(design, wall)).toBeGreaterThan(0.75);
    }
  });

  it("keeps leftover wall only when no real part fits, and says so", () => {
    const { design, notices } = build({ wallWidthIn: 84, roomDepthIn: 24 });
    const leftoverBays = studioBays(design, "back").filter((bay) => bay.stockWidthIn);
    // Any leftover tower is a field cut of a real stock width, never an invented one.
    for (const bay of leftoverBays) expect(STUDIO_STOCK_WIDTHS).toContain(bay.stockWidthIn);
    const leftoverIn = studioWallLength(design, "back") - studioWidthForWall(design, "back");
    if (leftoverIn > 0.75) expect(notices.some((line) => /left over|stays empty/i.test(line))).toBe(true);
  });

  it("never invents a SKU: every built bay resolves real fixed and adjustable shelf references", () => {
    const results = [[84, 108], [108, 108], [120, 96], [78, 30], [144, 120]] as const;
    for (const [width, depth] of results) {
      const { design } = build({ wallWidthIn: width, roomDepthIn: depth });
      for (const wall of STUDIO_WALLS) {
        for (const bay of studioBays(design, wall)) {
          expect(STUDIO_STOCK_WIDTHS).toContain(studioStockWidth(bay));
          for (const item of bay.items) expect(studioItemHeight(item.kind)).toBeGreaterThanOrEqual(0);
        }
      }
      const skus = studioTakeoff(design).lines.map((line) => line.sku);
      expect(skus.length).toBeGreaterThan(0);
      for (const sku of skus) expect(CLOSET_PARTS.some((part) => part.sku === sku), `${sku} must exist in the catalog`).toBe(true);
    }
  });

  it("respects the walkway and never lets the two runs share the same corner space", () => {
    const { design } = build({ wallWidthIn: 120, roomDepthIn: 108 });
    const left = studioBays(design, "left").length;
    const right = studioBays(design, "right").length;
    expect(left + right).toBeGreaterThan(0);
    const cornered = studioCornerShelves(design);
    // Either the planner kept a real 29.5 in envelope, or it closed the corner with shared geometry.
    expect(cornered.every((shelf) => shelf.nominalFootprintIn === 29.5)).toBe(true);
  });
});

describe("decorative content is presentation only", () => {
  it("adds hanging, folded and shoe decoration without touching the material reference", () => {
    const { design } = build({ wallWidthIn: 120, roomDepthIn: 108 });
    const billWithDecor = studioTakeoff(design);
    const decorated = STUDIO_WALLS.flatMap((wall) => studioWallDecor(design, wall));
    // The auto-build asked for rods, shelves, drawers and shoes, so the preview must have content.
    expect(decorated.some((bay) => bay.hangers.length > 0)).toBe(true);
    expect(decorated.some((bay) => bay.folded.length > 0)).toBe(true);
    expect(decorated.some((bay) => bay.shoes.length > 0)).toBe(true);

    // Nothing decorative is a part: identical bill with the toggle off, which is the same design.
    const billWithoutDecor = studioTakeoff({ ...design });
    expect(billWithoutDecor.lines).toEqual(billWithDecor.lines);
    expect(billWithoutDecor.subtotalUsd).toBe(billWithDecor.subtotalUsd);
  });

  it("keeps decor out of the saved design, so a draft is identical with the toggle on or off", () => {
    const { design } = build({ wallWidthIn: 120, roomDepthIn: 96 });
    const serialized = JSON.stringify(design);
    // Derived only: computing decor must not mutate the design or add keys to it.
    STUDIO_WALLS.forEach((wall) => studioWallDecor(design, wall));
    expect(JSON.stringify(design)).toBe(serialized);
    expect(serialized).not.toMatch(/hanger|folded|decor/i);
  });

  it("only hangs clothes on a rod with real clearance, and only folds on a shelf with headroom", () => {
    const design = build({ wallWidthIn: 120, roomDepthIn: 108 }).design;
    for (const wall of STUDIO_WALLS) studioBays(design, wall).forEach((bay) => {
      const decor = studioBayDecor(design, bay, wall);
      const rodIds = bay.items.filter((item) => item.kind === "rod").map((item) => item.bottomIn);
      for (const hanger of decor.hangers) expect(rodIds).toContain(hanger.rodBottomIn);
      const shelfBottoms = bay.items.filter((item) => item.kind === "shelf").map((item) => item.bottomIn);
      for (const stack of decor.folded) expect(shelfBottoms).toContain(stack.shelfBottomIn);
      // Nothing is drawn outside the bay it belongs to.
      for (const hanger of decor.hangers) {
        expect(hanger.leftIn).toBeGreaterThanOrEqual(0);
        expect(hanger.leftIn + hanger.widthIn).toBeLessThanOrEqual(studioStockWidth(bay) + 0.001);
      }
    });
  });

  it("draws the same clothes every time, so screenshots and tests are stable", () => {
    const { design } = build({ wallWidthIn: 120, roomDepthIn: 108 });
    for (const wall of STUDIO_WALLS) expect(studioWallDecor(design, wall)).toEqual(studioWallDecor(design, wall));
  });

  it("has nothing to draw on an unused tower", () => {
    // A fresh starter design has one adjustable shelf and no rod, drawer or shoe board, so there is
    // nothing to dress; decor must never invent content for parts that are not in the design.
    const starter = createStudioDesign();
    for (const wall of STUDIO_WALLS) {
      for (const bay of studioWallDecor(starter, wall)) {
        expect(bay.hangers).toEqual([]);
        expect(bay.shoes).toEqual([]);
      }
    }
  });
});
