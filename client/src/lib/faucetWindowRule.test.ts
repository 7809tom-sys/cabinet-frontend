import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, type SinkFixture, type WallOpening } from "./design";
import { raiseWindowsForDeckFaucet, resolveDeckFaucetPlacement } from "./faucetPlacement";

/**
 * Owner clarification (Nov 5 2026): the faucet is at the sink, IN FRONT OF THE
 * WINDOW, and the window position NEVER moves. A sink under glazing is the normal
 * kitchen, so the faucet standing in front of the window aperture is expected — it is
 * never omitted for that reason, and no window coordinate or dimension changes.
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

describe("window rule: a window never moves for a sink, and the faucet is always there", () => {
  it("leaves a window that already clears the faucet exactly where it is", () => {
    const window = lowWindow({ sill: 72, height: 18 });
    expect(resolveDeckFaucetPlacement(sink(), room, [window]).conflict).toBeNull();
    const result = raiseWindowsForDeckFaucet({ sinks: [sink()], room, openings: [window] });
    expect(result.openings[0]).toBe(window);
    expect(result.notes).toEqual([]);
    expect(result.unresolved).toBe(false);
  });

  it("leaves a low window exactly where it is and still draws the faucet in front of it", () => {
    const window = lowWindow();
    const placement = resolveDeckFaucetPlacement(sink(), room, [window]);
    expect(placement.inFrontOfWindow).toBe(true);
    expect(placement.renderFaucet).toBe(true);
    const result = raiseWindowsForDeckFaucet({ sinks: [sink()], room, openings: [window], wallLabels: { top: "Wall 1" } });
    // The same object, every coordinate and dimension intact.
    expect(result.openings[0]).toBe(window);
    expect(result.openings[0]!.sill).toBe(38);
    expect(result.openings[0]!.height).toBe(36);
    expect(result.openings[0]!.offset).toBe(30);
    expect(result.openings[0]!.width).toBe(36);
    expect(result.notes).toEqual([]);
    expect(result.unresolved).toBe(false);
    expect(result.inFrontOfWindow).toBe(true);
  });

  it("never changes any window when several sinks and several windows are present", () => {
    const near = lowWindow();
    const far = lowWindow({ uid: "window-far", offset: 100, width: 24 });
    const deep = sink({ y: 8 });
    const result = raiseWindowsForDeckFaucet({ sinks: [sink(), deep], room, openings: [near, far] });
    expect(result.openings[0]).toBe(near);
    expect(result.openings[1]).toBe(far);
    expect(result.notes).toEqual([]);
    expect(result.unresolved).toBe(false);
  });

  it("keeps the window even when the wall is too low to raise any sill", () => {
    const window = lowWindow();
    const lowRoom = { ...room, customWalls: [{ id: "top", startVertexId: "a", endVertexId: "b", height: 48 }] };
    const result = raiseWindowsForDeckFaucet({ sinks: [sink()], room: lowRoom, openings: [window], wallLabels: { top: "Wall 1" } });
    expect(result.openings[0]).toBe(window);
    expect(result.unresolved).toBe(false);
    expect(result.notes).toEqual([]);
    // The faucet is still placed and drawn, in front of the glazing.
    const placement = resolveDeckFaucetPlacement(sink(), lowRoom, result.openings);
    expect(placement.renderFaucet).toBe(true);
  });
});
