import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/autoDesignRealCatalog.json";
import {
  LEFT_SKIN_BARE_GAP_MAX_IN,
  leftoverGapIsActionable,
  neighborAtGapEdge,
  refrigeratorPanelAtEdge,
  resolveLeftoverGap,
  soldNeighborWidths,
} from "./autoDesignLeftover";
import { DEFAULT_ROOM, wallPlacementAt, type DesignCabinet, type PlacedCabinet } from "./design";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const rows = REAL["330011"]!.base as DesignCabinet[];
const framelessRows = REAL["540005"]!.base as DesignCabinet[];
const byCode = (code: string) => {
  const row = rows.find((candidate) => candidate.masterCode === code);
  if (!row) throw new Error(`fixture is missing ${code}`);
  return row;
};

function placed(masterCode: string, width: number, start: number, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 24, "bottom", DEFAULT_ROOM);
  return {
    uid: `${masterCode}-${start}`,
    cabinetId: byCode(masterCode)?.id ?? 1,
    masterCode,
    description: `${width} inch base`,
    category: "Base",
    subCategory: "Base",
    placement: "base",
    ...spot,
    width,
    depth: 24,
    height: 34.5,
    numberOfDoors: 2,
    numberOfDrawers: 1,
    ...extra,
  } as PlacedCabinet;
}

describe("leftover space uses real cabinets before filler", () => {
  it("turns an 18 inch drawer base into a 27 to close a 9 inch hole", () => {
    const neighbor = placed("3DB18", 18, 60);
    const resolution = resolveLeftoverGap({
      gapIn: 9,
      startIn: 78,
      neighbor,
      catalog: framelessRows,
      room: DEFAULT_ROOM,
    });
    expect(resolution.kind).toBe("widen-neighbor");
    if (resolution.kind !== "widen-neighbor") return;
    expect(resolution.widthIn).toBeCloseTo(27, 5);
    // Same family: a three-drawer base stays a three-drawer base.
    expect(/^3DB27$/.test(resolution.replacement.masterCode)).toBe(true);
  });

  it("closes a 12 inch hole beside a range by widening the neighbour, never with filler alone", () => {
    const neighbor = placed("B24", 24, 30);
    const resolution = resolveLeftoverGap({
      gapIn: 12,
      startIn: 54,
      neighbor,
      catalog: rows,
      room: DEFAULT_ROOM,
    });
    expect(resolution.kind).toBe("widen-neighbor");
    if (resolution.kind !== "widen-neighbor") return;
    expect(resolution.widthIn).toBeCloseTo(36, 5);
  });

  it("keeps the neighbour's family: a door base does not become a drawer base", () => {
    const neighbor = placed("B18", 18, 60);
    const resolution = resolveLeftoverGap({
      gapIn: 9,
      startIn: 78,
      neighbor,
      catalog: rows,
      room: DEFAULT_ROOM,
    });
    expect(resolution.kind).toBe("widen-neighbor");
    if (resolution.kind !== "widen-neighbor") return;
    expect(/^B\d/.test(resolution.replacement.masterCode)).toBe(true);
    expect(/^(?:3DB|2DB|DB)/.test(resolution.replacement.masterCode)).toBe(false);
  });

  it("uses a real narrow cabinet plus a filler instead of a 4-5 inch filler alone", () => {
    const resolution = resolveLeftoverGap({
      gapIn: 10,
      startIn: 40,
      neighbor: null,
      catalog: rows,
      room: DEFAULT_ROOM,
    });
    expect(resolution.kind).toBe("narrow-cabinet");
    if (resolution.kind !== "narrow-cabinet") return;
    expect(resolution.widthIn).toBeGreaterThan(0);
    expect(resolution.widthIn).toBeLessThanOrEqual(10);
    expect(resolution.fillerIn).toBeLessThanOrEqual(3 + 1e-6);
  });

  it("falls back to filler only for a gap a filler can actually take", () => {
    const resolution = resolveLeftoverGap({
      gapIn: 2.5,
      startIn: 40,
      neighbor: null,
      catalog: [],
      room: DEFAULT_ROOM,
    });
    expect(resolution).toMatchObject({ kind: "filler", widthIn: 2.5 });
  });

  it("never passes a refrigerator end panel", () => {
    const resolution = resolveLeftoverGap({
      gapIn: 9,
      startIn: 40,
      neighbor: placed("B18", 18, 22),
      catalog: rows,
      room: DEFAULT_ROOM,
      cappedByRefrigeratorPanel: true,
    });
    expect(resolution.kind).toBe("leave-bare");
  });

  it("leaves a bare 1-1.5 inch gap at a skin instead of forcing a sliver", () => {
    const resolution = resolveLeftoverGap({
      gapIn: 1.25,
      startIn: 40,
      neighbor: null,
      catalog: [],
      room: DEFAULT_ROOM,
      atSkin: true,
    });
    expect(resolution.kind).toBe("leave-bare");
    expect(LEFT_SKIN_BARE_GAP_MAX_IN).toBe(1.5);
  });

  it("only acts on gaps filler cannot take", () => {
    expect(leftoverGapIsActionable(3)).toBe(false);
    expect(leftoverGapIsActionable(3.5)).toBe(true);
    expect(leftoverGapIsActionable(9)).toBe(true);
  });

  it("finds the neighbour and the refrigerator cap at a gap edge", () => {
    const b18 = placed("B18", 18, 60);
    const panel = placed("B18", 0.75, 99, {
      category: "Panel",
      subCategory: "End Panel",
      masterCode: "REPV2496",
      description: '24" x 96" Refrigerator End Panel',
    });
    const edgeNeighbor = neighborAtGapEdge({ placed: [b18], room: DEFAULT_ROOM, wallId: "bottom", edgeIn: 78, side: "start" });
    expect(edgeNeighbor?.uid).toBe(b18.uid);
    expect(refrigeratorPanelAtEdge({ placed: [panel], room: DEFAULT_ROOM, wallId: "bottom", edgeIn: 99 })).toBe(true);
    expect(soldNeighborWidths(b18, rows).length).toBeGreaterThan(0);
  });
});
