import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignMatrixCatalog.json";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps, type AutoDesignLayoutSuccess } from "./autoDesignLayout";
import type { AutoDesignInputs } from "./autoDesignAutoBuild";
import { isPlacedCornerCabinet } from "./autoDesignCornerGuard";
import {
  applianceAsDesignCabinet,
  cabinetWall,
  freeSegmentsOnWall,
  placedFootprint,
  wallRunOffset,
  wallRunSpan,
  type DesignCabinet,
  type PlacedCabinet,
  type RoomData,
} from "./design";

/**
 * Owner report (Tom, Nov 6 2026): an L kitchen came out with the inside base
 * corner empty. The back wall held the refrigerator, base cabinets and the
 * range; the right wall held the sink base, the dishwasher and base cabinets,
 * and the corner where the two runs meet had nothing in it.
 *
 * Three defects produced that:
 *
 *  1. `absorbOpenBaseGaps` widened the seated corner into a plain `B42`. Its
 *     family filter was `/^([A-Z]+)/` on the neighbour code, so `LSB36` became
 *     family `LSB`… but the widen candidate came from the whole catalog, and a
 *     `B42` matched through the short `B` stem. The copied L-corner footprint on
 *     the wider body then overran the room and the final bounds gate deleted it.
 *  2. `evaluateAutoDesignCornerFit` counted the over-sink WINDOW as blocking the
 *     base leg, cutting the sink run short at the window's near edge, so every
 *     corner cabinet was rejected on the plumbing wall.
 *  3. That same measurement added a 3 inch appliance slack the seater never
 *     honours, so a leg read as fitting and then failed to seat.
 *
 * A corner that still cannot fit now raises a named review finding instead of
 * leaving the corner bare in silence.
 */

type StylePack = {
  name: string;
  base: DesignCabinet[];
  wall: DesignCabinet[];
  accessory: DesignCabinet[];
  surround: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] };
};

const matrix = catalogFixture as unknown as Record<string, StylePack>;
const REAL = realCatalog as unknown as Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;

function appliance(code: string, width: number, depth: number, height: number): DesignCabinet {
  return {
    id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance",
    width: String(width), depth: String(depth), height: String(height), placement: "appliance",
  } as DesignCabinet;
}

const PALETTE = [
  appliance("RANGE-30", 30, 25, 36),
  appliance("DW-24", 24, 24, 34.5),
  appliance("FRIDGE-36", 36, 30, 70),
  appliance("HOOD-30", 30, 18, 18),
];

function roomOf(width: number, depth: number): RoomData {
  return { width, depth, ceilingHeight: 96 };
}

/**
 * The screenshot plan: the back wall (Wall 1) carries the refrigerator, base
 * cabinets and the range with a clear leg at the corner; the right wall
 * (Wall 2) carries the sink base under its window, then the dishwasher, then
 * base cabinets.
 */
function screenshotInput(overrides: Partial<AutoDesignInputs> = {}): AutoDesignInputs {
  return {
    layoutType: "l-shape",
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 22 },
    stove: { wallLabel: "Wall 1", centerOffsetIn: 87 },
    sink: { wallLabel: "Wall 2", centerOffsetIn: 60 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    dishwasherSide: "right",
    sinkWindowCenter: { wallLabel: "Wall 2", centerOffsetIn: 60 },
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    ...overrides,
  };
}

function build(styleId: string, room: RoomData, input: AutoDesignInputs): AutoDesignLayoutSuccess | { ok: false; message: string } {
  const pack = matrix[styleId];
  if (!pack) throw new Error(`matrix fixture is missing style ${styleId}`);
  let uid = 0;
  return runAutoDesignLayout({
    input,
    room,
    openings: [],
    baseCatalog: pack.base,
    wallCatalog: pack.wall,
    fillers: pack.accessory,
    appliancePalette: PALETTE.map(applianceAsDesignCabinet),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround.endPanels ?? [],
    tallCatalog: [],
    styleId: Number(styleId),
    makeUid: () => `t-${++uid}`,
  });
}

/**
 * The inside corner of the default room is the top-right vertex. A blind corner
 * legitimately sits up to its 6 inch pull off that vertex, so the gap to the
 * vertex is measured rather than assumed to be zero.
 */
function ownsTheCorner(item: PlacedCabinet, room: RoomData): boolean {
  if (!isPlacedCornerCabinet(item)) return false;
  const foot = placedFootprint(item);
  const dx = Math.max(0, room.width - (item.x + foot.w), item.x - room.width);
  const dy = Math.max(0, -(item.y + foot.d), item.y);
  return dx <= 6.5 && dy <= 6.5;
}

function cornerCabinets(placed: readonly PlacedCabinet[], room: RoomData): PlacedCabinet[] {
  return placed.filter((item) => (item.placement === "base" || item.placement === "tall") && ownsTheCorner(item, room));
}

function describeBaseRun(placed: readonly PlacedCabinet[], room: RoomData): string {
  return placed
    .filter((item) => item.placement === "base" || item.placement === "tall")
    .map((item) => {
      const wall = cabinetWall(item, room);
      const start = wallRunOffset(item, wall, room);
      return `${item.masterCode}@${wall}:${start.toFixed(1)}-${(start + wallRunSpan(item, wall, room)).toFixed(1)}`;
    })
    .join(", ");
}

function freeAtCorner(placed: readonly PlacedCabinet[], room: RoomData): { back: number; right: number } {
  const rightSegments = freeSegmentsOnWall("right", room, [...placed], [], 1, 0, "base", false);
  const backSegments = freeSegmentsOnWall("top", room, [...placed], [], 1, 0, "base", false);
  const right = rightSegments.find((segment) => segment.start <= 0.5)?.length ?? 0;
  const back = backSegments.find((segment) => Math.abs(segment.start + segment.length - room.width) <= 0.5)?.length ?? 0;
  return { back, right };
}

/** The styles the shared matrix fixture carries, which between them sell blind, lazy Susan and diagonal corners. */
const STYLES = ["330014", "330020", "510004", "330002", "540005", "540007", "540029"] as const;

describe("Auto-Design seats a corner cabinet in the inside base corner of an L", () => {
  it.each(STYLES)("%s puts a real corner cabinet in the inside corner of the screenshot plan", (styleId) => {
    const room = roomOf(144, 120);
    const result = build(styleId, room, screenshotInput());
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;

    const corners = cornerCabinets(result.placed, room);
    expect(corners, `inside corner is empty. Bases: ${describeBaseRun(result.placed, room)}`).toHaveLength(1);
    expect(result.seatedCorners, "the corner stage reported no seated corner").toHaveLength(1);

    // The corner the stage reported and the corner on the finished plan are the
    // same cabinet. A later pass swapping it is exactly the reported bug.
    expect(corners[0]!.masterCode).toBe(result.seatedCorners[0]!.masterCode);
  });

  it("places the 42 inch blind base in the inside corner when it is the corner the line fits", () => {
    // The shared real-catalog line 330011 sells a 36 inch blind base and a real
    // 3 inch filler. Here its blind base is swapped for the 42 inch one the owner
    // names, so the only blind corner the line sells is 42 inches.
    const pack = REAL["330011"]!;
    const bases = (pack.base as DesignCabinet[]).map((row) => (row.masterCode === "BBC36"
      ? { ...row, masterCode: "BBC42", width: "42", description: '42" Blind Corner Base Cabinet' }
      : row));
    const room = roomOf(144, 120);
    let uid = 0;
    const result = runAutoDesignLayout({
      input: screenshotInput({
        stove: { wallLabel: "Wall 1", centerOffsetIn: 72 },
        sink: { wallLabel: "Wall 2", centerOffsetIn: 48 },
        sinkWindowCenter: { wallLabel: "Wall 2", centerOffsetIn: 48 },
      }),
      room,
      openings: [],
      baseCatalog: bases,
      wallCatalog: pack.wall as DesignCabinet[],
      fillers: pack.accessory as DesignCabinet[],
      appliancePalette: PALETTE.map(applianceAsDesignCabinet),
      refrigeratorCaps: (pack.wall as DesignCabinet[]).filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
      refrigeratorEndPanels: (pack.accessory as DesignCabinet[]).filter((row) => /REPV|end panel/i.test(`${row.masterCode} ${row.description}`)),
      styleId: 330011,
      makeUid: () => `b-${++uid}`,
    });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;

    // The 42 inch blind base (the owner's B42) is both reported seated and
    // physically present in the inside corner.
    expect(result.seatedCorners.map((entry) => entry.masterCode)).toEqual(["BBC42"]);
    const corner = cornerCabinets(result.placed, room)[0];
    expect(corner, `inside corner is empty. Bases: ${describeBaseRun(result.placed, room)}`).toBeTruthy();
    expect(corner!.masterCode).toBe("BBC42");
    expect(corner!.width).toBeCloseTo(42, 1);
    const wall = cabinetWall(corner!, room);
    const end = wallRunOffset(corner!, wall, room) + wallRunSpan(corner!, wall, room);
    // A blind base is seated at the vertex and then pulled by its configured
    // blind pull (6" at most), so its body ends within that pull of the corner.
    expect(room.width - end).toBeGreaterThanOrEqual(-0.05);
    expect(room.width - end).toBeLessThanOrEqual(6.05);
  });

  it("never leaves a straight base standing in the corner instead of the corner cabinet", () => {
    const room = roomOf(144, 120);
    const result = build("330014", room, screenshotInput());
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    // A plain `B##` straight base can never be the only thing at the inside corner.
    const plainBasesAtCorner = result.placed.filter((item) => item.placement === "base"
      && /^B-?\d+$/.test(item.masterCode)
      && ownsTheCorner(item, room));
    expect(plainBasesAtCorner.map((item) => item.masterCode)).toEqual([]);
  });

  it("keeps the sink base, its faucet and the over-range bridge while seating the corner", () => {
    const room = roomOf(144, 120);
    const result = build("330014", room, screenshotInput());
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;

    // The sink never moves to make the corner fit.
    const sinkBase = result.placed.find((item) => item.placement === "base" && /^SB\d/.test(item.masterCode));
    expect(sinkBase, "sink base missing").toBeTruthy();
    const sinkStart = wallRunOffset(sinkBase!, cabinetWall(sinkBase!, room), room);
    expect(sinkStart).toBeCloseTo(42, 1);
    expect(result.sinks).toHaveLength(1);
    expect(result.everySinkHasFaucet, "the mandatory faucet is missing").toBe(true);
    // The window never moves.
    expect(result.sinkWindow, "the sink window was dropped").toBeTruthy();
    expect(result.sinkWindow!.offset).toBeCloseTo(42, 1);
    // The bridge over the range is always placed.
    expect(result.placed.some((item) => item.overRangeMicrowaveBridge === true || /^W3\d{2,}/.test(item.masterCode) && item.placement === "wall" && Math.abs((item.wallOffset ?? 0) - 87) < 20)).toBe(true);
    expect(result.notes.some((note) => /bridge was placed above RANGE-30/.test(note))).toBe(true);
  });

  it("names the shortfall when the corner genuinely cannot take a corner cabinet", () => {
    // The range ends only 9 inches from the corner: no corner box and no legal
    // 3 inch nudge can open the leg. The build must say so, not go quiet.
    const room = roomOf(144, 120);
    const result = build("330014", room, screenshotInput({
      stove: { wallLabel: "Wall 1", centerOffsetIn: 120 },
      sink: { wallLabel: "Wall 2", centerOffsetIn: 60 },
      sinkWindowCenter: { wallLabel: "Wall 2", centerOffsetIn: 60 },
    }));
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;

    expect(cornerCabinets(result.placed, room)).toHaveLength(0);
    const finding = result.reviewFindings.find((entry) => entry.code === "corner-cabinet-not-seated");
    expect(finding, `no corner finding. Findings: ${result.reviewFindings.map((entry) => entry.code).join(", ")}`).toBeTruthy();
    expect(finding!.severity).toBe("warning");
    expect(finding!.title).toMatch(/Corner between Wall 1 and Wall 2/);
    // The message says which cabinet was tried and what is in the way.
    expect(finding!.detail).toMatch(/range|too close|slide/i);
    expect(result.notes.some((note) => /cannot fit at Corner between Wall 1 and Wall 2/.test(note))).toBe(true);
  });

  it("reports a corner cabinet removed by the bounds gate instead of dropping it silently", () => {
    // A 60 inch blind base cannot fit a 120 inch wall beside the sink run; the
    // build must not simply delete it and leave the corner bare.
    const room = roomOf(144, 120);
    const oversized = matrix["330014"]!.base.map((row) => (row.masterCode === "BBC42"
      ? { ...row, masterCode: "BBC60", width: "60", description: '60" Blind Corner Base Cabinet' }
      : row));
    let uid = 0;
    const result = runAutoDesignLayout({
      input: screenshotInput(),
      room,
      openings: [],
      baseCatalog: oversized,
      wallCatalog: matrix["330014"]!.wall,
      fillers: matrix["330014"]!.accessory,
      appliancePalette: PALETTE.map(applianceAsDesignCabinet),
      refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(matrix["330014"]!.wall, matrix["330014"]!.surround.deepAbove ?? []),
      refrigeratorEndPanels: matrix["330014"]!.surround.endPanels ?? [],
      styleId: 330014,
      makeUid: () => `t-${++uid}`,
    });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    // Whatever this line allows, the corner is accounted for: either a corner
    // cabinet is there, or the review list names why it is not.
    const hasCorner = cornerCabinets(result.placed, room).length > 0;
    const named = result.reviewFindings.some((entry) => entry.code === "corner-cabinet-not-seated" || entry.code === "corner-cabinet-dropped");
    expect(hasCorner || named, `corner is empty and unnamed. Bases: ${describeBaseRun(result.placed, room)}`).toBe(true);
  });

  it("leaves no open inside corner across a sweep of L measurements", () => {
    const cases: Array<{ room: [number, number]; sink: number; range: number }> = [
      { room: [144, 120], sink: 60, range: 87 },
      { room: [144, 120], sink: 72, range: 87 },
      { room: [168, 132], sink: 60, range: 99 },
      { room: [168, 132], sink: 72, range: 111 },
      { room: [150, 150], sink: 66, range: 105 },
      { room: [180, 120], sink: 60, range: 123 },
    ];
    const failures: string[] = [];
    for (const entry of cases) {
      const room = roomOf(entry.room[0], entry.room[1]);
      const result = build("330014", room, screenshotInput({
        stove: { wallLabel: "Wall 1", centerOffsetIn: entry.range },
        sink: { wallLabel: "Wall 2", centerOffsetIn: entry.sink },
        sinkWindowCenter: { wallLabel: "Wall 2", centerOffsetIn: entry.sink },
      }));
      const tag = `${entry.room[0]}x${entry.room[1]} sink=${entry.sink} range=${entry.range}`;
      if (!result.ok) { failures.push(`${tag}: build failed: ${result.message}`); continue; }
      if (cornerCabinets(result.placed, room).length === 0) {
        const free = freeAtCorner(result.placed, room);
        const named = result.reviewFindings.some((finding) => finding.code === "corner-cabinet-not-seated" || finding.code === "corner-cabinet-dropped");
        // Either a corner is seated, or the empty corner is explained.
        if (!named) {
          failures.push(`${tag}: no corner cabinet and no warning (${free.right}″ right / ${free.back}″ back free)`);
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});

describe("the shared real-catalog line still gets its corner", () => {
  it("keeps the 330011 corner cabinet the matrix reports in the inside corner", () => {
    const pack = REAL["330011"]!;
    const room = roomOf(168, 132);
    let uid = 0;
    const result = runAutoDesignLayout({
      input: screenshotInput({
        stove: { wallLabel: "Wall 1", centerOffsetIn: 111 },
        sink: { wallLabel: "Wall 2", centerOffsetIn: 69 },
        sinkWindowCenter: { wallLabel: "Wall 2", centerOffsetIn: 69 },
      }),
      room,
      openings: [],
      baseCatalog: pack.base as DesignCabinet[],
      wallCatalog: pack.wall as DesignCabinet[],
      fillers: pack.accessory as DesignCabinet[],
      appliancePalette: PALETTE.map(applianceAsDesignCabinet),
      refrigeratorCaps: (pack.wall as DesignCabinet[]).filter((row) => Number(row.width) === 36 && Number(row.depth) >= 20),
      refrigeratorEndPanels: (pack.accessory as DesignCabinet[]).filter((row) => /REPV|end panel/i.test(`${row.masterCode} ${row.description}`)),
      styleId: 330011,
      makeUid: () => `r-${++uid}`,
    });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(cornerCabinets(result.placed, room), `inside corner is empty. Bases: ${describeBaseRun(result.placed, room)}`).toHaveLength(1);
  });
});
