/**
 * Owner rule: a sink base keeps a real counter landing between itself and a tall
 * cabinet or refrigerator, and the basin is centered on its own base and set back
 * into the approved 2"–2½" band from the finished countertop front.
 *
 * Regression source: the 3D right run of a U-shaped kitchen. The sink base was the
 * last floor box of the run butted against a 90" pantry, so there was no landing
 * counter beside the basin, and the upper run on that side stopped short of the
 * base run under it.
 */
import { describe, expect, it } from "vitest";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import ovenRows from "./__fixtures__/ovenCabinetRows.json";
import { runAutoDesignLayout, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import {
  DEFAULT_ROOM,
  NON_APRON_SINK_FRONT_SETBACK,
  cabinetPlacementCollisionDetail,
  cabinetWall,
  makeDefaultSinkForCabinet,
  makeSinkForCabinet,
  placedFootprint,
  wallPlacementAt,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
  type WallSide,
} from "./design";
import {
  isSinkLandingBlocker,
  planSinkLandingSlides,
  sinkFrontSetbackIn,
  sinkLandingGaps,
  sinkSeatCheck,
  sinkTallLandingIn,
} from "./autoDesignSinkLanding";
import { kitchenRuleNumber, resetKitchenRuleParameters, setKitchenRuleParameters } from "./kitchenRuleParameters";
import { kitchenRuleDefinition } from "./kitchenRuleRegistry";

type Pack = { base: unknown[]; wall: unknown[]; accessory: unknown[] };
const REAL = realCatalog as unknown as Record<string, Pack>;
const STYLE = "330011";
const BASES = REAL[STYLE]!.base as DesignCabinet[];
const WALLS = REAL[STYLE]!.wall as DesignCabinet[];
const FILLERS = (REAL[STYLE]!.accessory as DesignCabinet[]).filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`));
const TALL = ovenRows as unknown as DesignCabinet[];

function baseCabinet(side: WallSide, start: number, width = 36, room: RoomData = DEFAULT_ROOM): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 24, side, room);
  return {
    uid: `sb-${side}-${start}`, cabinetId: 1, masterCode: `SB${width}`, description: "Sink Base",
    category: "Base", subCategory: "Sink Base", placement: "base",
    x: spot.x, y: spot.y, width, depth: 24, height: 34.5, rotation: spot.rotation,
    wallId: spot.wallId, wallOffset: spot.wallOffset,
  } as PlacedCabinet;
}

function tallCabinet(side: WallSide, start: number, width = 33, room: RoomData = DEFAULT_ROOM): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 24, side, room);
  return {
    uid: `tall-${side}-${start}`, cabinetId: 800, masterCode: "UOC3390(O339024)", description: "33x90 Oven Pantry",
    category: "Tall", subCategory: "Oven Tower", placement: "tall",
    x: spot.x, y: spot.y, width, depth: 24, height: 90, rotation: spot.rotation,
    wallId: spot.wallId, wallOffset: spot.wallOffset,
  } as PlacedCabinet;
}

function build(overrides: Partial<AutoDesignInputs> = {}, room: RoomData = { width: 168, depth: 132, ceilingHeight: 96, openWallPath: false } as RoomData): AutoDesignLayoutSuccess {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "u-shape",
      originCorner: "left",
      runDirection: "right",
      wallCabinetHeightIn: 30,
      sink: { wallLabel: "Wall 3", centerOffsetIn: 30 },
      sinkBaseWidthIn: 36,
      sinkBaseKind: "regular",
      stove: { wallLabel: "Wall 2", centerOffsetIn: 60 },
      skipDishwasher: true,
      dishwasher: null,
      refrigerator: null,
      tallCabinets: null,
      ...overrides,
    } as AutoDesignInputs,
    room,
    openings: [],
    baseCatalog: BASES,
    wallCatalog: WALLS,
    fillers: FILLERS,
    appliancePalette: [
      { id: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", width: "30", height: "36", depth: "25", placement: "appliance" } as DesignCabinet,
      { id: 0, masterCode: "DW-24", description: '24" Dishwasher', category: "Appliance", subCategory: "Appliance", width: "24", height: "34.5", depth: "24", placement: "appliance" } as DesignCabinet,
      { id: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator', category: "Appliance", subCategory: "Appliance", width: "36", height: "70", depth: "30", placement: "appliance" } as DesignCabinet,
    ],
    refrigeratorCaps: WALLS.filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
    refrigeratorEndPanels: (REAL[STYLE]!.accessory as DesignCabinet[]).filter((row) => /REPV|refrigerator end panel/i.test(`${row.masterCode} ${row.description}`)),
    tallCatalog: TALL,
    styleId: 330011,
    makeUid: () => `uid-${++uid}`,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

function sinkBaseOf(result: AutoDesignLayoutSuccess): PlacedCabinet {
  const row = result.placed.find((item) => item.placement === "base" && /^(?:SB|FSB)/.test(item.masterCode));
  if (!row) throw new Error("no sink base in the built kitchen");
  return row;
}

describe("the rule is a stored kitchen setting, not a hard-coded number", () => {
  it("registers the landing and the front setback with the approved ranges", () => {
    expect(kitchenRuleDefinition("sink_tall_landing_in")?.category).toBe("Sink and appliances");
    expect(kitchenRuleDefinition("sink_front_setback_in")).toMatchObject({ min: 2, max: 2.5 });
    resetKitchenRuleParameters();
    expect(sinkTallLandingIn()).toBe(18);
    expect(sinkFrontSetbackIn()).toBe(NON_APRON_SINK_FRONT_SETBACK.defaultIn);
    setKitchenRuleParameters({ sink_tall_landing_in: 24, sink_front_setback_in: 2.5 });
    expect(sinkTallLandingIn()).toBe(24);
    expect(sinkFrontSetbackIn()).toBe(2.5);
    resetKitchenRuleParameters();
  });

  it("clamps a stored setback into the approved 2\"–2½\" band instead of trusting it", () => {
    setKitchenRuleParameters({ sink_front_setback_in: 4 });
    expect(sinkFrontSetbackIn()).toBe(NON_APRON_SINK_FRONT_SETBACK.maximumIn);
    setKitchenRuleParameters({ sink_front_setback_in: 0.5 });
    expect(sinkFrontSetbackIn()).toBe(NON_APRON_SINK_FRONT_SETBACK.minimumIn);
    resetKitchenRuleParameters();
    expect(kitchenRuleNumber("sink_front_setback_in")).toBe(2);
  });
});

describe("sink landing against a tall unit", () => {
  it("names a sink base that butts a tall cabinet on the same run", () => {
    const room = { width: 168, depth: 132, ceilingHeight: 96 } as RoomData;
    const sink = baseCabinet("top", 60, 36, room);
    const pantry = tallCabinet("top", 96, 33, room);
    const gaps = sinkLandingGaps([sink, pantry], room, sinkTallLandingIn());
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ sinkCode: "SB36", blockerCode: "UOC3390(O339024)", wallId: "top", gapIn: 0, side: "end" });
  });

  it("stays quiet once a real landing cabinet stands in the gap", () => {
    const room = { width: 168, depth: 132, ceilingHeight: 96 } as RoomData;
    const sink = baseCabinet("top", 42, 36, room);
    const landing = {
      ...baseCabinet("top", 78, 24, room), uid: "landing", masterCode: "B24", description: "24 inch base cabinet",
      category: "Base", subCategory: "Base Cabinet",
    } as PlacedCabinet;
    const pantry = tallCabinet("top", 102, 33, room);
    expect(sinkLandingGaps([sink, landing, pantry], room, sinkTallLandingIn())).toEqual([]);
  });

  it("counts a refrigerator as a tall unit the basin needs landing from", () => {
    const room = { width: 168, depth: 132, ceilingHeight: 96 } as RoomData;
    const sink = baseCabinet("bottom", 12, 36, room);
    const fridge = {
      uid: "fridge", cabinetId: 0, masterCode: "FRIDGE-36", description: '36" Refrigerator',
      category: "Appliance", subCategory: "Appliance", placement: "appliance",
      ...wallPlacementAt(48, 36, 30, "bottom", room), width: 36, depth: 30, height: 70,
    } as PlacedCabinet;
    expect(isSinkLandingBlocker(fridge)).toBe(true);
    const gaps = sinkLandingGaps([sink, fridge], room, sinkTallLandingIn());
    expect(gaps.map((gap) => gap.blockerCode)).toEqual(["FRIDGE-36"]);
  });

  it("offers only legal slides: inside the sink cap, inside the run, and clear of everything", () => {
    const room = { width: 240, depth: 132, ceilingHeight: 96 } as RoomData;
    const sink = baseCabinet("top", 96, 36, room);
    const pantry = tallCabinet("top", 140, 33, room);
    // A 6 inch slide toward the open wall opens a 6 inch landing, not the 18 asked for,
    // so the only legal answer here is a slide of at least 18 away from the pantry.
    const slides = planSinkLandingSlides({ sink, placed: [sink, pantry], room, landingIn: 18, limitIn: 24 });
    expect(slides.length).toBeGreaterThan(0);
    for (const slide of slides) {
      expect(slide.deltaIn).toBeLessThan(0);
      expect(Math.abs(slide.deltaIn)).toBeLessThanOrEqual(24);
      const moved = { ...sink, wallOffset: slide.startIn };
      expect(cabinetPlacementCollisionDetail(moved, [pantry], room)).toBeNull();
      expect(sinkLandingGaps([moved, pantry], room, 18)).toEqual([]);
    }
  });

  it("offers nothing when the sink's own cap cannot open the landing", () => {
    const room = { width: 168, depth: 132, ceilingHeight: 96 } as RoomData;
    const sink = baseCabinet("top", 36, 36, room);
    const pantry = tallCabinet("top", 72, 33, room);
    // A 2 inch cap cannot move a 36 inch base far enough to open 18 inches.
    expect(planSinkLandingSlides({ sink, placed: [sink, pantry], room, landingIn: 18, limitIn: 2 })).toEqual([]);
  });
});

describe("the measured build keeps the landing", () => {
  const uoc = TALL.find((row) => row.masterCode === "UOC3390(O339024)")!;

  it("never leaves the sink base jammed against a tall pantry at the end of a run", () => {
    // The reported U: a sink near the end of Wall 3 and a 90" pantry picked for it.
    // (24 is a sink center this line cannot seat at all — the build refuses it on
    // every branch, before and after this rule — so it is not part of this check.)
    for (const sinkCenter of [18, 21, 30, 36, 48]) {
      const result = build({
        sink: { wallLabel: "Wall 3", centerOffsetIn: sinkCenter },
        tallCabinets: [{ cabinetId: uoc.id ?? 0, masterCode: "UOC3390" }],
      });
      const room = { width: 168, depth: 132, ceilingHeight: 96, openWallPath: false } as RoomData;
      expect(sinkLandingGaps(result.placed, room), `sink at ${sinkCenter}`).toEqual([]);
      const tall = result.placed.find((item) => item.placement === "tall");
      if (!tall) continue;
      // A tall box that could not keep the landing is named on the review list.
      const sink = sinkBaseOf(result);
      const wall = cabinetWall(sink, room);
      const sinkEnd = wallRunOffset(sink, wall, room) + wallRunSpan(sink, wall, room);
      if (cabinetWall(tall, room) === wall) {
        const tallStart = wallRunOffset(tall, wall, room);
        expect(Math.abs(tallStart - sinkEnd)).toBeGreaterThanOrEqual(sinkTallLandingIn() - 0.05);
      }
    }
  });

  it("keeps a real base cabinet (not filler) between the sink base and the tall unit", () => {
    const result = build({
      sink: { wallLabel: "Wall 3", centerOffsetIn: 30 },
      tallCabinets: [{ cabinetId: uoc.id ?? 0, masterCode: "UOC3390" }],
    });
    const room = { width: 168, depth: 132, ceilingHeight: 96, openWallPath: false } as RoomData;
    const sink = sinkBaseOf(result);
    const wall = cabinetWall(sink, room);
    const tall = result.placed.find((item) => item.placement === "tall" && cabinetWall(item, room) === wall);
    if (!tall) return;
    const sinkStart = wallRunOffset(sink, wall, room);
    const sinkEnd = sinkStart + wallRunSpan(sink, wall, room);
    const tallStart = wallRunOffset(tall, wall, room);
    const tallEnd = tallStart + wallRunSpan(tall, wall, room);
    const betweenStart = Math.min(sinkEnd, tallEnd);
    const betweenEnd = Math.max(sinkStart, tallStart);
    const landing = result.placed.filter((item) => cabinetWall(item, room) === wall
      && item.placement === "base"
      && !item.fillerPieceGroupId
      && !/filler|scribe/i.test(`${item.masterCode} ${item.description ?? ""}`)
      && wallRunOffset(item, wall, room) >= betweenStart - 0.05
      && wallRunOffset(item, wall, room) + wallRunSpan(item, wall, room) <= betweenEnd + 0.05);
    expect(landing.length).toBeGreaterThan(0);
    expect(landing.some((item) => item.width >= 15)).toBe(true);
  });

  it("names the drop instead of jamming the sink when no slide can open the landing", () => {
    // A 36" sink base with only 12" of run left before the wall end: the tall
    // pick cannot keep the landing and the basin cannot slide 2" far enough.
    const room = { width: 132, depth: 108, ceilingHeight: 96, openWallPath: false } as RoomData;
    const result = build({
      layoutType: "single-wall",
      sink: { wallLabel: "Wall 1", centerOffsetIn: 114 },
      stove: { wallLabel: "Wall 1", centerOffsetIn: 48 },
      tallCabinets: [{ cabinetId: uoc.id ?? 0, masterCode: "UOC3390" }],
    }, room);
    expect(sinkLandingGaps(result.placed, room)).toEqual([]);
    const tall = result.placed.find((item) => item.placement === "tall");
    const named = result.reviewFindings.find((finding) => /tall-cabinet-blocked|sink-landing-short/.test(finding.code));
    expect(tall || named).toBeTruthy();
    if (!tall) {
      expect(named!.detail).toMatch(/landing/i);
      expect(named!.severity).toBe("warning");
    }
  });
});

describe("the basin is centered on its base and set back from the counter front", () => {
  it("checks centering and the approved setback on every wall side", () => {
    const room = { width: 168, depth: 132, ceilingHeight: 96 } as RoomData;
    for (const side of ["top", "bottom", "left", "right"] as WallSide[]) {
      const base = baseCabinet(side, 24, 36, room);
      const top = 25.5;
      for (const setback of [2, 2.25, 2.5]) {
        const sink = makeSinkForCabinet("double", base, room, { width: 33, depth: 20 }, { frontSetbackIn: setback });
        const check = sinkSeatCheck(sink, base, room);
        expect(check, `${side} at ${setback}`).toMatchObject({ ok: true, owned: true, centerOffsetIn: 0, setbackIn: setback });
        // The front of the basin sits exactly the requested distance behind the top's front edge.
        const foot = placedFootprint(base);
        const frontDepth = side === "top" ? sink.y + sink.depth - base.y
          : side === "bottom" ? base.y + foot.d - sink.y
            : side === "left" ? sink.x + sink.width - base.x
              : base.x + foot.w - sink.x;
        expect(Math.round((top - frontDepth) * 100) / 100).toBeCloseTo(setback, 2);
      }
    }
  });

  it("rejects a basin that drifted off its base or outside the setback band", () => {
    const room = { width: 168, depth: 132, ceilingHeight: 96 } as RoomData;
    const base = baseCabinet("top", 24, 36, room);
    const sink = makeDefaultSinkForCabinet(base, room, "double");
    expect(sinkSeatCheck(sink, base, room).ok).toBe(true);
    // Off-center: a basin slid 2 inches along the run.
    const offCenter = { ...sink, x: sink.x + 2 };
    expect(sinkSeatCheck(offCenter, base, room).ok).toBe(false);
    // Setback outside the band.
    const flush = { ...sink, frontSetbackIn: 0.5 };
    expect(sinkSeatCheck(flush, base, room).ok).toBe(false);
    // Another base's fixture is not this base's basin.
    const other = baseCabinet("top", 96, 36, room);
    expect(sinkSeatCheck(sink, other, room).ok).toBe(false);
  });

  it("seats the built basin centered with the approved setback, and keeps the faucet on the deck", () => {
    for (const room of [
      { width: 168, depth: 132, ceilingHeight: 96, openWallPath: false } as RoomData,
      { width: 192, depth: 144, ceilingHeight: 96, openWallPath: false } as RoomData,
    ]) {
      for (const center of [30, 45, 60]) {
        const result = build({ sink: { wallLabel: "Wall 3", centerOffsetIn: center } }, room);
        const base = sinkBaseOf(result);
        const sink = result.sinks[0]!;
        const check = sinkSeatCheck(sink, base, room);
        expect(check, `${room.width}x${room.depth} at ${center}`).toMatchObject({ ok: true, owned: true });
        expect(check.setbackIn).toBeGreaterThanOrEqual(NON_APRON_SINK_FRONT_SETBACK.minimumIn);
        expect(check.setbackIn).toBeLessThanOrEqual(NON_APRON_SINK_FRONT_SETBACK.maximumIn);
        expect(sink.faucet).toBe(true);
      }
    }
  });

  it("applies the same seating after the sink base slides for its landing", () => {
    const result = build({
      sink: { wallLabel: "Wall 3", centerOffsetIn: 30 },
      tallCabinets: [{ cabinetId: TALL.find((row) => row.masterCode === "UOC3390(O339024)")!.id ?? 0, masterCode: "UOC3390" }],
    });
    const base = sinkBaseOf(result);
    const sink = result.sinks[0]!;
    const room = { width: 168, depth: 132, ceilingHeight: 96, openWallPath: false } as RoomData;
    const check = sinkSeatCheck(sink, base, room);
    expect(check.ok).toBe(true);
    expect(check.centerOffsetIn).toBeCloseTo(0, 3);
    expect(check.setbackIn).toBe(2);
  });
});
