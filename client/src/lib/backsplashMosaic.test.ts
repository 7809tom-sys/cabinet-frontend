import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet, type WallOpening } from "./design";
import {
  MOSAIC_GROUT_MAX_IN, MOSAIC_GROUT_MIN_IN, MOSAIC_INTERLOCK_SPECS, baseboardSpans, clampMosaicGroutIn,
  mosaicAlongForTile, mosaicInterlockSpecForKey, mosaicInterlockSpecForName, mosaicInterlockUnitPlan, mosaicPhaseAnchorEdge,
  mosaicFinishedEdges, mosaicPitchIn, mosaicPlanGroutIn, mosaicUvForPoint,
  MOSAIC_SHEET_SPECS, genericMosaicSheetSpec, mosaicSheetSpecFor,
} from "./backsplashMosaic";
import { parseBacksplashSheetInches } from "./backsplashProductMaterial";

const room = DEFAULT_ROOM;

describe("interlocking mosaics repeat at their interlock spacing", () => {
  it("covers every curated interlocking sheet, keyed the same way the 3D sources are", () => {
    for (const key of ["desert-clay-11.81in-interlocking-mosaic", "arctic-vail-10.71in-interlocking-hex-mosaic", "carbon-hex-12.80in-marble-hex-mosaic", "concord-square-11.81in-glass-marble-mosaic", "golden-trace-11.81in-marble-aluminum-mosaic"]) {
      expect(mosaicInterlockSpecForKey(key), key).not.toBeNull();
    }
    expect(mosaicInterlockSpecForName("Golden Trace Mosaic 11.81")?.key).toBe("golden-trace-11.81in-marble-aluminum-mosaic");
  });
  it("an interlocking sheet's repeat spacing is smaller than the photo's outer size (fingers overlap); a straight-edge sheet repeats at its size", () => {
    for (const item of MOSAIC_INTERLOCK_SPECS) {
      const pitch = mosaicPitchIn(item);
      if (item.edge === "straight") { expect(pitch).toEqual({ x: item.outerWidthIn, y: item.outerHeightIn }); continue; }
      expect(pitch.x).toBeLessThan(item.outerWidthIn);
      expect(pitch.y).toBeLessThan(item.outerHeightIn);
      // Hex fingers are a few percent. A linear strip sheet (Misty Coast) nests about a fifth of its width and still stays under a quarter.
      expect(pitch.x).toBeGreaterThan(item.outerWidthIn * 0.75);
    }
  });
  it("UVs advance exactly one texture repeat per interlock pitch, not per outer size", () => {
    const item = mosaicInterlockSpecForKey("desert-clay-11.81in-interlocking-mosaic")!;
    const pitch = mosaicPitchIn(item);
    const a = mosaicUvForPoint(20, 40, pitch.x, pitch.y, 144, "start");
    const b = mosaicUvForPoint(20 + pitch.x, 40, pitch.x, pitch.y, 144, "start");
    const c = mosaicUvForPoint(20, 40 + pitch.y, pitch.x, pitch.y, 144, "start");
    expect(b.u - a.u).toBeCloseTo(1, 9);
    expect(c.v - a.v).toBeCloseTo(1, 9);
    // the old behaviour (outer size) would have advanced less than a whole repeat per pitch
    expect(pitch.x / item.outerWidthIn).toBeLessThan(1);
  });
  it("the unit crop is one pitch wide and tall, centered inside the photo", () => {
    const item = mosaicInterlockSpecForKey("carbon-hex-12.80in-marble-hex-mosaic")!;
    // Content box of the 1621×1351 designer sheet, not a hard-coded 1280×1110 stand-in.
    const plan = mosaicInterlockUnitPlan(item, 1618, 1323, 4096);
    const pitch = mosaicPitchIn(item);
    expect(item.measured).toBe(true);
    expect(plan.source.width / (1618 / item.outerWidthIn)).toBeCloseTo(pitch.x, 5);
    expect(plan.source.height / (1323 / item.outerHeightIn)).toBeCloseTo(pitch.y, 5);
    expect(Math.round(plan.source.width)).toBe(1461);
    expect(Math.round(plan.source.height)).toBe(1276);
    expect(plan.source.x * 2 + plan.source.width).toBeCloseTo(1618, 0);
    expect(plan.source.y * 2 + plan.source.height).toBeCloseTo(1323, 0);
  });
});

describe("grout is an even 1/16 to 1/8 inch at every joint", () => {
  it("clamps any requested width into the range", () => {
    expect(clampMosaicGroutIn(0.01)).toBe(MOSAIC_GROUT_MIN_IN);
    expect(clampMosaicGroutIn(0.5)).toBe(MOSAIC_GROUT_MAX_IN);
    expect(clampMosaicGroutIn(undefined)).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN);
  });
  it("the painted grout line measures 1/16 to 1/8 inch in real inches for every sheet, both directions", () => {
    for (const item of MOSAIC_INTERLOCK_SPECS) {
      const plan = mosaicInterlockUnitPlan(item, 2048, 2048, 2048);
      const grout = mosaicPlanGroutIn(plan);
      // one pixel of rounding either way
      const slackX = (1 / plan.width) * plan.pitchXIn;
      const slackY = (1 / plan.height) * plan.pitchYIn;
      expect(grout.x).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN - slackX);
      expect(grout.x).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN + slackX);
      expect(grout.y).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN - slackY);
      expect(grout.y).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN + slackY);
      expect(Math.abs(grout.x - grout.y)).toBeLessThan(0.02); // same line width both ways
    }
  });
});

describe("the pattern lines up at an inside corner", () => {
  it("a run whose only corner is at its end is measured from that corner", () => {
    expect(mosaicPhaseAnchorEdge(false, true)).toBe("end");
    expect(mosaicPhaseAnchorEdge(true, false)).toBe("start");
    expect(mosaicPhaseAnchorEdge(true, true)).toBe("start");
    expect(mosaicPhaseAnchorEdge(false, false)).toBe("start");
  });
  it("tile distance from the corner is identical on both walls", () => {
    const pitch = 11.5;
    const topLength = 144;
    // top wall's corner is at x = 144; right wall's corner is at y = 0
    for (const away of [0, 3, 11.5, 20, 60]) {
      const onTop = mosaicAlongForTile(topLength - away, topLength, "end");
      const onRight = mosaicAlongForTile(away, 120, "start");
      expect(onTop / pitch).toBeCloseTo(onRight / pitch, 9);
    }
  });
});

describe("baseboards only along exposed walls", () => {
  const cab = (along: number, width: number, code = "B24"): PlacedCabinet => {
    const spot = wallPlacementAt(along, width, 24, "top", room)!;
    return {
      uid: `${code}-${along}`, cabinetId: 1, masterCode: code, description: code, category: "Base", placement: "base",
      x: spot.x, y: spot.y, width, depth: 24, height: 34.5, rotation: spot.rotation, wallId: spot.wallId, wallOffset: spot.wallOffset,
      numberOfDoors: 2, numberOfDrawers: 0,
    } as PlacedCabinet;
  };
  const length = room.width;
  it("a bare wall gets baseboard along its whole length", () => {
    expect(baseboardSpans([], [], room, "top")).toEqual([{ start: 0, end: length }]);
  });
  it("none is run behind base cabinets standing on the floor against the wall", () => {
    const spans = baseboardSpans([cab(0, 60)], [], room, "top");
    expect(spans).toEqual([{ start: 60, end: length }]);
  });
  it("a wall cabinet leaves the wall exposed, and a door opening interrupts the run", () => {
    const wall = { ...cab(10, 30, "W3030"), placement: "wall", category: "Wall", y: cab(10, 30).y, elevation: 54 } as unknown as PlacedCabinet;
    const door: WallOpening = { uid: "d", kind: "door", label: "Door", side: "top", offset: 80, width: 36, height: 80, sill: 0 };
    const spans = baseboardSpans([wall], [door], room, "top");
    expect(spans.some((s) => s.start <= 10 && s.end >= 40)).toBe(true);
    expect(spans.every((s) => s.end <= 80 + 0.01 || s.start >= 116 - 0.01)).toBe(true);
  });
  it("a wall with no cabinets on it is unaffected by cabinets on another wall", () => {
    expect(baseboardSpans([cab(0, 60)], [], room, "bottom")).toEqual([{ start: 0, end: length }]);
  });
});

describe("clean finished edges on cut tile", () => {
  const wall = (over: Partial<{ start: number; end: number; bottom: number; top: number }>) => ({ side: "top", start: 0, end: 100, bottom: 36, top: 54, ...over });
  it("a free top edge below the ceiling gets a strip; the counter edge and the wall ends do not", () => {
    expect(mosaicFinishedEdges(wall({}), [wall({})], 144, 96)).toEqual(["top", "end"]);
    expect(mosaicFinishedEdges(wall({ start: 0, end: 144 }), [], 144, 96)).toEqual(["top"]);
  });
  it("edges shared with a neighbouring piece (behind a hood, around a window) are not stripped", () => {
    const left = wall({ start: 0, end: 50 });
    const hood = wall({ start: 50, end: 80, top: 80 });
    expect(mosaicFinishedEdges(left, [left, hood], 144, 96)).toEqual(["top"]);
    const below = wall({ start: 30, end: 60, top: 42 });
    const above = wall({ start: 30, end: 60, bottom: 60, top: 80 });
    expect(mosaicFinishedEdges(below, [below, above], 144, 96)).toContain("top");
    expect(mosaicFinishedEdges(above, [below, above], 144, 96)).toContain("bottom");
  });
});

// HARD RULE tests (see the comment block at the top of lib/backsplashMosaic.ts): one group per interlocking product.
const viewerSource = readFileSync(new URL("../components/design/InteractiveRoom3D.tsx", import.meta.url), "utf8");
const elevationSource = readFileSync(new URL("../components/design/ElevationView.tsx", import.meta.url), "utf8");
const libSource = readFileSync(new URL("./backsplashMosaic.ts", import.meta.url), "utf8");
const PRODUCTS = ["Desert Clay", "Arctic Vail", "Carbon Hex", "Carrara Subway", "Cloudline Marble", "Concord Square", "Glacier Shift", "Golden Trace", "Icestone Flux", "Misty Coast", "Thassos Subway"] as const;
const backsplashBlock = viewerSource.slice(viewerSource.indexOf("function addThreeDBacksplash("), viewerSource.indexOf("function addThreeDCountertopUpstands"));

describe("hard rule: every mosaic shows no sheet edges", () => {
  it("states the all-mosaics rule and names every curated sheet in the comment at the top of the lib", () => {
    const header = libSource.slice(0, libSource.indexOf("export const MOSAIC_GROUT_MIN_IN"));
    expect(header).toContain("HARD RULE");
    expect(header).toContain("EVERY MOSAIC PRODUCT");
    for (const name of PRODUCTS) expect(header, name).toContain(name);
    expect(MOSAIC_SHEET_SPECS.map((item) => item.name).sort()).toEqual(PRODUCTS.map((name) => name.toLowerCase()).sort());
  });

  for (const name of PRODUCTS) {
    describe(name, () => {
      const item = mosaicInterlockSpecForName(name)!;

      it("has no brightness or tint change from one sheet to the next (one plane, one material, no per-sheet color)", () => {
        expect(item).not.toBeNull();
        // The renderer builds every interlocking sheet in one plane with one white-tinted material.
        expect(backsplashBlock).not.toMatch(/vertexColors|setAttribute\("color"|mosaicSheetShade|SheetGeometry|lot shade|Float32BufferAttribute\(colors/);
        expect(backsplashBlock).toContain('color: "#ffffff"');
        expect(libSource).not.toMatch(/export function mosaicSheetShade|mosaicSheetTint/);
        // The elevation draws no sheet outline for these products and applies no per-sheet gradient or opacity step.
        expect(elevationSource).toContain('interlock && showProductImage ? "none"');
        expect(elevationSource).not.toMatch(/nth-child|mosaicSheetShade/);
      });

      it("paints grout at the sheet edge exactly as wide and as colored as the grout inside the sheet, within 1/16 to 1/8 inch", () => {
        expect(item.internalGroutIn).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN);
        expect(item.internalGroutIn).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN);
        expect(item.groutIn).toBe(item.internalGroutIn);
        const plan = mosaicInterlockUnitPlan(item, 2048, 2048, 2048);
        const grout = mosaicPlanGroutIn(plan);
        const slackX = plan.pitchXIn / plan.width;
        const slackY = plan.pitchYIn / plan.height;
        expect(Math.abs(grout.x - item.internalGroutIn)).toBeLessThanOrEqual(slackX);
        expect(Math.abs(grout.y - item.internalGroutIn)).toBeLessThanOrEqual(slackY);
        expect(grout.x).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN - slackX);
        expect(grout.x).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN + slackX);
        expect(grout.y).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN - slackY);
        expect(grout.y).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN + slackY);
        // one color for every joint: the sheet-edge line uses the product's grout color, never a darker outline
        expect(item.groutColor).toMatch(/^#[0-9a-f]{6}$/i);
        expect(viewerSource).toContain('context.fillStyle = item.groutColor ?? "#8a8782";');
      });

      it("repeats at the interlock spacing, flush sheet to sheet, in 3D and in the elevation", () => {
        const pitch = mosaicPitchIn(item);
        if (item.edge === "interlocking") {
          expect(pitch.x).toBeLessThan(item.outerWidthIn);
          expect(pitch.y).toBeLessThan(item.outerHeightIn);
        } else {
          // straight-edge sheet: overlap 0, the pitch is the sheet size
          expect(item.overhangXIn).toBe(0);
          expect(item.overhangYIn).toBe(0);
          expect(pitch).toEqual({ x: item.outerWidthIn, y: item.outerHeightIn });
        }
        const a = mosaicUvForPoint(30, 40, pitch.x, pitch.y, 144, "start");
        const b = mosaicUvForPoint(30 + pitch.x, 40 + pitch.y, pitch.x, pitch.y, 144, "start");
        expect(b.u - a.u).toBeCloseTo(1, 9);
        expect(b.v - a.v).toBeCloseTo(1, 9);
        // the unit crop is exactly one pitch, so adjacent units touch with no gap and no overlap
        const plan = mosaicInterlockUnitPlan(item, 2000, 2000, 4096);
        expect(plan.pitchXIn).toBe(pitch.x);
        expect(plan.pitchYIn).toBe(pitch.y);
        expect(viewerSource).toContain("interlockSpec ? mosaicPitchIn(interlockSpec).x");
        expect(viewerSource).toContain("interlockSpec ? mosaicPitchIn(interlockSpec).y");
        expect(viewerSource).toContain("backsplashMeasuredModuleIn");
        expect(elevationSource).toContain("interlockPitch.x * ppi");
      });
    });
  }
});

describe("hard rule: no catalog mosaic is left without a spec", () => {
  // Every curated mosaic source in InteractiveRoom3D.tsx (any entry whose pattern kind is a mosaic) must have a row.
  const curatedMosaicKeys = [...viewerSource.matchAll(/key: "([^"]+)",[\s\S]{0,700}?backsplashPatternKind: "(?:interlocking|subway)-mosaic"/g)].map((m) => m[1]);

  it("finds the curated mosaics in the 3D source (guards against this test matching nothing)", () => {
    expect(curatedMosaicKeys.length).toBeGreaterThanOrEqual(PRODUCTS.length);
  });

  it("every curated mosaic source key has a spec with a repeat spacing, overlap, grout width and grout color", () => {
    for (const key of curatedMosaicKeys) {
      const item = mosaicInterlockSpecForKey(key);
      expect(item, `no mosaic spec for ${key}`).not.toBeNull();
      expect(item!.overhangXIn).toBeGreaterThanOrEqual(0);
      expect(item!.groutIn).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN);
      expect(item!.groutIn).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN);
      expect(item!.groutColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(typeof item!.measured).toBe("boolean");
    }
  });

  it("every spec belongs to a curated source (no orphan rows)", () => {
    for (const item of MOSAIC_SHEET_SPECS) expect(curatedMosaicKeys, item.key).toContain(item.key);
  });

  it("any other catalog mosaic (Moonstone Hex, penny, picket, linear...) gets a generic seamless spec; only field tile gets none", () => {
    for (const name of ["Moonstone Hex Mosaic", "Penny Round Mosaic", "Picket Mosaic", "Linear Stack Mosaic", "Herringbone Mosaic"]) {
      const sheet = parseBacksplashSheetInches({ name, size: "11.81 x 11.81", category: "Tile & Mosaic", subCategory: "Mosaic" });
      const item = mosaicSheetSpecFor({ name, widthIn: sheet.widthIn, heightIn: sheet.heightIn, patternKind: sheet.patternKind });
      expect(item, name).not.toBeNull();
      expect(item!.generic).toBe(true);
      expect(item!.measured).toBe(false);
      expect(mosaicPitchIn(item!)).toEqual({ x: 11.81, y: 11.81 });
      expect(item!.groutIn).toBeGreaterThanOrEqual(MOSAIC_GROUT_MIN_IN);
      expect(item!.groutIn).toBeLessThanOrEqual(MOSAIC_GROUT_MAX_IN);
    }
    const field = parseBacksplashSheetInches({ name: "White Gloss Field Tile", size: "3 x 6", category: "Wall Tile", subCategory: "Wall Tile" });
    expect(mosaicSheetSpecFor({ name: "White Gloss Field Tile", widthIn: field.widthIn, heightIn: field.heightIn, patternKind: field.patternKind })).toBeNull();
    expect(genericMosaicSheetSpec("X", 10, 12).edge).toBe("straight");
  });

  it("the 3D loader and the elevation both resolve through the one lookup, with no plain fallback for a mosaic", () => {
    expect(viewerSource).toContain("mosaicSheetSpecFor({ key: source.key");
    expect(elevationSource).toContain("mosaicSheetSpecFor({ name: productName");
  });
});

describe("hard rule: the photo border is cut and the repeat is measured from the photo, for every mosaic", () => {
  const unitLib = readFileSync(new URL("./mosaicUnitImage.ts", import.meta.url), "utf8");
  it("a measured flush core overrides the estimated overhang in the unit crop, and the output period stays the spec pitch", () => {
    const item = mosaicInterlockSpecForName("Desert Clay")!;
    const estimated = mosaicInterlockUnitPlan(item, 2000, 2000, 4096);
    const measured = mosaicInterlockUnitPlan(item, 2000, 2000, 4096, { x: 40, y: 60, width: 1900, height: 1880 });
    expect(measured.source).toEqual({ x: 40, y: 60, width: 1900, height: 1880 });
    expect(estimated.source.x).toBeCloseTo((item.overhangXIn / 2) * (2000 / item.outerWidthIn), 6);
    expect(measured.pitchXIn).toBe(estimated.pitchXIn);
    expect(measured.pitchYIn).toBe(estimated.pitchYIn);
    // a null or empty measurement falls back to the estimate
    expect(mosaicInterlockUnitPlan(item, 2000, 2000, 4096, null).source).toEqual(estimated.source);
    expect(mosaicInterlockUnitPlan(item, 2000, 2000, 4096, { x: 0, y: 0, width: 0, height: 10 }).source).toEqual(estimated.source);
  });

  it("the 3D loader and the elevation both build the unit through the one photo-analysis builder", () => {
    expect(viewerSource).toContain("buildMosaicUnitImage(loadedTexture.image");
    expect(elevationSource).toContain("buildMosaicUnitImage(probe, mosaicUnitSpec");
    expect(unitLib).toContain("analyzeMosaicPhoto(");
    expect(unitLib).toContain("measuredMosaicOverhangIn(");
    // the builder still paints exactly one grout line per joint and adds no tint
    expect(unitLib).toContain('item.groutColor ?? "#8a8782"');
    expect(unitLib).not.toMatch(/globalAlpha|globalCompositeOperation|filter\s*=/);
  });

  it("falls back to the estimate when the photo cannot be analysed (the old crop path stays for that case only)", () => {
    expect(viewerSource).toContain("interlockedMosaicUnitImage(");
    expect(unitLib).toContain("return null");
  });
});
