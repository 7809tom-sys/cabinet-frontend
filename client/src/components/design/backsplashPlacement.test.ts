import { describe, expect, it } from "vitest";
import catalogFixture from "@/lib/__fixtures__/autoDesignRealCatalog.json";
import { seatAutoDesignCorner } from "@/lib/autoDesignCornerSeating";
import { planAutoDesignBaseSegment } from "@/lib/autoDesignSeamFillers";
import { buildAutoDesignWallCabinets } from "@/lib/autoDesignWallCabinets";
import { threeDBacksplashSegments } from "./InteractiveRoom3D";
import {
  wallPlacementAt,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "@/lib/design";

type Fixture = Record<string, { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] }>;
const REAL = catalogFixture as unknown as Fixture;
const BASES = REAL["330011"].base;
const WALLS = REAL["330011"].wall;
const FILLERS = REAL["330011"].accessory.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));
const ROOM: RoomData = { width: 150, depth: 150, ceilingHeight: 96 };
let sequence = 0;
const uid = () => `backsplash-${++sequence}`;

function catalog(rows: DesignCabinet[], code: string) {
  const row = rows.find((item) => item.masterCode === code);
  if (!row) throw new Error(`missing ${code}`);
  return row;
}

function spansOn(placed: PlacedCabinet[], room: RoomData, side: string) {
  return threeDBacksplashSegments(placed, [], room).filter((segment) => segment.side === side);
}

describe("backsplash placement", () => {
  it("includes a wall cabinet on a regular wall", () => {
    const source = catalog(WALLS, "W3030");
    const upper = {
      uid: "upper-top", cabinetId: source.id, masterCode: "W3030", description: source.description,
      placement: "wall" as const, ...wallPlacementAt(24, 30, 12, "top", ROOM),
      width: 30, depth: 12, height: 30, mountBottom: 54, numberOfDoors: 2, numberOfDrawers: 0,
    } as PlacedCabinet;
    expect(spansOn([upper], ROOM, "top")).toEqual([
      { side: "top", start: 24, end: 54, bottom: 36, top: 54 },
    ]);
  });

  it("includes the same wall cabinet when it belongs to a custom wall", () => {
    const customRoom = {
      ...ROOM,
      vertices: [
        { id: "a", x: 0, y: 0 }, { id: "b", x: 150, y: 0 },
        { id: "c", x: 150, y: 150 }, { id: "d", x: 0, y: 150 },
      ],
      customWalls: [
        { id: "cw-1", startVertexId: "a", endVertexId: "b" },
        { id: "cw-2", startVertexId: "b", endVertexId: "c" },
      ],
    } as RoomData;
    const upper = {
      uid: "upper-custom", cabinetId: catalog(WALLS, "W3030").id, masterCode: "W3030",
      description: "30 inch wall", placement: "wall" as const,
      ...wallPlacementAt(30, 30, 12, "top", ROOM),
      wallId: "cw-1", wallOffset: 30, width: 30, depth: 12, height: 30, mountBottom: 54,
      numberOfDoors: 2, numberOfDrawers: 0,
    } as PlacedCabinet;
    expect(spansOn([upper], customRoom, "cw-1")).toEqual([
      { side: "cw-1", start: 30, end: 60, bottom: 36, top: 54 },
    ]);
    expect(threeDBacksplashSegments([upper], [], customRoom).some((segment) => segment.side === "top")).toBe(false);
  });

  it("does not let a diagonal corner shrink the neighboring straight upper", () => {
    const straight = {
      uid: "upper-straight", cabinetId: catalog(WALLS, "W3030").id, masterCode: "W3030",
      description: catalog(WALLS, "W3030").description, placement: "wall" as const,
      ...wallPlacementAt(24, 30, 12, "top", ROOM),
      width: 30, depth: 12, height: 30, mountBottom: 54, numberOfDoors: 2, numberOfDrawers: 0,
    } as PlacedCabinet;
    const diagonal = {
      uid: "dcw", cabinetId: catalog(WALLS, "DCW2430").id, masterCode: "DCW2430",
      description: catalog(WALLS, "DCW2430").description, placement: "wall" as const,
      cornerType: "diagonal" as const, ...wallPlacementAt(0, 24, 12, "top", ROOM),
      width: 24, depth: 12, height: 30, mountBottom: 54, numberOfDoors: 1, numberOfDrawers: 0,
    } as PlacedCabinet;
    const alone = spansOn([straight], ROOM, "top");
    const together = spansOn([straight, diagonal], ROOM, "top");
    expect(alone).toEqual([{ side: "top", start: 24, end: 54, bottom: 36, top: 54 }]);
    expect(together).toEqual([{ side: "top", start: 0, end: 54, bottom: 36, top: 54 }]);
  });

  it("tiles a 150 inch auto-built U on all three walls", () => {
    const straightCatalog = BASES.filter((row) => !row.isCornerCabinet && ["B12", "B15", "B18", "B21", "B24", "B27", "B30", "B33", "B36"].includes(row.masterCode));
    const placeBase = (code: string, along: number, wall: "top" | "right" | "bottom", width: number) => {
      const source = catalog(BASES, code);
      const spot = wallPlacementAt(along, width, Number(source.depth) || 24, wall, ROOM);
      return {
        uid: uid(), cabinetId: source.id, masterCode: source.masterCode, description: source.description,
        category: source.category, subCategory: source.subCategory, placement: "base" as const,
        ...spot, width, depth: Number(source.depth) || 24, height: Number(source.height) || 34.5,
        numberOfDoors: source.numberOfDoors, numberOfDrawers: source.numberOfDrawers,
      } as PlacedCabinet;
    };
    const buildRun = (wall: "top" | "right" | "bottom", length: number, start: number) => {
      const plan = planAutoDesignBaseSegment({
        length, catalog: straightCatalog, rangeAtStart: false, rangeAtEnd: false,
        heavyCookLanding: false, preferDrawerBesideRange: false,
      });
      const placed: PlacedCabinet[] = [];
      let along = start;
      for (const item of plan.items) {
        if (item.isFiller) { along += item.width; continue; }
        placed.push(placeBase(item.cabinet.masterCode, along, wall, item.width));
        along += item.width;
      }
      return placed;
    };
    const first = seatAutoDesignCorner({
      source: catalog(BASES, "LSB36"),
      slotLabel: "Wall 1-Wall 2",
      target: { x: ROOM.width, y: 0, firstWallId: "top" },
      cornerWallIds: ["top", "right"],
      working: [],
      room: ROOM,
      openings: [],
      isBlindOption: false,
      catalogFillers: FILLERS as never,
      makeUid: uid,
      styleId: 330011,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const bases = [
      ...first.placed,
      ...buildRun("top", 114, 0),
      ...buildRun("right", 78, 36),
    ];
    const second = seatAutoDesignCorner({
      source: catalog(BASES, "LSB36"),
      slotLabel: "Wall 2-Wall 3",
      target: { x: ROOM.width, y: ROOM.depth, firstWallId: "right" },
      cornerWallIds: ["right", "bottom"],
      working: bases,
      room: ROOM,
      openings: [],
      isBlindOption: false,
      catalogFillers: FILLERS as never,
      makeUid: uid,
      styleId: 330011,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const uppers = buildAutoDesignWallCabinets({
      placed: [...second.placed, ...buildRun("bottom", 114, 0)],
      room: ROOM,
      openings: [],
      catalog: WALLS,
      wallCabinetHeightIn: 30,
      styleId: 330011,
      makeUid: uid,
      catalogFillers: FILLERS as never,
      corners: [
        { base: first.corner, point: { x: ROOM.width, y: 0, firstWallId: "top" } },
        { base: second.corner, point: { x: ROOM.width, y: ROOM.depth, firstWallId: "right" } },
      ],
    });
    expect(uppers.skipped).toEqual([]);
    const segments = threeDBacksplashSegments(uppers.placed, [], ROOM);
    for (const side of ["top", "right", "bottom"] as const) {
      const run = segments.filter((segment) => segment.side === side);
      expect(run).toEqual([{ side, start: 0, end: 150, bottom: 36, top: 54 }]);
    }
  });
});
