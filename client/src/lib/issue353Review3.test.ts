/**
 * Issue 353, third review (Tom, Nov 9 2026), items 2, 3 and 4.
 *
 * 2. The no-void rule must not board over the short counter landing that
 *    everyday cooking keeps beside the range.
 * 3. On a frameless line that sells OF* + AF3006 (no BF*), a 6-inch seam must be
 *    closed with real 6-inch overlay stock, never with the appliance filler
 *    three-pack; and AltaEuro's 5-7/8-inch OF6 board is nominal 6-inch stock.
 * 4. A loose 45-degree cabinet that merely TOUCHES a custom-wall (Wall Builder)
 *    run or a peninsula must not hijack that run into a freestanding chain.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM,
  countertopSurfaces,
  wallPlacementAt,
  type PlacedCabinet,
  type RoomData,
} from "./design";
import { applyDesignerLayoutRules, closeAdjoiningBaseVoids } from "./designerLayoutRules";
import {
  catalogFillerForGap,
  isApplianceFillerPack,
  isCatalogFiller,
} from "./catalogFiller";
import {
  freestandingChainMemberUids,
  isChainWallAnchor,
} from "./freestandingRun";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 216, depth: 168, ceilingHeight: 96 };

function base(uid: string, offset: number, width: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", ROOM);
  return {
    uid,
    cabinetId: 1,
    masterCode: `B${width}`,
    description: `B${width}`,
    category: "Base",
    subCategory: "Standard Base",
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.5,
    rotation: spot.rotation,
    wallId: "top",
    wallOffset: offset,
    numberOfDoors: 2,
    numberOfDrawers: 0,
    ...extra,
  } as PlacedCabinet;
}

function range(uid: string, offset: number, width = 30): PlacedCabinet {
  return base(uid, offset, width, {
    placement: "appliance",
    masterCode: "RANGE-30",
    description: '30" Range',
    category: "Appliance",
    subCategory: "Appliance",
    applianceRole: "base-height",
    height: 36,
    depth: 25,
  });
}

const fillerStock = [
  { id: 601, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", depth: "24", height: "34.5", placement: "base" },
  { id: 602, masterCode: "BF6", description: '6" Base Filler', category: "Filler", subCategory: "Filler", width: "6", depth: "24", height: "34.5", placement: "base" },
] as never[];

describe("item 2: the no-void rule keeps the range-side counter landing", () => {
  // A 3-inch seam between a base and the range: exactly the short landing
  // `preserveHeavyCookLandings` leaves open for everyday cooking.
  // base 0–24, a real 3-inch seam 24–27, the range 27–57, base 57–81.
  const layout = () => [base("a", 0, 24), range("r", 27, 30), base("c", 57, 24)];
  /** The 3-inch board that would close the seam beside the range. */
  const rangeSeamBoards = (placed: readonly PlacedCabinet[]) => placed.filter((item) => (
    /filler/i.test(`${item.masterCode} ${item.subCategory ?? ""}`)
    && (item.wallOffset ?? 0) > 20 && (item.wallOffset ?? 0) < 30
  ));

  it("leaves the seam beside the range open when the build preserves that landing", () => {
    let uid = 0;
    const result = applyDesignerLayoutRules({
      placed: layout(),
      room: ROOM,
      openings: [],
      fillers: fillerStock,
      makeUid: () => `g${++uid}`,
      styleId: 11,
      allowAutoFillers: false,
      preserveHeavyCookLandings: true,
    });
    expect(rangeSeamBoards(result.placed)).toEqual([]);
  });

  it("still closes an ordinary cabinet-to-cabinet seam when that landing is not in play", () => {
    let uid = 0;
    const result = applyDesignerLayoutRules({
      placed: [base("a", 0, 24), base("b", 27, 24)],
      room: ROOM,
      openings: [],
      fillers: fillerStock,
      makeUid: () => `g${++uid}`,
      styleId: 11,
      allowAutoFillers: false,
      preserveHeavyCookLandings: true,
    });
    const boards = result.placed.filter((item) => /filler/i.test(`${item.masterCode} ${item.subCategory ?? ""}`));
    expect(boards).toHaveLength(1);
    expect(boards[0]!.width).toBeCloseTo(3, 6);
  });

  it("threads the flag through closeAdjoiningBaseVoids itself", () => {
    let uid = 0;
    const kept = closeAdjoiningBaseVoids({
      placed: layout(),
      room: ROOM,
      fillers: fillerStock,
      makeUid: () => `g${++uid}`,
      styleId: 11,
      preserveHeavyCookLandings: true,
    });
    expect(rangeSeamBoards(kept)).toEqual([]);

    let uid2 = 0;
    const filled = closeAdjoiningBaseVoids({
      placed: layout(),
      room: ROOM,
      fillers: fillerStock,
      makeUid: () => `h${++uid2}`,
      styleId: 11,
      preserveHeavyCookLandings: false,
    });
    // Without the flag the same seam IS boarded: that is the behaviour the
    // range-landing rule has to be able to suppress.
    expect(rangeSeamBoards(filled)).toHaveLength(1);
    expect(rangeSeamBoards(filled)[0]!.width).toBeCloseTo(3, 6);
  });
});

describe("item 3: frameless 540005 (OF* + AF3006, no BF*) picks real overlay stock", () => {
  const pack = (realCatalog as unknown as Record<string, { accessory: unknown[] }>)["540005"]!;
  const accessory = pack.accessory as never[];
  const codes = pack.accessory.map((item) => (item as { masterCode: string }).masterCode);

  it("never treats the appliance filler three-pack as cuttable filler stock", () => {
    const af = pack.accessory.find((item) => (item as { masterCode: string }).masterCode === "AF3006") as never;
    expect(af).toBeTruthy();
    expect(isApplianceFillerPack(af)).toBe(true);
    expect(isCatalogFiller(af)).toBe(false);
    // Nothing is selected from it for any seam width.
    for (const gap of [1, 3, 6]) {
      expect(catalogFillerForGap(accessory, gap, "base")?.masterCode).not.toBe("AF3006");
    }
  });

  it("closes 1, 3 and 6-inch seams with the line's own overlay boards", () => {
    const one = catalogFillerForGap(accessory, 1, "base")!;
    const three = catalogFillerForGap(accessory, 3, "base")!;
    const six = catalogFillerForGap(accessory, 6, "base")!;

    // 1 and 3 inches come from the 3-inch (2-7/8 board) overlay family.
    expect(one.masterCode).toMatch(/^OF3/);
    expect(three.masterCode).toMatch(/^OF3/);
    // 6 inches must come from the 6-inch (5-7/8 board) family, not AF3006.
    expect(six.masterCode).toMatch(/^OF6/);
    expect(Number(six.width)).toBeCloseTo(5.875, 3);

    // Each pick is a real, narrow, cuttable board — not a 29-7/8 pack.
    for (const pick of [one, three, six]) {
      expect(Number(pick.width)).toBeLessThan(7);
      expect(codes).toContain(pick.masterCode);
    }
  });

  it("treats AltaEuro's OF6 board as nominal 6-inch stock but not as a 7-inch board", () => {
    // A 6-inch seam is covered by the 5-7/8 board; a 7-inch seam is not.
    expect(catalogFillerForGap(accessory, 6, "base")?.masterCode).toMatch(/^OF6/);
    expect(catalogFillerForGap(accessory, 7, "base")).toBeNull();
    // ...and the 3-inch family is never stretched to a 6-inch seam.
    expect(catalogFillerForGap(accessory, 6, "base")?.masterCode).not.toMatch(/^OF3/);
  });

  it("closes a real 6-inch frameless gap in the designer with an OF6 board", () => {
    let uid = 0;
    const result = applyDesignerLayoutRules({
      placed: [base("a", 0, 24), base("b", 30, 24)],
      room: ROOM,
      openings: [],
      fillers: accessory,
      makeUid: () => `g${++uid}`,
      styleId: 540005,
      allowAutoFillers: false,
    });
    const boards = result.placed.filter((item) => /filler/i.test(`${item.masterCode} ${item.subCategory ?? ""}`));
    expect(boards).toHaveLength(1);
    expect(boards[0]!.masterCode).toMatch(/^OF6/);
  });
});

describe("item 4: a loose 45-degree cabinet must not hijack a custom-wall run or a peninsula", () => {
  const customRoom: RoomData = {
    ...DEFAULT_ROOM,
    width: 200,
    depth: 200,
    vertices: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 120, y: 0 },
      { id: "c", x: 120, y: 120 },
      { id: "d", x: 0, y: 120 },
    ],
    customWalls: [
      { id: "w1", startVertexId: "a", endVertexId: "b" },
      { id: "w2", startVertexId: "b", endVertexId: "c" },
      { id: "w3", startVertexId: "c", endVertexId: "d" },
      { id: "w4", startVertexId: "d", endVertexId: "a" },
    ],
  };

  function onCustomWall(uid: string, offset: number): PlacedCabinet {
    return {
      uid,
      cabinetId: 1,
      masterCode: "B24",
      description: "B24",
      category: "Base",
      subCategory: "Standard Base",
      placement: "base",
      x: offset,
      y: 0,
      width: 24,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "w1",
      wallOffset: offset,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    } as PlacedCabinet;
  }

  function loose45(uid: string, center: { x: number; y: number }, width = 24): PlacedCabinet {
    const bound = Math.abs(width * Math.cos(Math.PI / 4)) + Math.abs(24 * Math.sin(Math.PI / 4));
    return {
      uid,
      cabinetId: 2,
      masterCode: `B${width}`,
      description: "B",
      category: "Base",
      subCategory: "Standard Base",
      placement: "base",
      x: center.x - bound / 2,
      y: center.y - bound / 2,
      width,
      depth: 24,
      height: 34.5,
      rotation: 45,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    } as PlacedCabinet;
  }

  it("does not treat a custom-wall cabinet as a chain anchor", () => {
    expect(isChainWallAnchor(onCustomWall("w0", 0), customRoom)).toBe(false);
    // A cardinal-wall cabinet still is.
    expect(isChainWallAnchor(base("cardinal", 0, 24), ROOM)).toBe(true);
  });

  it("keeps the Wall Builder slab on its own wall when a loose 45-degree cabinet touches the run", () => {
    const run = [onCustomWall("w0", 0), onCustomWall("w1", 24)];
    // What the run looks like on its own.
    const alone = countertopSurfaces(run, customRoom);
    expect(alone.every((surface) => surface.customWallId === "w1")).toBe(true);

    // The loose 45 dropped just past the run end, at the 11-inch hold.
    const t = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    const forward = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
    const vertex = { x: 48 + 11, y: 0 };
    const backLeft = { x: vertex.x + t.x * 11, y: vertex.y + t.y * 11 };
    const center = {
      x: backLeft.x + t.x * 12 + forward.x * 12,
      y: backLeft.y + t.y * 12 + forward.y * 12,
    };
    const placed = [...run, loose45("a0", center)];

    // The chain never claims the custom-wall cabinets. The loose angled leg may
    // form its own single-body chain, but w0/w1 stay out of it.
    const members = [...freestandingChainMemberUids(placed, customRoom, null)];
    expect(members).not.toContain("w0");
    expect(members).not.toContain("w1");

    const surfaces = countertopSurfaces(placed, customRoom);
    // The Wall Builder's slab is untouched: still a custom-wall surface, still
    // named for its own run, never retagged as `freestanding:...`.
    const wallSlabs = surfaces.filter((surface) => surface.customWallId === "w1");
    expect(wallSlabs.length).toBeGreaterThan(0);
    expect(wallSlabs.some((surface) => surface.cabinetRunId?.startsWith("custom:w1"))).toBe(true);
    expect(surfaces.some((surface) => surface.cabinetRunId?.startsWith("freestanding:a0+w0+w1")
      || surface.cabinetRunId?.startsWith("freestanding:a0+w1"))).toBe(false);
    expect(surfaces.every((surface) => (surface.freestandingMemberUids ?? []).every((uid) => uid !== "w0" && uid !== "w1"))).toBe(true);
  });

  it("does not treat a peninsula cabinet as a chain anchor", () => {
    const peninsulaRoom: RoomData = {
      ...DEFAULT_ROOM,
      width: 200,
      depth: 200,
      peninsulaRuns: [{
        id: "pen1", parentWall: "top", startOffset: 96, turn: 0, direction: "right",
        length: 60, height: 34.5, cabinetSide: "left",
      }],
    } as RoomData;
    const pen: PlacedCabinet = {
      uid: "p0", cabinetId: 1, masterCode: "B24", description: "B", category: "Base",
      subCategory: "Standard Base", placement: "base", x: 96, y: 0, width: 24, depth: 24,
      height: 34.5, rotation: 0, wallId: "pen1", wallOffset: 0,
    } as PlacedCabinet;
    expect(isChainWallAnchor(pen, peninsulaRoom)).toBe(false);
    expect([...freestandingChainMemberUids([pen], peninsulaRoom, null)]).toEqual([]);
    // Its slab stays the peninsula's continuous run.
    expect(countertopSurfaces([pen], peninsulaRoom).every((surface) => surface.peninsulaRunId === "pen1")).toBe(true);
  });
});
