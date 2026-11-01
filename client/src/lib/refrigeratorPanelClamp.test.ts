import { describe, expect, it } from "vitest";
import { buildMandatoryAutoDesignRefrigeratorBay } from "./autoDesignRefrigeratorBay";
import { clampRefrigeratorAssemblyToPanels } from "./refrigeratorPanelClamp";
import { wallPlacementAt, wallRunOffset, wallRunSpan, type DesignCabinet, type PlacedCabinet, type RoomData } from "./design";

const room: RoomData = { width: 200, depth: 120, ceilingHeight: 96 };

function source(overrides: Partial<DesignCabinet>): DesignCabinet {
  return {
    id: 1, masterCode: "W3624", description: "Refrigerator Wall Cabinet", category: "Wall", subCategory: "Refrigerator Cabinet",
    width: "36", height: "24", depth: "24", placement: "wall", numberOfDoors: 2, numberOfDrawers: 0, isCornerCabinet: false, ...overrides,
  } as DesignCabinet;
}
const PANEL = source({ id: 201, masterCode: "REP2496", description: "Refrigerator End Panel", category: "Panel", subCategory: "Refrigerator End Panel", width: "0.75", height: "96", depth: "24", placement: "tall", numberOfDoors: 0 });
const CAPS = [30, 33, 36, 42].map((w, i) => source({ id: 300 + i, masterCode: `W${w}24`, width: String(w), height: "24", depth: "24" }));

function fridge(width: number, start = 60, depth = 30, height = 70): PlacedCabinet {
  const spot = wallPlacementAt(start, width, depth, "top", room);
  return {
    uid: `fridge-${width}`, cabinetId: 100, masterCode: `FRIDGE-${width}`, description: `${width}″ Refrigerator`, category: "Appliance",
    subCategory: "Refrigerator", placement: "appliance", applianceRole: "base-height", ...spot, width, depth, height, rotation: spot.rotation,
  } as PlacedCabinet;
}
function build(f: PlacedCabinet, caps = CAPS) {
  let n = 0;
  const result = buildMandatoryAutoDesignRefrigeratorBay({ refrigerator: f, room, caps, endPanels: [PANEL], styleId: 1, makeUid: () => `u${++n}` });
  if (!result.ok) throw new Error(result.message);
  return result;
}
const along = (item: PlacedCabinet) => ({ start: wallRunOffset(item, "top", room), end: wallRunOffset(item, "top", room) + wallRunSpan(item, "top", room) });

describe("refrigerator stays inside its panels", () => {
  for (const width of [30, 33, 36, 42]) {
    it(`${width} in fridge gets a ${width} in cabinet above and stays inside both panels`, () => {
      const f = fridge(width);
      const bay = build(f);
      const [bridge, leftPanel, rightPanel] = bay.additions;
      expect(bridge.width).toBe(width);
      const placed = [bay.refrigerator, ...bay.additions];
      const out = clampRefrigeratorAssemblyToPanels({ placed, refrigeratorUid: f.uid, room });
      expect(out.warnings).toEqual([]);
      const fr = along(out.placed.find((p) => p.uid === f.uid)!);
      expect(fr.start).toBeGreaterThanOrEqual(along(leftPanel).end + 0.5 - 0.01);
      expect(fr.end).toBeLessThanOrEqual(along(rightPanel).start - 0.5 + 0.01);
      const br = along(out.placed.find((p) => p.uid === bridge.uid)!);
      expect(br.start).toBeGreaterThanOrEqual(along(leftPanel).start - 0.01);
      expect(br.end).toBeLessThanOrEqual(along(rightPanel).end + 0.01);
    });
  }

  it("uses the nearest narrower cabinet, centered, when the fridge width is not in the line, and never an over-wide one", () => {
    const f = fridge(33);
    const only36 = [source({ id: 9, masterCode: "W3624", width: "36" }), source({ id: 10, masterCode: "W3024", width: "30" })];
    const bay = build(f, only36);
    expect(bay.additions[0].width).toBe(30);
    expect(bay.notes.join(" ")).toMatch(/W3024/);
    const span = along(bay.additions[0]);
    expect((span.start + span.end) / 2).toBeCloseTo(60 + 33 / 2, 1);
    let message = "";
    try { build(fridge(33), [source({ id: 9, masterCode: "W3624", width: "36" })]); } catch (error) { message = (error as Error).message; }
    expect(message).toMatch(/33-inch/);
  });

  it("adds back a missing right panel on an open side", () => {
    const f = fridge(36);
    const bay = build(f);
    const withoutRight = [bay.refrigerator, ...bay.additions.filter((p) => p.refrigeratorAssemblyRole !== "right-panel")];
    const out = clampRefrigeratorAssemblyToPanels({ placed: withoutRight, refrigeratorUid: f.uid, room, addPanel: bay.panelFor });
    expect(out.placed.some((p) => p.refrigeratorAssemblyRole === "right-panel")).toBe(true);
    expect(out.warnings).toEqual([]);
  });

  it("warns instead when there is no room for the missing panel", () => {
    const f = fridge(36);
    const bay = build(f);
    const neighbor = { ...fridge(24, 96.9), uid: "dw", masterCode: "DW-24", placement: "base" } as PlacedCabinet;
    const withoutRight = [bay.refrigerator, neighbor, ...bay.additions.filter((p) => p.refrigeratorAssemblyRole !== "right-panel")];
    const out = clampRefrigeratorAssemblyToPanels({ placed: withoutRight, refrigeratorUid: f.uid, room, addPanel: bay.panelFor });
    expect(out.warnings).toContain("Refrigerator right side is not closed by a panel.");
    expect(out.placed.some((p) => p.refrigeratorAssemblyRole === "right-panel")).toBe(false);
  });

  it("clamps a fridge deeper or taller than the panels", () => {
    const f = fridge(36, 60, 34, 70);
    const bay = build(f);
    const tall = { ...f, height: 75 };
    const out = clampRefrigeratorAssemblyToPanels({ placed: [tall, ...bay.additions], refrigeratorUid: f.uid, room });
    const fr = out.placed.find((p) => p.uid === f.uid)!;
    expect(fr.depth).toBeLessThanOrEqual(24.05);
    expect(fr.height).toBeLessThanOrEqual(bay.additions[1].height + 0.05);
    expect(out.notes.join(" ")).toMatch(/deep so it stays inside/);
    const taller = clampRefrigeratorAssemblyToPanels({ placed: [{ ...f, height: 99 }, ...bay.additions], refrigeratorUid: f.uid, room });
    expect(taller.placed.find((p) => p.uid === f.uid)!.height).toBeLessThanOrEqual(bay.additions[1].height + 0.05);
    expect(taller.notes.join(" ")).toMatch(/high so it stays inside/);
  });

  it("does not require a panel on a corner side that the adjoining wall closes", () => {
    const f = fridge(36, 0.5);
    const bay = build(f);
    const onlyRight = [bay.refrigerator, ...bay.additions.filter((p) => p.refrigeratorAssemblyRole !== "left-panel")];
    const out = clampRefrigeratorAssemblyToPanels({ placed: onlyRight, refrigeratorUid: f.uid, room, addPanel: bay.panelFor });
    expect(out.warnings).toEqual([]);
    expect(out.placed.some((p) => p.refrigeratorAssemblyRole === "left-panel")).toBe(false);
  });

  it("warns by name when the fridge is too wide for the opening and never moves a panel", () => {
    const f = fridge(36);
    const bay = build(f);
    const wide = { ...bay.refrigerator, width: 40 };
    const out = clampRefrigeratorAssemblyToPanels({ placed: [wide, ...bay.additions], refrigeratorUid: f.uid, room });
    expect(out.warnings.some((w) => /^40″ refrigerator does not fit the 36″ opening/.test(w))).toBe(true);
  });

  it("the pop-up path (no addPanel) clamps exactly like Auto-Design and only warns about an open side", () => {
    const f = fridge(36, 60, 34, 70);
    const bay = build(f);
    const popup = clampRefrigeratorAssemblyToPanels({ placed: [f, ...bay.additions.filter((p) => p.refrigeratorAssemblyRole !== "right-panel")], refrigeratorUid: f.uid, room });
    expect(popup.placed.find((p) => p.uid === f.uid)!.depth).toBeLessThanOrEqual(24.05);
    expect(popup.warnings).toContain("Refrigerator right side is not closed by a panel.");
  });
});
