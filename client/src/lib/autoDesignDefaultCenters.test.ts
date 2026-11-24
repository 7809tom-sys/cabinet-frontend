import { describe, expect, it } from "vitest";
import { adjacentDishwasherCenterIn, wallLabelToEngineWallId, type AutoDesignLayoutType, type WallLabel } from "./autoDesignAutoBuild";
import { AUTO_DESIGN_DEFAULT_CORNER_CLEAR_IN, autoDesignDefaultCenters, type AutoDesignDefaultCentersInput } from "./autoDesignDefaultCenters";
import { DEFAULT_ROOM, type RoomData } from "./design";

const LAYOUTS: AutoDesignLayoutType[] = ["single-wall", "galley", "l-shape", "u-shape"];
const base = (overrides: Partial<AutoDesignDefaultCentersInput> = {}): AutoDesignDefaultCentersInput => ({
  room: DEFAULT_ROOM, layoutType: "single-wall", originCorner: "left", runDirection: "right", wallCount: 4,
  sinkBaseWidthIn: 36, dishwasherSide: "right", includeStove: true, includeRefrigerator: true, refrigeratorWidthIn: 36,
  ...overrides,
});

type Span = { kind: string; wall: WallLabel; start: number; end: number };
/** Every floor span the starting centers produce, in measurement space (the dialog's own numbers). */
function spans(input: AutoDesignDefaultCentersInput): Span[] {
  const result = autoDesignDefaultCenters(input);
  const out: Span[] = [{ kind: "sink", wall: result.sink.wallLabel, start: result.sink.centerOffsetIn - input.sinkBaseWidthIn / 2, end: result.sink.centerOffsetIn + input.sinkBaseWidthIn / 2 }];
  if (input.dishwasherSide !== "none") {
    const center = adjacentDishwasherCenterIn(result.sink.centerOffsetIn, input.sinkBaseWidthIn, 24, input.dishwasherSide);
    out.push({ kind: "dishwasher", wall: result.sink.wallLabel, start: center - 12, end: center + 12 });
  }
  if (result.stove) out.push({ kind: "stove", wall: result.stove.wallLabel, start: result.stove.centerOffsetIn - 15, end: result.stove.centerOffsetIn + 15 });
  if (result.refrigerator) out.push({ kind: "refrigerator", wall: result.refrigerator.wallLabel, start: result.refrigerator.centerOffsetIn - input.refrigeratorWidthIn / 2, end: result.refrigerator.centerOffsetIn + input.refrigeratorWidthIn / 2 });
  return out;
}

function expectValid(input: AutoDesignDefaultCentersInput) {
  const list = spans(input);
  const room = input.room ?? DEFAULT_ROOM;
  for (const span of list) {
    const wall = wallLabelToEngineWallId(span.wall, room, input.originCorner, input.runDirection);
    expect(wall, `${span.kind} on ${span.wall}`).toBeTruthy();
    expect(span.start).toBeGreaterThanOrEqual(-0.01);
    expect(span.end).toBeLessThanOrEqual(wall!.frame.length + 0.01);
  }
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]!;
      const b = list[j]!;
      if (a.wall !== b.wall) continue;
      const room_ = a.kind === "refrigerator" || b.kind === "refrigerator" ? 1.5 : 0;
      const gap = Math.max(a.start, b.start) - Math.min(a.end, b.end);
      expect(gap, `${a.kind} ${a.start}-${a.end} vs ${b.kind} ${b.start}-${b.end} on ${a.wall}`).toBeGreaterThanOrEqual(room_ - 0.01);
    }
  }
}

describe("autoDesignDefaultCenters", () => {
  it("replaces the old overlapping single-wall starting values on the 144 in. wall", () => {
    const result = autoDesignDefaultCenters(base());
    expect(result.fits).toBe(true);
    expect(result).toMatchObject({
      sink: { wallLabel: "Wall 1", centerOffsetIn: 51 },
      stove: { wallLabel: "Wall 1", centerOffsetIn: 18 },
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 124.5 },
    });
    expectValid(base());
  });

  it("uses the walls each layout cabinets on the default room", () => {
    const walls = (layoutType: AutoDesignLayoutType) => {
      const result = autoDesignDefaultCenters(base({ layoutType }));
      return [result.sink.wallLabel, result.stove!.wallLabel, result.refrigerator!.wallLabel];
    };
    expect(walls("single-wall")).toEqual(["Wall 1", "Wall 1", "Wall 1"]);
    expect(walls("galley").every((wall) => wall === "Wall 1" || wall === "Wall 3")).toBe(true);
    expect(new Set(walls("galley")).size).toBe(2);
    expect(walls("l-shape").every((wall) => wall === "Wall 1" || wall === "Wall 2")).toBe(true);
    expect(new Set(walls("l-shape")).size).toBe(2);
    expect(walls("u-shape").every((wall) => wall === "Wall 1" || wall === "Wall 2" || wall === "Wall 3")).toBe(true);
    expect(new Set(walls("u-shape")).size).toBe(3);
  });

  it("keeps clear of the corner cabinets where two runs meet", () => {
    for (const layoutType of ["l-shape", "u-shape"] as const) {
      const input = base({ layoutType });
      const room = DEFAULT_ROOM;
      const used = layoutType === "l-shape" ? ["Wall 1", "Wall 2"] : ["Wall 1", "Wall 2", "Wall 3"];
      for (const span of spans(input)) {
        const wall = wallLabelToEngineWallId(span.wall, room, "left", "right")!;
        for (const otherLabel of used.filter((label) => label !== span.wall) as WallLabel[]) {
          const other = wallLabelToEngineWallId(otherLabel, room, "left", "right")!;
          const meets = (point: { x: number; y: number }) => [other.frame.start, other.frame.end].some((p) => Math.hypot(p.x - point.x, p.y - point.y) < 0.01);
          // Wall start (measurement 0) and wall end, in this setup's measurement direction.
          if (meets(wall.frame.start)) expect(span.start, `${span.kind} near the ${span.wall} start corner`).toBeGreaterThanOrEqual(AUTO_DESIGN_DEFAULT_CORNER_CLEAR_IN - 1.5 - 0.01);
          if (meets(wall.frame.end)) expect(span.end, `${span.kind} near the ${span.wall} end corner`).toBeLessThanOrEqual(wall.frame.length - AUTO_DESIGN_DEFAULT_CORNER_CLEAR_IN + 1.5 + 0.01);
        }
      }
    }
  });

  it("never overlaps across layouts, rooms, corners, directions and appliance widths", () => {
    const rooms: RoomData[] = [DEFAULT_ROOM, { ...DEFAULT_ROOM, width: 132, depth: 120 }, { ...DEFAULT_ROOM, width: 168, depth: 132 }, { ...DEFAULT_ROOM, width: 216, depth: 156 }];
    for (const room of rooms) {
      for (const layoutType of LAYOUTS) {
        for (const originCorner of ["left", "right"] as const) {
          for (const runDirection of ["left", "right"] as const) {
            for (const dishwasherSide of ["left", "right", "none"] as const) {
              for (const [sinkBaseWidthIn, refrigeratorWidthIn] of [[36, 36], [30, 30], [33, 42], [42, 36]] as const) {
                const input = base({ room, layoutType, originCorner, runDirection, dishwasherSide, sinkBaseWidthIn, refrigeratorWidthIn });
                if (!autoDesignDefaultCenters(input).fits) continue;
                expectValid(input);
              }
            }
          }
        }
      }
    }
  });

  it("keeps a typed value exactly and places the others around it", () => {
    const typedSink = { wallLabel: "Wall 1" as const, centerOffsetIn: 72 };
    const input = base({ fixed: { sink: typedSink } });
    const result = autoDesignDefaultCenters(input);
    expect(result.sink).toEqual(typedSink);
    expectValid(input);
    const typedFridge = { wallLabel: "Wall 1" as const, centerOffsetIn: 72 };
    const withFridge = autoDesignDefaultCenters(base({ layoutType: "l-shape", fixed: { refrigerator: typedFridge } }));
    expect(withFridge.refrigerator).toEqual(typedFridge);
  });

  it("follows the sink-base width, dishwasher side and omitted appliances", () => {
    const wide = autoDesignDefaultCenters(base({ sinkBaseWidthIn: 42 }));
    expect(wide.sink.centerOffsetIn).not.toBe(autoDesignDefaultCenters(base()).sink.centerOffsetIn);
    expectValid(base({ sinkBaseWidthIn: 42 }));
    const noRange = autoDesignDefaultCenters(base({ includeStove: false }));
    expect(noRange.stove).toBeNull();
    const noFridge = autoDesignDefaultCenters(base({ includeRefrigerator: false }));
    expect(noFridge.refrigerator).toBeNull();
    expectValid(base({ dishwasherSide: "left" }));
  });

  it("says when a wall is too short for everything instead of inventing an overlap-free answer", () => {
    expect(autoDesignDefaultCenters(base({ room: { ...DEFAULT_ROOM, width: 120, depth: 108 } })).fits).toBe(false);
  });
});
