import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";
import {
  appendCollisionFreePlacements,
  freeSegmentsOnWall,
  hasCollision,
  nonApronSinkDeckPlacement,
  placedFootprint,
  snapPosition,
  wallPlacementAt,
} from "./design";
import { anchorAlongStartIn, wallLabelToEngineWallId, type AutoDesignInputs } from "./autoDesignAutoBuild";
import { runAutoDesignLayout } from "./autoDesignLayout";
import { bathroomFixtureFreePlacement, rotateBathroomFurniture } from "./bathroomPlanning";
import {
  cabinetFloorRectangle,
  cabinetOwnsFloor,
  fixtureFloorCabinets,
  floorRectsOverlap,
  resolveFurnitureMove,
} from "./floorOccupancy";
import { withFloorObstacles } from "./floorOccupancyState";
import { FURNITURE_CATALOG, furnitureFootprint, makeFurniture, makePelicanBathroomFixture } from "./design";

const room = { width: 120, depth: 96, ceilingHeight: 96 };

function cabinet(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "cab",
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

function toiletAt(x: number, y: number) {
  return { ...makeFurniture("pelican-toilet-pl-12044", x, y), uid: "toilet", pelicanCode: "PL-12044" };
}

function tubAt(x: number, y: number, rotation = 0) {
  return { ...makeFurniture("pelican-tub-pl-02146-59", x, y), uid: "tub", rotation, pelicanCode: 'PL-02146 59"' };
}

describe("floor footprints never intersect", () => {
  it("gives a toilet and a tub their full supplier footprint", () => {
    const toilet = toiletAt(0, 0);
    const tub = tubAt(0, 0, 90);
    const toiletDef = FURNITURE_CATALOG.find((item) => item.id === toilet.defId)!;
    const tubDef = FURNITURE_CATALOG.find((item) => item.id === tub.defId)!;
    const toiletFoot = furnitureFootprint(toilet, toiletDef);
    const tubFoot = furnitureFootprint(tub, tubDef);
    expect(toiletFoot.d).toBeGreaterThan(26);
    expect(tubFoot.w).toBeGreaterThan(59);
    const bodies = fixtureFloorCabinets([toilet, tub]);
    expect(bodies[0]).toMatchObject({ width: toiletFoot.w, depth: toiletFoot.d, placement: "base", floorOccupancyObstacle: true });
    expect(bodies[1]).toMatchObject({ width: tubFoot.w, depth: tubFoot.d });
    expect(placedFootprint(bodies[0] as PlacedCabinet)).toEqual({ w: toiletFoot.w, d: toiletFoot.d });
  });

  it("refuses a vanity and a drawer base that would sit inside a toilet or tub", () => {
    const vanity = cabinet({ uid: "vanity", masterCode: "VS36", description: "Vanity sink base", x: 0, y: 0, width: 36, depth: 21 });
    const drawer = cabinet({ uid: "drawer", masterCode: "3VDB12", description: "Vanity drawer base", x: 40, y: 30, width: 12, depth: 21 });
    const toilet = toiletAt(10, 0);
    const tub = tubAt(20, 20);
    const obstacles = fixtureFloorCabinets([toilet, tub]);
    withFloorObstacles(obstacles, () => {
      expect(hasCollision(vanity, [])).toBe(true);
      expect(hasCollision(drawer, [])).toBe(true);
      expect(appendCollisionFreePlacements([], [drawer]).rejected).toHaveLength(1);
    });
  });

  it("allows edges to touch and still lets a wall cabinet hang above a toilet", () => {
    const vanity = cabinet({ uid: "vanity", masterCode: "VS36", x: 0, y: 0, width: 36, depth: 21 });
    const vanityFoot = placedFootprint(vanity);
    const toilet = toiletAt(0, vanityFoot.d);
    const wall = cabinet({
      uid: "wall",
      masterCode: "W3030",
      description: "Wall",
      placement: "wall",
      x: 0,
      y: 0,
      width: 30,
      depth: 12,
      height: 30,
    });
    const tall = cabinet({ uid: "tall", masterCode: "TC2484", description: "Tall", placement: "tall", x: 0, y: 0, width: 24, depth: 24, height: 84 });
    withFloorObstacles(fixtureFloorCabinets([toilet]), () => {
      expect(hasCollision(vanity, [])).toBe(false);
      expect(hasCollision(wall, [])).toBe(false);
      expect(hasCollision(tall, [])).toBe(true);
    });
    const toiletFoot = furnitureFootprint(toilet, FURNITURE_CATALOG.find((item) => item.id === toilet.defId)!);
    expect(floorRectsOverlap(
      { uid: "vanity", x: 0, y: 0, w: vanityFoot.w, d: vanityFoot.d, label: "VS36" },
      { uid: "toilet", x: 0, y: vanityFoot.d, w: toiletFoot.w, d: toiletFoot.d, label: "toilet" },
    )).toBe(false);
  });

  it("blocks only the wall strip a fixture actually enters", () => {
    const onWall = tubAt(18, 0, 90);
    const center = tubAt(30, 40, 0);
    const onWallBody = fixtureFloorCabinets([onWall]);
    const centerBody = fixtureFloorCabinets([center]);
    const wallSegments = withFloorObstacles(onWallBody, () => freeSegmentsOnWall("top", room, [], [], 9, 0, "base", false, undefined, 24));
    const openSegments = withFloorObstacles(centerBody, () => freeSegmentsOnWall("top", room, [], [], 9, 0, "base", false, undefined, 24));
    const tubFoot = furnitureFootprint(onWall, FURNITURE_CATALOG.find((item) => item.id === onWall.defId)!);
    expect(wallSegments.some((segment) => segment.start < 18 && segment.start + segment.length > 18 + tubFoot.w)).toBe(false);
    expect(openSegments).toEqual([{ start: 0, length: 120 }]);
    expect(wallSegments.reduce((sum, segment) => sum + segment.length, 0)).toBeLessThan(120);
  });

  it("places a toilet beside a vanity and a tub instead of on top of either", () => {
    const vanity = cabinet({ uid: "vanity", masterCode: "VS48", x: 36, y: 0, width: 48, depth: 21 });
    const tub = tubAt(10, 40, 90);
    const placement = bathroomFixtureFreePlacement(toiletAt(0, 0), [tub], room, [vanity]);
    expect(placement).not.toBeNull();
    const toilet = { ...toiletAt(placement!.x, placement!.y), rotation: placement!.rotation };
    const toiletRect = { uid: "new", ...furnitureFootprint(toilet, FURNITURE_CATALOG.find((item) => item.id === toilet.defId)!), x: toilet.x, y: toilet.y, label: "toilet" };
    const vanityRect = cabinetFloorRectangle(vanity)!;
    const tubRect = fixtureFloorCabinets([tub])[0]!;
    expect(floorRectsOverlap(toiletRect, vanityRect)).toBe(false);
    expect(floorRectsOverlap(toiletRect, { uid: "tub", x: tubRect.x, y: tubRect.y, w: tubRect.width, d: tubRect.depth, label: "tub" })).toBe(false);
  });

  it("snaps a dragged toilet out of a vanity and refuses a move that cannot clear the tub", () => {
    const vanity = cabinet({ uid: "vanity", masterCode: "VS36", x: 0, y: 0, width: 36, depth: 21 });
    const toilet = toiletAt(80, 40);
    const dragged = resolveFurnitureMove(toilet, 8, 0, room, [toilet], [vanity]);
    expect(dragged).not.toBeNull();
    const draggedRect = {
      uid: "toilet",
      x: dragged!.x,
      y: dragged!.y,
      ...furnitureFootprint(dragged!, FURNITURE_CATALOG.find((item) => item.id === toilet.defId)!),
      label: "toilet",
    };
    expect(floorRectsOverlap(draggedRect, cabinetFloorRectangle(vanity)!)).toBe(false);
    const filler = tubAt(0, 0, 0);
    const boxed = { ...makeFurniture("pelican-tub-filler-pl-8515-mb", 40, 40), uid: "filler", pelicanCode: "PL-8515 MB" };
    const covering = tubAt(0, 0, 0);
    // A tub filler may share the tub's floor space so its spout reaches the bowl,
    // so this move is allowed. It still must not be pushed onto anything else.
    const tubFoot = furnitureFootprint(covering, FURNITURE_CATALOG.find((item) => item.id === covering.defId)!);
    const tinyRoom = { width: tubFoot.w, depth: tubFoot.d };
    expect(resolveFurnitureMove(boxed, 1, 1, tinyRoom, [boxed, covering], [])).not.toBeNull();
    // In a room smaller than the filler, the move is still clamped inside the
    // room rather than thrown away, and never placed onto the tub's own bowl
    // body from another fixture.
    expect(resolveFurnitureMove(boxed, 1, 1, { width: 8, depth: 8 }, [boxed, covering], [])).not.toBeNull();
    expect(filler.uid).toBe("tub");
  });

  it("refuses a rotation that would swing a tub through a cabinet", () => {
    const tub = tubAt(0, 30, 0);
    const blocker = cabinet({ uid: "side", masterCode: "B24", x: 4, y: 48, width: 36, depth: 24 });
    const turned = rotateBathroomFurniture(tub, { width: 120, depth: 96 }, { furniture: [tub], cabinets: [blocker] });
    expect(turned).toMatchObject({ rotation: 0, x: tub.x, y: tub.y });
    const clear = rotateBathroomFurniture(tub, { width: 160, depth: 160 });
    expect(clear.rotation).toBe(90);
  });

  it("keeps a shallow rear deck informational and does not move the vanity", () => {
    const vanity = cabinet({ uid: "vanity", masterCode: "VS30", description: "30 in Vanity Sink Base", category: "Vanity", subCategory: "Vanity Sink", x: 12, y: 0, width: 30, depth: 21 });
    const before = { x: vanity.x, y: vanity.y };
    const deck = nonApronSinkDeckPlacement(vanity, room, { width: 20, depth: 19 });
    expect(deck.faucetDeckTight).toBe(true);
    expect(deck.ok).toBe(true);
    expect(deck.faucetCanFit).toBe(true);
    expect(vanity.x).toBe(before.x);
    expect(vanity.y).toBe(before.y);
    expect(cabinetOwnsFloor(vanity)).toBe(true);
    expect(cabinetOwnsFloor(cabinet({ placement: "wall", masterCode: "W3030", height: 30, depth: 12 }))).toBe(false);
  });

  it("does not slide a tall pantry into the toilet when the floor footprint is occupied", () => {
    const pantry = cabinet({ uid: "pantry", masterCode: "TC2484", description: "Tall pantry", placement: "tall", x: 90, y: 0, width: 24, depth: 24, height: 84 });
    const toilet = toiletAt(60, 0);
    const before = { x: pantry.x, y: pantry.y };
    const snapped = withFloorObstacles(fixtureFloorCabinets([toilet]), () => snapPosition({ ...pantry, x: 70, y: 0 }, room, [pantry]));
    expect(snapped).toMatchObject({ x: 70, y: 0 });
    expect(pantry.x).toBe(before.x);
    expect(pantry.y).toBe(before.y);
    expect(toilet.x).toBe(60);
    expect(toilet.y).toBe(0);
  });
});

describe("Auto Design keeps floor fixtures clear", () => {
  const REAL = realCatalog as unknown as Record<string, { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] }>;
  const STYLE = "330011";
  const bases = REAL[STYLE]!.base;
  const walls = REAL[STYLE]!.wall;
  const fillers = REAL[STYLE]!.accessory.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

  function kitchen(): RoomData {
    return { width: 168, depth: 132, ceilingHeight: 96 };
  }

  function inputs(): AutoDesignInputs {
    return {
      layoutType: "single-wall",
      originCorner: "left",
      runDirection: "right",
      wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 1", centerOffsetIn: 48 },
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 1", centerOffsetIn: 108 },
      skipDishwasher: true,
      dishwasher: null,
      refrigerator: null,
    };
  }

  function build(obstacles = fixtureFloorCabinets([])) {
    let uid = 0;
    return withFloorObstacles(obstacles, () => runAutoDesignLayout({
      input: inputs(),
      room: kitchen(),
      openings: [],
      baseCatalog: bases,
      wallCatalog: walls,
      fillers,
      appliancePalette: [
        { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
        { id: 0, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", height: "34.5", depth: "24", placement: "appliance" } as DesignCabinet,
        { id: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator', category: "Appliance", subCategory: "Appliance", width: "36", height: "70", depth: "30", placement: "appliance" } as DesignCabinet,
      ],
      refrigeratorCaps: [],
      refrigeratorEndPanels: [],
      styleId: 330011,
      makeUid: () => `uid-${++uid}`,
    }));
  }

  it("matches a kitchen with no fixture, including wiggle, when the tub is clear of every wall", () => {
    const plain = build();
    const centerTub = tubAt(60, 48, 0);
    const withTub = build(fixtureFloorCabinets([centerTub]));
    expect(plain.ok).toBe(true);
    expect(withTub.ok).toBe(true);
    if (!plain.ok || !withTub.ok) return;
    const signature = (rows: PlacedCabinet[]) => rows.map((item) => ({
      masterCode: item.masterCode,
      x: item.x,
      y: item.y,
      width: item.width,
      depth: item.depth,
      placement: item.placement,
    }));
    expect(signature(withTub.placed)).toEqual(signature(plain.placed));
    const tubBody = fixtureFloorCabinets([centerTub])[0]!;
    for (const item of withTub.placed.filter(cabinetOwnsFloor)) {
      const footprint = placedFootprint(item);
      expect(floorRectsOverlap(
        { uid: item.uid, x: item.x, y: item.y, w: footprint.w, d: footprint.d, label: item.masterCode },
        { uid: "tub", x: tubBody.x, y: tubBody.y, w: tubBody.width, d: tubBody.depth, label: "tub" },
      )).toBe(false);
    }
  });

  it("does not seat the sink or any other floor cabinet inside a tub on that wall", () => {
    const kitchenRoom = kitchen();
    const wall = wallLabelToEngineWallId("Wall 1", kitchenRoom, "left", "right")!;
    const along = anchorAlongStartIn({ wallLabel: "Wall 1", centerOffsetIn: 48 }, 36, wall);
    const spot = wallPlacementAt(along, 36, 24, wall.engineWallId, kitchenRoom);
    const tub = tubAt(spot.x - 12, spot.y, 90);
    const result = build(fixtureFloorCabinets([tub]));
    const tubBody = fixtureFloorCabinets([tub])[0]!;
    const tubRect = { uid: "tub", x: tubBody.x, y: tubBody.y, w: tubBody.width, d: tubBody.depth, label: "tub" };
    if (result.ok) {
      for (const item of result.placed.filter(cabinetOwnsFloor)) {
        const footprint = placedFootprint(item);
        expect(floorRectsOverlap(
          { uid: item.uid, x: item.x, y: item.y, w: footprint.w, d: footprint.d, label: item.masterCode },
          tubRect,
        )).toBe(false);
      }
    } else {
      expect(result.message.toLowerCase()).toMatch(/overlap|cannot be placed/);
    }
  });
});
