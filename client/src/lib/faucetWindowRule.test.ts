import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, type SinkFixture, type WallOpening } from "./design";
import { raiseWindowsForDeckFaucet, resolveDeckFaucetPlacement } from "./faucetPlacement";

/**
 * Window rule: Auto-Design never moves or raises a window to make room for a sink. A window changes
 * only as a last resort (the faucet cannot clear it any other way) and the change is a visible warning.
 */
const room = DEFAULT_ROOM;

const sink = (overrides: Partial<SinkFixture> = {}): SinkFixture => ({
  uid: "sink-1", type: "double", x: 31.5, y: 2.5, width: 33, depth: 20, sourceDepth: 20, faucet: true,
  wallSide: "top", faucetRearDeckOffsetIn: 1.25, faucetOverallHeight: 15.75, faucetSpoutLength: 9.375,
  faucetSpoutHeight: 6.5, faucetForm: "pull-down", pelicanFaucetProfileId: "pelican-pl-8213-fountain-pull-down",
  ...overrides,
});

const lowWindow = (overrides: Partial<WallOpening> = {}): WallOpening => ({
  uid: "window-1", kind: "window", label: "Over sink", side: "top", offset: 30, width: 36, height: 36, sill: 38, ...overrides,
});

describe("window rule: windows stay put for a sink", () => {
  it("a sink that fits under the window as it is leaves the window exactly where it is", () => {
    const window = lowWindow({ sill: 72, height: 18 });
    expect(resolveDeckFaucetPlacement(sink(), room, [window]).conflict).toBeNull();
    const result = raiseWindowsForDeckFaucet({ sinks: [sink()], room, openings: [window] });
    expect(result.openings[0]).toBe(window);
    expect(result.notes).toEqual([]);
    expect(result.unresolved).toBe(false);
  });

  it("a faucet that clears by moving forward on the deck does not touch the window", () => {
    const deep = sink({ y: 8 });
    const window = lowWindow();
    expect(resolveDeckFaucetPlacement(deep, room, [window]).conflict).toBeNull();
    const result = raiseWindowsForDeckFaucet({ sinks: [deep], room, openings: [window] });
    expect(result.openings[0]).toBe(window);
    expect(result.openings[0]!.sill).toBe(38);
    expect(result.notes).toEqual([]);
  });

  it("a window the faucet does not hit stays put even when another window had to change", () => {
    const hit = lowWindow();
    const far = lowWindow({ uid: "window-far", offset: 100, width: 24 });
    const result = raiseWindowsForDeckFaucet({ sinks: [sink()], room, openings: [hit, far] });
    expect(result.openings.find((item) => item.uid === "window-far")).toBe(far);
    expect(result.openings.find((item) => item.uid === "window-1")!.sill).toBeGreaterThan(38);
  });

  it("raises the window only as a last resort, and says so with a warning", () => {
    const window = lowWindow();
    expect(resolveDeckFaucetPlacement(sink(), room, [window]).conflict).toBe("window-frame");
    const result = raiseWindowsForDeckFaucet({ sinks: [sink()], room, openings: [window], wallLabels: { top: "Wall 1" } });
    expect(result.openings[0]!.sill).toBeGreaterThan(38);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]!.severity).toBe("warning");
    expect(result.notes[0]!.text).toMatch(/Window on Wall 1 raised/);
    expect(resolveDeckFaucetPlacement(sink(), room, result.openings).conflict).toBeNull();
  });

  it("when the window cannot be raised either, it is left alone and the warning says so", () => {
    const window = lowWindow();
    const lowRoom = { ...room, customWalls: [{ id: "top", startVertexId: "a", endVertexId: "b", height: 48 }] };
    const result = raiseWindowsForDeckFaucet({ sinks: [sink()], room: lowRoom, openings: [window], wallLabels: { top: "Wall 1" } });
    expect(result.unresolved).toBe(true);
    expect(result.openings[0]!.sill).toBe(38);
    expect(result.notes[0]!.severity).toBe("warning");
  });
});
