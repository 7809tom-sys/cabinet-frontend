import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/fourAnchorRealCatalog.json";
import {
  DEFAULT_ROOM, cabinetPlacementCollisionDetail, cabinetWall, wallPlacementAt, wallRunOffset, wallRunSpan,
  type DesignCabinet, type PlacedCabinet, type WallOpening,
} from "./design";
import { seatFourAnchorCorner } from "./fourAnchorCornerSeating";
import { buildFourAnchorWallCabinets } from "./fourAnchorWallCabinets";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const rows = (style: string, kind: "base" | "wall" | "accessory") => REAL[style]![kind] as DesignCabinet[];
const fillers = (style: string) => rows(style, "accessory").filter((row) => /filler/i.test(`${row.masterCode} ${row.description}`)) as never[];
const STYLES = [{ id: "330011", name: "framed" }, { id: "540005", name: "frameless" }] as const;
const TOP_RIGHT = { x: DEFAULT_ROOM.width, y: 0, firstWallId: "top" };
let uidCounter = 0;
const uids = () => () => `k-${++uidCounter}`;

function lower(masterCode: string, width: number, offset: number, kind: "base" | "appliance" = "base", subCategory = "Base Cabinet"): PlacedCabinet {
  const spot = wallPlacementAt(offset, width, 24, "top", DEFAULT_ROOM);
  return {
    uid: `low-${masterCode}-${offset}`, cabinetId: kind === "appliance" ? 0 : 1, masterCode,
    description: masterCode.startsWith("SB") ? `${width}" Sink Base` : kind === "appliance" ? "Kitchen appliance" : "Base Cabinet",
    category: kind === "appliance" ? "Appliance" : "Base", subCategory, placement: kind, ...spot,
    width, depth: 24, height: 34.5, numberOfDoors: 2, numberOfDrawers: 0,
  } as PlacedCabinet;
}
const wallStage = (style: string, placed: PlacedCabinet[], openings: WallOpening[] = [], corners?: Parameters<typeof buildFourAnchorWallCabinets>[0]["corners"]) =>
  buildFourAnchorWallCabinets({
    placed, room: DEFAULT_ROOM, openings, catalog: rows(style, "wall"), wallCabinetHeightIn: 30, styleId: Number(style),
    makeUid: uids(), corners, catalogFillers: fillers(style),
  });
const span = (item: PlacedCabinet) => {
  const wall = cabinetWall(item, DEFAULT_ROOM);
  const start = wallRunOffset(item, wall, DEFAULT_ROOM);
  return { wall, start, end: start + wallRunSpan(item, wall, DEFAULT_ROOM) };
};

describe.each(STYLES)("Four-anchor rule: nothing above the sink ($name line)", ({ id }) => {
  it("never puts an upper over a sink base, but still covers the neighboring dishwasher and base", () => {
    const sink = lower("SB36", 36, 42, "base", "Sink Base");
    const dw = lower("DW-24", 24, 78, "appliance");
    const b18 = lower("B18", 18, 24);
    const result = wallStage(id, [b18, sink, dw]);
    const over = result.additions.filter((item) => { const s = span(item); return s.wall === "top" && s.end > 42 + 0.01 && s.start < 78 - 0.01; });
    expect(over.map((item) => item.masterCode)).toEqual([]);
    expect(result.additions.some((item) => { const s = span(item); return s.wall === "top" && Math.abs(s.start - 78) < 0.01 && Math.abs(s.end - 102) < 0.01; })).toBe(true);
    expect(result.additions.some((item) => { const s = span(item); return s.wall === "top" && s.start >= 24 - 0.01 && s.end <= 42 + 0.01; })).toBe(true);
  });

  it("treats a farmhouse sink base the same way", () => {
    const farm = { ...lower("FSB36", 36, 42, "base", "Sink Base"), description: '36" Farmhouse Sink Base' };
    const result = wallStage(id, [farm]);
    expect(result.additions.filter((item) => span(item).wall === "top")).toEqual([]);
  });
});

describe.each(STYLES)("Four-anchor rule: a measured window over the sink ($name line)", ({ id }) => {
  const sink = lower("SB36", 36, 42, "base", "Sink Base");
  const dw = lower("DW-24", 24, 78, "appliance");
  const windowOverSink: WallOpening = { uid: "w1", kind: "window", label: "Over-Sink Window", side: "top", offset: 42, width: 36, height: 48, sill: 42 };

  it("keeps the wall above the sink clear and starts the next upper exactly 3 inches past the window", () => {
    const result = wallStage(id, [sink, dw], [windowOverSink]);
    const near = result.additions.filter((item) => { const s = span(item); return s.wall === "top" && s.end > 42 && s.start < 102; });
    expect(near).toHaveLength(1);
    const s = span(near[0]!);
    // Window ends at 78; clearance is 3", so the dishwasher's upper covers the clear remainder 81..102.
    expect(s.start).toBeCloseTo(81, 3);
    expect(s.end).toBeCloseTo(102, 3);
    expect(near[0]!.width).toBe(21);
    expect(near[0]!.masterCode).toMatch(/^W2130/);
  });

  it("leaves every addition collision-free", () => {
    const result = wallStage(id, [sink, dw], [windowOverSink]);
    for (const item of result.additions) {
      expect(cabinetPlacementCollisionDetail(item, result.placed.filter((other) => other.uid !== item.uid), DEFAULT_ROOM)).toBeNull();
    }
  });
});

describe.each(STYLES)("Four-anchor rule: a 12-inch wall cabinet in the corner ($name line)", ({ id }) => {
  const baseSource = (code: RegExp) => rows(id, "base").find((row) => code.test(row.masterCode) && Number(row.width) === 36)
    ?? rows(id, "base").find((row) => code.test(row.masterCode))!;
  const seatBlind = () => {
    const seated = seatFourAnchorCorner({
      source: baseSource(/^BBC/), slotLabel: "Corner between Wall 1 and Wall 2", target: TOP_RIGHT, cornerWallIds: ["top", "right"],
      working: [], room: DEFAULT_ROOM, openings: [], blindPullIn: 4, isBlindOption: true, catalogFillers: fillers(id), makeUid: uids(), styleId: Number(id),
    });
    expect(seated.ok).toBe(true);
    if (!seated.ok) throw new Error("corner did not seat");
    return seated;
  };

  it("seats a 12-inch-wide standard upper in the corner square instead of a wall blind corner", () => {
    const seated = seatBlind();
    const result = wallStage(id, seated.placed, [], [{ base: seated.corner, point: TOP_RIGHT }]);
    const corner = result.additions.find((item) => item.width === 12 && /^W12/.test(item.masterCode));
    expect(corner, `skipped: ${result.skipped.join(" | ")}`).toBeDefined();
    expect(result.additions.some((item) => /^WBC|^WSC|BFF|OF6/.test(item.masterCode) && /blind|WBC/i.test(`${item.masterCode} ${item.description}`))).toBe(false);
    // Flush in the room corner: its back is on one wall and its side touches the other.
    const c = corner!;
    expect(Math.round((c.x + (c.rotation % 180 === 0 ? c.width : c.depth)) * 100) / 100).toBeLessThanOrEqual(DEFAULT_ROOM.width + 0.01);
    expect(c.x).toBeGreaterThanOrEqual(DEFAULT_ROOM.width - 13.6);
    expect(c.y).toBeGreaterThanOrEqual(-0.01);
    expect(c.y).toBeLessThanOrEqual(0.5);
  });

  it("covers the rest of the blind base's run next to the 12-inch corner box, with no overhang or collision", () => {
    const seated = seatBlind();
    const result = wallStage(id, seated.placed, [], [{ base: seated.corner, point: TOP_RIGHT }]);
    const baseWall = cabinetWall(seated.corner, DEFAULT_ROOM);
    const baseSpan = span(seated.corner);
    const run = result.additions.filter((item) => span(item).wall === baseWall);
    const first = run.map((item) => span(item).start).sort((a, b) => a - b)[0]!;
    const last = run.map((item) => span(item).end).sort((a, b) => b - a)[0]!;
    // The run starts in the corner (0), is gap-free, and ends within one 3-inch step of the blind base's far end.
    expect(first).toBeCloseTo(0, 3);
    expect(last).toBeLessThanOrEqual(baseSpan.end + 0.01);
    expect(last).toBeGreaterThanOrEqual(baseSpan.end - 3.01);
    const sorted = [...run].sort((a, b) => span(a).start - span(b).start);
    for (let index = 1; index < sorted.length; index++) {
      expect(span(sorted[index]!).start).toBeCloseTo(span(sorted[index - 1]!).end, 3);
    }
    for (const item of result.additions) {
      expect(cabinetPlacementCollisionDetail(item, result.placed.filter((other) => other.uid !== item.uid), DEFAULT_ROOM)).toBeNull();
    }
  });

  it("falls back to a real wall blind corner only when the line sells no 12-inch upper", () => {
    const seated = seatBlind();
    const withoutTwelve = rows(id, "wall").filter((row) => !(Math.abs(Number(row.width) - 12) <= 0.01 && /^W12/.test(row.masterCode)));
    const result = buildFourAnchorWallCabinets({
      placed: seated.placed, room: DEFAULT_ROOM, openings: [], catalog: withoutTwelve, wallCabinetHeightIn: 30, styleId: Number(id),
      makeUid: uids(), corners: [{ base: seated.corner, point: TOP_RIGHT }], catalogFillers: fillers(id),
    });
    expect(result.additions.some((item) => item.width === 12 && /^W12/.test(item.masterCode))).toBe(false);
    expect(result.additions.length).toBeGreaterThan(0);
  });
});

const TOP_LEFT = { x: 0, y: 0, firstWallId: "top" };
describe.each(STYLES)("Four-anchor rule: a 12-inch wall cabinet on each side of the wall corner cabinet ($name line)", ({ id }) => {
  const seatLazySusan = () => {
    const source = rows(id, "base").find((row) => /^LSB36$/.test(row.masterCode))!;
    const seated = seatFourAnchorCorner({
      source, slotLabel: "Corner between Wall 1 and Wall 4", target: TOP_LEFT, cornerWallIds: ["top", "left"],
      working: [], room: DEFAULT_ROOM, openings: [], isBlindOption: false, catalogFillers: fillers(id), makeUid: uids(), styleId: Number(id),
    });
    expect(seated.ok, seated.ok ? "" : seated.message).toBe(true);
    if (!seated.ok) throw new Error("corner did not seat");
    return seated;
  };
  const cornerUpper = (result: ReturnType<typeof wallStage>) => result.additions.find((item) => item.width === 24 && /^(DCW|WDC|WER)/.test(item.masterCode));
  it("seats the corner upper at the vertex and puts a 12-inch upper beside it on BOTH walls", () => {
    const seated = seatLazySusan();
    const result = wallStage(id, seated.placed, [], [{ base: seated.corner, point: TOP_LEFT }]);
    const corner = cornerUpper(result);
    expect(corner, `skipped: ${result.skipped.join(" | ")}`).toBeDefined();
    const flanks = result.additions.filter((item) => item.width === 12 && /^W12/.test(item.masterCode));
    const along = (wall: string) => flanks.map(span).filter((s) => s.wall === wall).sort((a, b) => a.start - b.start);
    // The 24-inch corner upper covers 0-24 on each wall; the 36-inch corner base leaves exactly 12 inches on each wall.
    expect(along("top").map((s) => [Math.round(s.start * 100) / 100, Math.round(s.end * 100) / 100])).toContainEqual([24, 36]);
    expect(along("left").map((s) => [Math.round(s.start * 100) / 100, Math.round(s.end * 100) / 100])).toContainEqual([24, 36]);
  });
  it("keeps the rest of the run intact, gap-free and collision-free next to the 12-inch uppers", () => {
    const seated = seatLazySusan();
    const next = lower("B36", 36, 36);
    const result = wallStage(id, [...seated.placed, next], [], [{ base: seated.corner, point: TOP_LEFT }]);
    const top = result.additions.filter((item) => span(item).wall === "top").sort((a, b) => span(a).start - span(b).start);
    expect(span(top[0]!).start).toBeCloseTo(0, 3);
    for (let index = 1; index < top.length; index++) expect(span(top[index]!).start).toBeCloseTo(span(top[index - 1]!).end, 3);
    expect(span(top[top.length - 1]!).end).toBeGreaterThanOrEqual(72 - 0.01);
    for (const item of result.additions) {
      expect(cabinetPlacementCollisionDetail(item, result.placed.filter((other) => other.uid !== item.uid), DEFAULT_ROOM)).toBeNull();
    }
  });
  it("does not add a 12-inch box that would overhang the corner base's span (a 9-inch gap stays a seam)", () => {
    const seated = seatLazySusan();
    const narrow = { ...seated.corner, width: 33 };
    const placed = seated.placed.map((item) => (item.uid === seated.corner.uid ? narrow : item));
    const result = wallStage(id, placed, [], [{ base: narrow, point: TOP_LEFT }]);
    const flanksBeyond = result.additions.filter((item) => item.width === 12 && span(item).start >= 24 - 0.01 && span(item).end > 33 + 0.01);
    expect(flanksBeyond).toEqual([]);
  });
});
