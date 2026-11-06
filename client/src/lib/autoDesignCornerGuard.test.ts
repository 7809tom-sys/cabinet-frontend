import { describe, expect, it } from "vitest";
import { isPlacedCornerCabinet, sameWidthFamily } from "./autoDesignCornerGuard";
import type { PlacedCabinet } from "./design";

function placed(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "u",
    cabinetId: 1,
    masterCode: "B24",
    description: '24" Base Cabinet',
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    depth: 24,
    height: 34.5,
    rotation: 0,
    ...overrides,
  } as PlacedCabinet;
}

describe("a seated corner cabinet is never resized by a run pass", () => {
  it("recognises every corner family as a corner", () => {
    expect(isPlacedCornerCabinet(placed({ masterCode: "LSB36", description: "Lazy Susan", cornerType: "l-shape" }))).toBe(true);
    expect(isPlacedCornerCabinet(placed({ masterCode: "BBC42", description: "Blind Corner Base", cornerType: "blind-corner" }))).toBe(true);
    expect(isPlacedCornerCabinet(placed({ masterCode: "DCB36", description: "Diagonal Corner Base", cornerType: "diagonal" }))).toBe(true);
    expect(isPlacedCornerCabinet(placed({ masterCode: "CDB36", description: "Corner Drawer Base" }))).toBe(true);
    expect(isPlacedCornerCabinet(placed({ masterCode: "BER36", description: "Easy Reach Corner Base" }))).toBe(true);
  });

  it("does not treat a straight base or a plain B42 as a corner", () => {
    expect(isPlacedCornerCabinet(placed({ masterCode: "B24" }))).toBe(false);
    // A plain B42 is a straight base even when a stale cornerType came with it.
    expect(isPlacedCornerCabinet(placed({ masterCode: "B42", cornerType: "blind-corner" }))).toBe(false);
    expect(isPlacedCornerCabinet(placed({ masterCode: "SB36", description: "Sink Base" }))).toBe(false);
  });

  it("never widens a corner, in either direction, and never picks a corner as the wider box", () => {
    const corner = placed({ masterCode: "LSB36", description: "Lazy Susan", cornerType: "l-shape", width: 36 });
    const straight = placed({ masterCode: "B36", width: 36 });
    // A corner is not a widen candidate at all.
    expect(sameWidthFamily(corner, { masterCode: "B42" })).toBe(false);
    expect(sameWidthFamily(corner, { masterCode: "LSB39" })).toBe(false);
    // A straight base may grow into another straight base.
    expect(sameWidthFamily(straight, { masterCode: "B42" })).toBe(true);
    // ...but never into a corner.
    expect(sameWidthFamily(straight, { masterCode: "BBC42" })).toBe(false);
    expect(sameWidthFamily(straight, { masterCode: "LSB36" })).toBe(false);
  });

  it("keeps a blind corner out of the widen path even though its code reads as a straight base family", () => {
    // `BCB42` is the DLC blind-base family. It must never be widened by a run pass.
    const blind = placed({ masterCode: "BCB42", description: "Base Blind w/Rollout Trays", cornerType: "blind-corner", width: 42 });
    expect(isPlacedCornerCabinet(blind)).toBe(true);
    expect(sameWidthFamily(blind, { masterCode: "B48" })).toBe(false);
  });
});
