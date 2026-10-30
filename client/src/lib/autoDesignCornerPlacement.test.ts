import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import { seatAutoDesignCornerFromCatalog } from "./autoDesignCornerPlacement";
import { autoDesignCornerSlots, autoDesignCornerSlotPoint } from "./autoDesignCornerStage";
import { planAutoDesignBaseSegment } from "./autoDesignSeamFillers";
import {
  DEFAULT_ROOM, cabinetWall, freeSegmentsOnWall, wallPlacementAt, wallRunOffset,
  type DesignCabinet, type PlacedCabinet,
} from "./design";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const rows = (kind: "base" | "accessory") => REAL["330011"]![kind] as DesignCabinet[];
const byCode = (code: string) => {
  const found = rows("base").find((row) => row.masterCode === code);
  if (!found) throw new Error(`fixture is missing ${code}`);
  return found;
};
const fillers = rows("accessory").filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));
const uids = () => { let n = 0; return () => `c-${++n}`; };

function diagonal(id: number, masterCode: string, width: number): DesignCabinet {
  return {
    ...byCode("LSB36"),
    id,
    masterCode,
    description: `${width} inch Diagonal Corner Base`,
    width: String(width),
    cornerType: "diagonal",
    fillerRequired: false,
  };
}

function fridge(start: number): PlacedCabinet {
  const spot = wallPlacementAt(start, 36, 30, "top", DEFAULT_ROOM);
  return {
    uid: "fridge-1",
    cabinetId: 0,
    masterCode: "FRIDGE-36",
    description: '36" Refrigerator',
    category: "Appliance",
    subCategory: "Appliance",
    placement: "appliance",
    ...spot,
    width: 36,
    depth: 30,
    height: 70,
    numberOfDoors: 0,
    numberOfDrawers: 0,
  } as PlacedCabinet;
}

const TOP_RIGHT = { x: DEFAULT_ROOM.width, y: 0, firstWallId: "top" };

describe("automatic corner placement", () => {
  const bbc36 = byCode("BBC36");
  const lsb36 = byCode("LSB36");
  const lsb33 = byCode("LSB33");
  const dcb = diagonal(88001, "DCB36", 36);

  const seat = (
    options: DesignCabinet[],
    working: PlacedCabinet[] = [],
    extra: Partial<Parameters<typeof seatAutoDesignCornerFromCatalog>[0]> = {},
  ) => seatAutoDesignCornerFromCatalog({
    slot: { id: "wall-1-wall-2", label: "Corner between Wall 1 and Wall 2", firstWall: "Wall 1", secondWall: "Wall 2" },
    options,
    pool: options,
    target: TOP_RIGHT,
    cornerWallIds: ["top", "right"],
    working,
    room: DEFAULT_ROOM,
    openings: [],
    catalogFillers: fillers,
    makeUid: uids(),
    styleId: 330011,
    ...extra,
  });

  it("places a diagonal corner on an L and on both U corners when the line sells one", () => {
    const options = [dcb, lsb36, bbc36];
    const lSlots = autoDesignCornerSlots("l-shape", {
      wallIds: ["top", "right"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
    });
    expect(lSlots).toHaveLength(1);
    const lPoint = autoDesignCornerSlotPoint(lSlots[0]!, DEFAULT_ROOM, "left", "right");
    const lSeated = seat(options, [], { slot: lSlots[0], target: lPoint! });
    expect(lSeated.ok, lSeated.ok ? "" : lSeated.message).toBe(true);
    if (!lSeated.ok) return;
    expect(lSeated.source.masterCode).toBe("DCB36");
    expect(lSeated.fallbackNote).toBeNull();

    const uSlots = autoDesignCornerSlots("u-shape", {
      wallIds: ["top", "right", "bottom", "left"], room: DEFAULT_ROOM, originCorner: "left", runDirection: "right",
    });
    expect(uSlots.map((slot) => slot.id)).toEqual(["wall-1-wall-2", "wall-2-wall-3"]);
    let working: PlacedCabinet[] = [];
    for (const slot of uSlots) {
      const point = autoDesignCornerSlotPoint(slot, DEFAULT_ROOM, "left", "right");
      const seated = seat(options, working, {
        slot,
        target: point!,
        cornerWallIds: slot.id === "wall-1-wall-2" ? ["top", "right"] : ["right", "bottom"],
      });
      expect(seated.ok, seated.ok ? "" : seated.message).toBe(true);
      if (!seated.ok) return;
      expect(seated.source.masterCode).toBe("DCB36");
      working = seated.placed;
    }
    expect(working.some((item) => cabinetWall(item, DEFAULT_ROOM) === "left")).toBe(false);
  });

  it("falls back from a diagonal to the largest lazy Susan, then to a blind corner", () => {
    const noDiagonal = seat([lsb36, lsb33, bbc36]);
    expect(noDiagonal.ok, noDiagonal.ok ? "" : noDiagonal.message).toBe(true);
    if (!noDiagonal.ok) return;
    expect(noDiagonal.source.masterCode).toBe("LSB36");
    expect(noDiagonal.fallbackNote).toBeNull();

    const blocked = fridge(91);
    const fallback = seat([dcb, lsb36, lsb33, bbc36], [blocked], { measuredApplianceUids: ["fridge-1"] });
    expect(fallback.ok, fallback.ok ? "" : fallback.message).toBe(true);
    if (!fallback.ok) return;
    expect(fallback.source.masterCode).toBe("BBC36");
    expect(fallback.fallbackNote).toMatch(/DCB36 does not fit/);
    expect(fallback.fallbackNote).toMatch(/blind side on the wall with more room/);
    expect(fallback.blindRunWallId).toBe("right");
    expect(fallback.placed.some((item) => /filler/i.test(`${item.masterCode} ${item.description}`))).toBe(true);
  });

  it("errors only when no source-priced blind corner fits", () => {
    const blocked = fridge(95);
    const result = seat([dcb, lsb36, bbc36], [blocked], { measuredApplianceUids: ["fridge-1"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/BBC36/);
    expect(result.message).toMatch(/may only move 12"/);
  });

  it("places the corner cabinet and its filler before any straight cabinet on an adjoining wall", () => {
    const seated = seat([bbc36]);
    expect(seated.ok, seated.ok ? "" : seated.message).toBe(true);
    if (!seated.ok) return;
    const cornerIndex = seated.placed.findIndex((item) => item.uid === seated.corner.uid);
    const fillerIndex = seated.placed.findIndex((item) => /filler/i.test(`${item.masterCode} ${item.description}`));
    expect(cornerIndex).toBeGreaterThanOrEqual(0);
    expect(fillerIndex).toBeGreaterThan(cornerIndex);
    const catalog = rows("base").filter((row) => /^B(24|30|36)$/.test(row.masterCode));
    const segments = freeSegmentsOnWall("top", DEFAULT_ROOM, seated.placed, [], 9, 0, "base", false);
    const added: PlacedCabinet[] = [];
    let working = seated.placed;
    for (const segment of segments) {
      const fill = planAutoDesignBaseSegment({
        length: segment.length, catalog, rangeAtStart: false, rangeAtEnd: false,
      });
      let along = segment.start;
      for (const item of fill.items) {
        if (item.isFiller) { along += item.width; continue; }
        const spot = wallPlacementAt(along, item.width, 24, "top", DEFAULT_ROOM);
        const candidate = {
          uid: `fill-${item.cabinet.masterCode}-${along}`,
          cabinetId: item.cabinet.id,
          masterCode: item.cabinet.masterCode,
          description: item.cabinet.description,
          placement: "base" as const,
          ...spot,
          width: item.width,
          depth: 24,
          height: 34.5,
        } as PlacedCabinet;
        added.push(candidate);
        working = [...working, candidate];
        along += item.width;
      }
    }
    expect(added.length).toBeGreaterThan(0);
    const cornerAt = working.findIndex((item) => item.uid === seated.corner.uid);
    const fillerAt = working.findIndex((item) => item.uid === seated.placed[fillerIndex]!.uid);
    const firstFill = working.findIndex((item) => item.uid === added[0]!.uid);
    expect(cornerAt).toBeLessThan(firstFill);
    expect(fillerAt).toBeLessThan(firstFill);
    expect(added.every((item) => !/^(?:BBC|LSB|DCB)/.test(item.masterCode))).toBe(true);
    expect(wallRunOffset(seated.corner, cabinetWall(seated.corner, DEFAULT_ROOM), DEFAULT_ROOM)).toBeGreaterThanOrEqual(0);
  });
});
