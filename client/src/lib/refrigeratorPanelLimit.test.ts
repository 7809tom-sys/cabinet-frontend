import { describe, expect, it } from "vitest";
import {
  applyDesignerLayoutRules,
} from "./designerLayoutRules";
import {
  cabinetWallMovePreview,
  clampPlacedToRefrigeratorPanels,
  countertopSurfaces,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { clampSpanToPanelOuterFaces, clipCountertopSpan, panelOuterStops } from "./refrigeratorPanelLimit";

const room: RoomData = { width: 200, depth: 120, ceilingHeight: 96 };
const EPS = 1e-6;

function along(item: PlacedCabinet) {
  const start = wallRunOffset(item, "top", room);
  return { start, end: start + wallRunSpan(item, "top", room) };
}

function seat(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "width">, start: number): PlacedCabinet {
  const depth = partial.depth ?? 24;
  const spot = wallPlacementAt(start, partial.width, depth, "top", room);
  return {
    cabinetId: 1,
    masterCode: "B18",
    description: "Base cabinet",
    category: "Base",
    subCategory: "Base",
    placement: "base",
    height: 34.5,
    rotation: spot.rotation,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    mountBottom: 0,
    ...partial,
    ...spot,
    width: partial.width,
    depth,
  } as PlacedCabinet;
}

/** Left outer face at 30. Right outer face at 68.25. Panels are 3/4 inch. */
function panels(): PlacedCabinet[] {
  const left = seat({
    uid: "left-panel",
    masterCode: "REPV2496",
    description: "Refrigerator end panel",
    category: "Panel",
    subCategory: "Refrigerator End Panel",
    placement: "tall",
    width: 0.75,
    depth: 24,
    height: 96,
    customProfile: "refrigerator-end-panel",
    refrigeratorAssemblyId: "fridge",
    refrigeratorAssemblyRole: "left-panel",
    numberOfDoors: 0,
  }, 30);
  const right = seat({
    uid: "right-panel",
    masterCode: "REPV2496",
    description: "Refrigerator end panel",
    category: "Panel",
    subCategory: "Refrigerator End Panel",
    placement: "tall",
    width: 0.75,
    depth: 24,
    height: 96,
    customProfile: "refrigerator-end-panel",
    refrigeratorAssemblyId: "fridge",
    refrigeratorAssemblyRole: "right-panel",
    numberOfDoors: 0,
  }, 67.5);
  return [left, right];
}

describe("nothing extends past a refrigerator end panel", () => {
  const [left, right] = panels();
  const leftFace = along(left).start;
  const rightFace = along(right).end;

  it.each([
    ["filler", "left", { masterCode: "F342", description: "Base filler", category: "Filler", subCategory: "Filler", placement: "base" as const, numberOfDoors: 0 }],
    ["trim", "left", { masterCode: "CRN8", description: "Crown molding", category: "Trim", subCategory: "Crown", placement: "wall" as const, height: 4, numberOfDoors: 0 }],
    ["cabinet", "left", { masterCode: "B18", description: "Base cabinet", placement: "base" as const }],
    ["filler", "right", { masterCode: "F342", description: "Base filler", category: "Filler", subCategory: "Filler", placement: "base" as const, numberOfDoors: 0 }],
    ["trim", "right", { masterCode: "SCR96", description: "Scribe molding", category: "Trim", subCategory: "Scribe", placement: "base" as const, numberOfDoors: 0 }],
    ["cabinet", "right", { masterCode: "B18", description: "Base cabinet", placement: "base" as const }],
  ] as const)("stops a %s on the %s of the fridge at the panel's outer face", (_kind, side, extra) => {
    const overhang = 0.25;
    const width = side === "left" ? 3 + overhang : 3 + overhang;
    const start = side === "left" ? leftFace - 3 : rightFace - overhang;
    const piece = seat({ uid: `${side}-piece`, width, ...extra }, start);
    expect(side === "left" ? along(piece).end : along(piece).start).not.toBeCloseTo(side === "left" ? leftFace : rightFace, 4);
    const out = clampPlacedToRefrigeratorPanels([left, right, piece], room);
    const kept = out.placed.find((item) => item.uid === piece.uid);
    expect(kept, out.notes.join("; ")).toBeTruthy();
    const span = along(kept!);
    if (side === "left") {
      expect(span.end).toBeCloseTo(leftFace, 6);
      expect(span.end).toBeLessThanOrEqual(leftFace + EPS);
    } else {
      expect(span.start).toBeCloseTo(rightFace, 6);
      expect(span.start).toBeGreaterThanOrEqual(rightFace - EPS);
    }
    expect(out.placed.find((item) => item.uid === "left-panel")).toMatchObject({ width: 0.75 });
    expect(out.placed.find((item) => item.uid === "right-panel")).toMatchObject({ width: 0.75 });
  });

  it("removes a filler that would only remain as a sliver past the panel", () => {
    const sliver = seat({
      uid: "sliver",
      masterCode: "F342",
      description: "Base filler",
      category: "Filler",
      subCategory: "Filler",
      placement: "base",
      width: 0.1,
      numberOfDoors: 0,
    }, leftFace - 0.04);
    const out = clampPlacedToRefrigeratorPanels([left, right, sliver], room);
    expect(out.placed.some((item) => item.uid === "sliver")).toBe(false);
    expect(out.droppedUids).toContain("sliver");
    expect(out.notes.join(" ")).toMatch(/removed/);
  });

  it("cuts a one-hundredth-inch overhang back to the outer face", () => {
    const piece = seat({
      uid: "fraction",
      masterCode: "F342",
      description: "Base filler",
      category: "Filler",
      placement: "base",
      width: 3.01,
      numberOfDoors: 0,
    }, leftFace - 3);
    const out = clampPlacedToRefrigeratorPanels([left, right, piece], room);
    expect(along(out.placed.find((item) => item.uid === "fraction")!).end).toBeCloseTo(leftFace, 6);
  });

  it("leaves a piece that already ends on the outer face unchanged", () => {
    const flush = seat({ uid: "flush", width: 18 }, leftFace - 18);
    const out = clampPlacedToRefrigeratorPanels([left, right, flush], room);
    const kept = out.placed.find((item) => item.uid === "flush")!;
    expect(kept.width).toBe(18);
    expect(along(kept).end).toBeCloseTo(leftFace, 6);
    expect(out.notes).toEqual([]);
  });

  it("holds the cabinet above to the panel front and does not let it pass either outer face", () => {
    const bridge = seat({
      uid: "bridge",
      masterCode: "W3624",
      description: "Refrigerator wall cabinet",
      placement: "wall",
      width: 40,
      depth: 27,
      height: 24,
      mountBottom: 72,
    }, leftFace - 0.5);
    expect(along(bridge).start).toBeLessThan(leftFace);
    expect(along(bridge).end).toBeGreaterThan(rightFace);
    const out = clampPlacedToRefrigeratorPanels([left, right, bridge], room);
    const kept = out.placed.find((item) => item.uid === "bridge")!;
    const span = along(kept);
    expect(span.start).toBeGreaterThanOrEqual(leftFace - EPS);
    expect(span.end).toBeLessThanOrEqual(rightFace + EPS);
    expect(kept.depth).toBeLessThanOrEqual(24 + EPS);
    expect(kept.depth).toBeCloseTo(24, 6);
  });

  it("does not shrink a refrigerator that is too wide for the opening", () => {
    const fridge = seat({
      uid: "fridge",
      masterCode: "FRIDGE-40",
      description: "40 inch Refrigerator",
      category: "Appliance",
      subCategory: "Refrigerator",
      placement: "appliance",
      width: 40,
      depth: 30,
      height: 70,
      numberOfDoors: 0,
    }, 30.5);
    const out = clampPlacedToRefrigeratorPanels([left, right, fridge], room);
    const kept = out.placed.find((item) => item.uid === "fridge")!;
    expect(kept.width).toBe(40);
    expect(kept.depth).toBeLessThanOrEqual(24 + EPS);
  });

  it("clips a countertop run that crosses the panel and does not bridge the bay", () => {
    const base = seat({ uid: "base", width: 30.25, depth: 24 }, 0);
    const far = seat({ uid: "far", width: 24, depth: 24 }, rightFace);
    const surfaces = countertopSurfaces([left, right, base, far], room, null).filter((surface) => surface.kind === "base");
    for (const surface of surfaces) {
      const end = surface.x + surface.width;
      expect(surface.x).not.toBeLessThan(0);
      const crossesLeft = surface.x < leftFace - EPS && end > leftFace + EPS;
      const crossesRight = surface.x < rightFace - EPS && end > rightFace + EPS;
      expect(crossesLeft).toBe(false);
      expect(crossesRight).toBe(false);
    }
    const leftSlab = surfaces.find((surface) => surface.x < leftFace);
    expect(leftSlab).toBeTruthy();
    expect(leftSlab!.x + leftSlab!.width).toBeCloseTo(leftFace, 6);
    expect(surfaces.some((surface) => surface.x > leftFace + EPS && surface.x + surface.width < rightFace - EPS)).toBe(false);
  });

  it("stops a wall-run drag at the outer face", () => {
    const moving = seat({ uid: "dragged", width: 18.25 }, leftFace - 18);
    const preview = cabinetWallMovePreview(
      moving,
      { x: moving.x, y: moving.y },
      room,
      [left, right],
      [],
      { magnet: false, exact: true, target: { wallId: "top", wallOffset: leftFace - 18 } },
    );
    expect(preview.candidate).toBeTruthy();
    expect(along(preview.candidate!).end).toBeCloseTo(leftFace, 6);
    expect(along(preview.candidate!).end).toBeLessThanOrEqual(leftFace + EPS);
  });

  it("shortens trim runs on both sides inside the shared layout rules", () => {
    const result = applyDesignerLayoutRules({
      placed: [left, right],
      room,
      openings: [],
      fillers: [],
      makeUid: () => "unused",
      styleId: null,
      trimPieces: [
        { id: "crown-left", kind: "crown", supplierId: "alpha", wallId: "top", startIn: leftFace - 24, endIn: leftFace + 0.5 },
        { id: "shoe-right", kind: "shoe", supplierId: "alpha", wallId: "top", startIn: rightFace - 0.125, endIn: rightFace + 30 },
        { id: "rail-other", kind: "light-rail", supplierId: "alpha", wallId: "bottom", startIn: 0, endIn: 40 },
      ],
    });
    expect(result.appliedRuleIds).toContain("nothing-past-refrigerator-panel");
    const crown = result.trimPieces.find((piece) => piece.id === "crown-left");
    const shoe = result.trimPieces.find((piece) => piece.id === "shoe-right");
    const other = result.trimPieces.find((piece) => piece.id === "rail-other");
    expect(crown?.endIn).toBeCloseTo(leftFace, 6);
    expect(shoe?.startIn).toBeCloseTo(rightFace, 6);
    expect(other).toMatchObject({ startIn: 0, endIn: 40 });
  });
});

describe("panel outer-face span math", () => {
  const stops = panelOuterStops([
    { panelUid: "L", refrigeratorUid: "fridge", wallId: "top", start: 30, end: 30.75, faceDepth: 24, top: 96, side: "left" },
    { panelUid: "R", refrigeratorUid: "fridge", wallId: "top", start: 67.5, end: 68.25, faceDepth: 24, top: 96, side: "right" },
  ]);

  it("keeps the outside of a span that crosses the left outer face", () => {
    expect(clampSpanToPanelOuterFaces(27, 30.0625, stops, 0.125)).toEqual({ start: 27, end: 30 });
  });

  it("keeps the outside of a span that crosses the right outer face", () => {
    expect(clampSpanToPanelOuterFaces(68, 80, stops, 0.125)).toEqual({ start: 68.25, end: 80 });
  });

  it("drops the bay when a countertop run crosses both panels", () => {
    expect(clipCountertopSpan(0, 120, stops)).toEqual([
      { start: 0, end: 30 },
      { start: 68.25, end: 120 },
    ]);
  });
});
