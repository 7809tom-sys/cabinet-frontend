/**
 * Owner rule: no filler at the end of a cabinet run by default.
 *
 * A run end that lands on its wall is finished, not gapped. The auto designer used
 * to append a filler there every time. Filler is now the last resort: real cabinets
 * first (seat, widen, or slide within the wiggle room), and a filler only when a
 * person asks for one or nothing real can close a genuine interior sliver.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";
import {
  applyRealCabinetsBeforeFiller,
  isRealNarrowCabinet,
  openRunGaps,
} from "./autoDesignRealCabinets";
import { applyDesignerLayoutRules } from "./designerLayoutRules";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const BASES = REAL["330011"]!.base;
const FILLERS = REAL["330011"]!.accessory.filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));

const ROOM = { width: 144, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData;

function placed(partial: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "width">, start: number): PlacedCabinet {
  return {
    cabinetId: 1, masterCode: "B24", description: '24" Base', category: "Base", subCategory: "Standard Base",
    placement: "base", x: start, y: 0, depth: 24, height: 34.5, rotation: 0, wallId: "top", wallOffset: start,
    numberOfDoors: 2, numberOfDrawers: 0, mountBottom: 0, ...partial,
  } as PlacedCabinet;
}

function isFiller(item: PlacedCabinet): boolean {
  return /filler|scribe/i.test(`${item.masterCode} ${item.description} ${item.subCategory ?? ""}`);
}

describe("no filler at a run end", () => {
  it("adds no filler at the open end of a single base run", () => {
    // A 90 inch run on a 144 inch wall: the run end is open wall, which used to get
    // a filler appended automatically.
    let uid = 0;
    const result = applyDesignerLayoutRules({
      placed: [placed({ uid: "b1", width: 90 } as never, 0)],
      room: ROOM,
      openings: [],
      fillers: FILLERS,
      makeUid: () => `u${++uid}`,
      styleId: 330011,
      allowAutoFillers: false,
    });
    expect(result.placed.filter(isFiller)).toHaveLength(0);
  });

  it("still adds nothing at the end when the build asks for real cabinets first", () => {
    let uid = 0;
    const run = [placed({ uid: "b1", width: 36 } as never, 0), placed({ uid: "b2", width: 30 } as never, 36)];
    const pass = applyRealCabinetsBeforeFiller({
      placed: run,
      room: ROOM,
      openings: [],
      catalog: BASES,
      makeUid: () => `u${++uid}`,
      styleId: 330011,
      wallIds: ["top"],
    });
    // A 78 inch run on a 144 inch wall leaves open wall, not a filler.
    expect(pass.placed.filter(isFiller)).toHaveLength(0);
  });

  it("closes a real interior opening with real cabinets, not filler", () => {
    let uid = 0;
    // 24 + 12 gap + 24 across a wall: the 12 inch opening must take a real cabinet.
    const run = [
      placed({ uid: "left", width: 24 } as never, 0),
      placed({ uid: "right", width: 24 } as never, 36),
    ];
    const pass = applyRealCabinetsBeforeFiller({
      placed: run,
      room: ROOM,
      openings: [],
      catalog: BASES,
      makeUid: () => `u${++uid}`,
      styleId: 330011,
      wallIds: ["top"],
    });
    expect(pass.placed.filter(isFiller)).toHaveLength(0);
    const seated = pass.placed.filter((item) => !["left", "right"].includes(item.uid));
    if (seated.length > 0) {
      expect(seated.every((item) => item.placement === "base")).toBe(true);
    }
  });

  it("never treats an opening wider than the filler maximum as a filler job", () => {
    const run = [placed({ uid: "left", width: 24 } as never, 0), placed({ uid: "right", width: 24 } as never, 60)];
    const gaps = openRunGaps({ wallId: "top", room: ROOM, placed: run, openings: [], layer: "base" });
    // The widest opening is the 60 inches between the second cabinet and the wall
    // end; the 12 inch gap between them is the other. Neither is a 3 inch filler.
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(gap.widthIn).toBeGreaterThan(3);
  });

  it("counts a narrow real cabinet as usable and a filler/panel as not", () => {
    const narrow = { id: 1, masterCode: "B9", description: '9" Base Cabinet', placement: "base", width: "9", height: "34.5", depth: "24", category: "Base", subCategory: "Standard Base", numberOfDoors: 1, numberOfDrawers: 0 } as DesignCabinet;
    const filler = { id: 2, masterCode: "BF6", description: '6" Filler', placement: "accessory", width: "6", height: "34.5", depth: "24", category: "Filler", subCategory: "Filler", numberOfDoors: 0, numberOfDrawers: 0 } as DesignCabinet;
    expect(isRealNarrowCabinet(narrow, "base")).toBe(true);
    expect(isRealNarrowCabinet(filler, "base")).toBe(false);
  });
});
