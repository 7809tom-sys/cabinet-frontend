/**
 * Tom, Nov 20 2026, 4:39 PM CT: leftover space slides the run toward the inside
 * corner, so cabinets close up against the corner cabinet (or the corner) and the
 * leftover ends at the refrigerator or a free wall end — never between cabinets
 * and never at the corner.
 */
import { describe, expect, it } from "vitest";
import aero from "./__fixtures__/aeroSolsticeLive390019.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "./autoDesignLayout";
import { emptyAutoDesignIntake } from "./autoDesignFifteenRules";
import { slideRunsTowardInsideCorners } from "./autoDesignSlideRunsToCorner";
import {
  appliancesForRoom, applianceAsDesignCabinet, cabinetWall, isFillerItem,
  isRefrigerator, wallPlacementAt, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type RoomData,
} from "./design";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; tall?: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const pack = aero as unknown as Pack;
const ROOM = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
const EPS = 0.125;

function build() {
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType: "l-shape", originCorner: "left", runDirection: "right", wallCabinetHeightIn: 30, tallCabinets: null,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 }, refrigeratorWidthIn: 36,
      stove: { wallLabel: "Wall 1", centerOffsetIn: 75 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 70 }, sinkBaseWidthIn: 36, sinkBaseKind: "regular",
      dishwasherSide: "right", skipDishwasher: false, overRangeAnswer: "microwave-bridge",
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: {
        ...emptyAutoDesignIntake(), construction: "new", preferences: [], islandOrPeninsula: "none",
        canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true },
      },
    } as never,
    room: ROOM, openings: [], baseCatalog: pack.base, wallCatalog: pack.wall, fillers: pack.accessory,
    appliancePalette: appliancesForRoom("kitchen" as never).map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: pack.tall ?? [],
    panelCatalog: [...pack.accessory, ...(pack.surround?.endPanels ?? [])],
    styleId: 390019, makeUid: () => `m-${++uid}`,
  } as never) as unknown as { ok: boolean; message?: string; placed: PlacedCabinet[]; notes: string[] };
  if (!result.ok) throw new Error(result.message ?? "build failed");
  return result;
}

const isUpper = (p: PlacedCabinet) => p.placement === "wall" || (p.placement === "appliance" && (Number(p.mountBottom) || 0) > 30);

function row(placed: PlacedCabinet[], wall: string, upper: boolean) {
  return placed
    .filter((p) => cabinetWall(p, ROOM) === wall && (upper ? isUpper(p) || p.placement === "tall" : !isUpper(p)))
    .map((p) => ({ p, start: wallRunOffset(p, wall, ROOM), end: wallRunOffset(p, wall, ROOM) + wallRunSpan(p, wall, ROOM) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}



describe("standard L run slides leftover toward the fridge, not the inside corner", () => {
  const result = build();
  const base = row(result.placed, "top", false);
  const wall = row(result.placed, "top", true);
  const erb = result.placed.find((p) => /^ERB/i.test(p.masterCode));
  const dcw = result.placed.find((p) => /^DCW/i.test(p.masterCode));

  it("seats a corner cabinet on the base and upper at the inside corner", () => {
    expect(erb, "expected an ERB / lazy-Susan").toBeTruthy();
    expect(dcw, "expected a DCW").toBeTruthy();
  });

  it("closes the 12 ft base run against the corner cabinet, leftover not against it", () => {
    expect(erb, "expected an ERB / lazy-Susan").toBeTruthy();
    const erbStartOnTop = ROOM.width - 36;
    const neighbour = base.filter((e) => !isFillerItem(e.p) && !isRefrigerator(e.p) && Math.abs(e.end - erbStartOnTop) <= EPS);
    expect(neighbour.length, `nothing is closed up against the ERB at ${erbStartOnTop} (base ${base.map((e) => `${e.p.masterCode}@${e.start}-${e.end}`).join(", ")})`).toBeGreaterThan(0);
    for (const f of base.filter(({ p }) => isFillerItem(p))) {
      expect(f.start >= erbStartOnTop - EPS || Math.abs(f.end - erbStartOnTop) <= EPS, `${f.p.masterCode} at ${f.start}-${f.end} leftover sits against the ERB`).toBe(false);
    }
  });

  it("closes the 12 ft upper run against the corner cabinet, leftover not against it", () => {
    expect(dcw, "expected a DCW").toBeTruthy();
    const dcwStartOnTop = ROOM.width - 24;
    const neighbour = wall.filter((e) => !isFillerItem(e.p) && Math.abs(e.end - dcwStartOnTop) <= EPS);
    expect(neighbour.length, `nothing is closed up against the DCW at ${dcwStartOnTop} (wall ${wall.map((e) => `${e.p.masterCode}@${e.start}-${e.end}`).join(", ")})`).toBeGreaterThan(0);
    for (const f of wall.filter(({ p }) => isFillerItem(p))) {
      expect(f.start >= dcwStartOnTop - EPS || Math.abs(f.end - dcwStartOnTop) <= EPS, `${f.p.masterCode} at ${f.start}-${f.end} leftover sits against the DCW`).toBe(false);
    }
  });

});

describe("slideRunsTowardInsideCorners packs a gapped L toward the corner", () => {
  const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;
  const mk = (uid: string, masterCode: string, placement: PlacedCabinet["placement"], wallId: "top" | "right", along: number, width: number, depth: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet => {
    const spot = wallPlacementAt(along, width, depth, wallId, room);
    return {
      uid, cabinetId: 1, masterCode, description: masterCode, placement,
      width, depth, height: placement === "wall" ? 30 : 34.5, rotation: spot.rotation,
      x: spot.x, y: spot.y, wallId: spot.wallId ?? wallId, wallOffset: spot.wallOffset ?? along,
      mountBottom: placement === "wall" ? 54 : 0,
      ...extra,
    };
  };

  it("slides the trailing bases into the corner gap and leaves leftover at the fridge", () => {
    const placed = [
      mk("fridge", "FRIDGE-36", "appliance", "top", 0, 36, 24),
      mk("repv", "REPV2496", "tall", "top", 36, 0.75, 24, { height: 96 }),
      mk("b18", "B18", "base", "top", 36.75, 18, 24),
      mk("range", "RANGE-30", "appliance", "top", 54.75, 30, 24),
      mk("drawer", "3DB18", "base", "top", 84.75, 18, 24),
      // 5.25 in gap at 102.75–108, then the ERB's 36 in footprint on this wall
      mk("erb", "ERB36", "base", "right", 0, 36, 36, { cornerType: "easy-reach" }),
    ];
    const result = slideRunsTowardInsideCorners({
      placed, room, wallIds: ["top", "right"],
      rangeWiggleIn: () => 3,
      fillerCatalog: pack.accessory,
      styleId: 390019, makeUid: () => "f-1",
    });
    const top = result.placed
      .filter((p) => cabinetWall(p, room) === "top" && !isUpper(p))
      .map((p) => ({ p, start: wallRunOffset(p, "top", room), end: wallRunOffset(p, "top", room) + wallRunSpan(p, "top", room) }))
      .sort((a, b) => a.start - b.start);
    const drawer = top.find((e) => e.p.masterCode === "3DB18")!;
    const fridge = top.find((e) => e.p.masterCode === "FRIDGE-36")!;
    expect(drawer.end).toBeCloseTo(108, 1);
    const fillers = top.filter((e) => isFillerItem(e.p));
    expect(fillers.length).toBeGreaterThan(0);
    for (const f of fillers) {
      expect(f.start, "leftover should sit at the fridge end").toBeLessThan(fridge.end + 6);
      expect(f.end, "leftover should not sit against the ERB").toBeLessThan(100);
    }
    const gapAtCorner = 108 - drawer.end;
    expect(gapAtCorner).toBeLessThan(EPS);
    expect(result.notes.some((note) => /Slide to corner/.test(note))).toBe(true);
  });
});
