import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  countertopDepthForRunItem,
  countertopSurfaces,
  effectiveStyleId,
  adjacentCabinetForFiller,
  fillerRenderStyleId,
  isFillerItem,
  normalizeInstalledFillersToAdjacentCabinets,
  type PlacedCabinet,
} from "./design";

function item(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "item",
    cabinetId: 1,
    masterCode: "B24",
    description: "Base",
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    depth: 24,
    height: 34.5,
    rotation: 0,
    ...overrides,
  } as PlacedCabinet;
}

describe("filler finish follows the cabinet it butts", () => {
  it("repaints a stale white filler when the tall pantry changes to navy", () => {
    const pantry = item({
      uid: "pantry",
      masterCode: "TP2484",
      description: "84 inch Tall Pantry",
      placement: "tall",
      width: 24,
      depth: 24,
      height: 84,
      styleId: 42,
    });
    const filler = item({
      uid: "pantry-filler",
      masterCode: "TF3",
      description: "Tall filler",
      category: "Filler",
      subCategory: "Filler",
      placement: "tall",
      x: 24,
      width: 3,
      depth: 24,
      height: 84,
      styleId: 7,
    });
    const matched = normalizeInstalledFillersToAdjacentCabinets([pantry, filler], DEFAULT_ROOM)[1]!;
    expect(matched.styleId).toBe(42);
    expect(matched.styleId).not.toBe(7);
  });

  it("drops a filler's own style when the vanity inherits the design color", () => {
    const vanity = item({
      uid: "vanity",
      masterCode: "VSD30",
      description: "30 inch Vanity Drawer Base",
      category: "Vanity",
      x: 3,
      width: 30,
      depth: 21,
      styleId: null,
    });
    const filler = item({
      uid: "end-filler",
      masterCode: "BF3",
      description: "Base filler",
      category: "Filler",
      subCategory: "Filler",
      x: 0,
      width: 3,
      depth: 21,
      styleId: 7,
      fillerPieceGroupId: "end-fill",
      fillerTotalWidth: 3,
      fillerPlacementMode: "left",
      fillerForCabinetUid: "vanity",
    });
    const matched = normalizeInstalledFillersToAdjacentCabinets([vanity, filler], DEFAULT_ROOM)[1]!;
    expect(matched.styleId).toBeNull();
    expect(effectiveStyleId(matched, 42)).toBe(42);
    expect(fillerRenderStyleId(filler, [vanity, filler], DEFAULT_ROOM, 42)).toBe(42);
  });

  it("follows a navy vanity when the end filler overlaps the cabinet and has no saved owner", () => {
    const vanity = item({ uid: "vanity", masterCode: "VSD48", description: "Drawer vanity", width: 48, depth: 21, x: 3, styleId: null });
    const filler = item({
      uid: "end",
      masterCode: "BF3",
      description: "3 inch stock",
      category: "Accessory",
      x: 2.4,
      width: 3,
      depth: 21,
      styleId: 7,
    });
    expect(isFillerItem(filler)).toBe(true);
    expect(adjacentCabinetForFiller(filler, [vanity, filler], DEFAULT_ROOM)?.uid).toBe("vanity");
    expect(fillerRenderStyleId(filler, [vanity, filler], DEFAULT_ROOM, 42)).toBe(42);
    expect(normalizeInstalledFillersToAdjacentCabinets([vanity, filler], DEFAULT_ROOM)[1]?.styleId).toBeNull();
  });

  it("follows a tall pantry when the side filler is scribe stock a short gap away", () => {
    const pantry = item({
      uid: "pantry",
      masterCode: "TP2484",
      description: "Tall pantry",
      placement: "tall",
      width: 24,
      height: 84,
      styleId: 42,
    });
    const filler = item({
      uid: "scribe",
      masterCode: "SCR",
      description: "Scribe molding",
      category: "Accessory",
      placement: "tall",
      x: 24.75,
      width: 0.75,
      height: 84,
      styleId: 7,
    });
    expect(isFillerItem(filler)).toBe(true);
    expect(isFillerItem({ masterCode: "WEP1596", description: "Wall end panel" })).toBe(false);
    expect(fillerRenderStyleId(filler, [pantry, filler], DEFAULT_ROOM, 9)).toBe(42);
  });
});

describe("countertop over an end filler stays on the run", () => {
  it("uses the vanity's 22.5 inch top and stops at the filler's outer side", () => {
    const vanity = item({
      uid: "vanity",
      masterCode: "VSD30",
      description: "30 inch Vanity Drawer Base",
      category: "Vanity",
      x: 3,
      width: 30,
      depth: 21,
    });
    const filler = item({
      uid: "end-filler",
      masterCode: "BF3",
      description: "Base filler",
      category: "Filler",
      subCategory: "Filler",
      x: 0,
      width: 3,
      depth: 21,
      fillerPieceGroupId: "end-fill",
      fillerTotalWidth: 3,
      fillerPlacementMode: "left",
      fillerForCabinetUid: "vanity",
    });
    expect(countertopDepthForRunItem(filler, [vanity, filler], DEFAULT_ROOM)).toBe(22.5);
    expect(countertopDepthForRunItem(vanity, [vanity, filler], DEFAULT_ROOM)).toBe(22.5);
    const [surface] = countertopSurfaces([vanity, filler], DEFAULT_ROOM);
    expect(surface).toMatchObject({ x: 0, y: 0, width: 33, depth: 22.5 });
    expect(surface!.x + surface!.width).toBe(33);
    expect(surface!.depth).toBeLessThan(25.5);
  });

  it("keeps a kitchen filler on the standard 25.5 inch base top", () => {
    const base = item({ uid: "base", x: 3, width: 24, depth: 24 });
    const filler = item({
      uid: "kitchen-filler",
      masterCode: "BF3",
      description: "Base filler",
      category: "Filler",
      x: 0,
      width: 3,
      depth: 24,
      fillerPieceGroupId: "kitchen-fill",
      fillerTotalWidth: 3,
      fillerPlacementMode: "left",
      fillerForCabinetUid: "base",
    });
    expect(countertopDepthForRunItem(filler, [base, filler], DEFAULT_ROOM)).toBe(25.5);
    const [surface] = countertopSurfaces([base, filler], DEFAULT_ROOM);
    expect(surface).toMatchObject({ x: 0, width: 27, depth: 25.5 });
  });
});
