import { describe, expect, it } from "vitest";
import {
  diagonalCornerClipPath,
  isBlindCorner,
  isDiagonalCorner,
  isBaseEndCornerCabinet,
  isLCornerCabinet,
  blindCornerDoorSide,
  normalizeBlindCornerDoorSides,
  cabinetWallMovePreview,
  placedFootprint,
} from "./design";
import type { PlacedCabinet, RoomData } from "./design";

describe("configured corner cabinet types", () => {
  it("keeps a diagonal corner distinct from a rectangular blind corner", () => {
    expect(isDiagonalCorner("DCB-36", "36 inch Diagonal Corner Base")).toBe(true);
    expect(isBlindCorner("DCB-36", "36 inch Diagonal Corner Base")).toBe(false);
    expect(isLCornerCabinet("DCB-36", "36 inch Diagonal Corner Base")).toBe(false);
    expect(isDiagonalCorner("BEC-24", "24 inch Base Angle Cabinet (End of Run)")).toBe(false);

    expect(isBlindCorner("BBC-36", "36 inch Blind Corner Base")).toBe(true);
    expect(isDiagonalCorner("BBC-36", "36 inch Blind Corner Base")).toBe(false);
    expect(isLCornerCabinet("BBC-36", "36 inch Blind Corner Base")).toBe(false);
  });

  it("uses a clipped square footprint for diagonal corners and rectangular footprint for blind corners", () => {
    const diagonal = {
      uid: "dc",
      masterCode: "DCB-36",
      description: "36 inch Diagonal Corner Base",
      width: 36,
      depth: 24,
      x: 0,
      y: 0,
      rotation: 0,
      placement: "base",
    } as PlacedCabinet;
    const blind = { ...diagonal, uid: "bbc", masterCode: "BBC-36", description: "36 inch Blind Corner Base" };

    expect(placedFootprint(diagonal)).toEqual({ w: 36, d: 36 });
    expect(placedFootprint(blind)).toEqual({ w: 36, d: 24 });
    expect(diagonalCornerClipPath(0)).toContain("polygon");
  });

  it("keeps BEC-24 as a 24-by-24 end-return, not a diagonal, blind, or lazy-Susan corner", () => {
    const bec = {
      uid: "bec",
      masterCode: "BEC-24",
      description: '24" Base End Angle Cabinet',
      width: 24,
      depth: 24,
      x: 0,
      y: 0,
      rotation: 0,
      placement: "base",
      cornerType: "base-end-corner",
    } as PlacedCabinet;

    expect(isDiagonalCorner(bec.masterCode, bec.description)).toBe(false);
    expect(isBlindCorner(bec.masterCode, bec.description)).toBe(false);
    expect(isLCornerCabinet(bec.masterCode, bec.description)).toBe(false);
    expect(isBaseEndCornerCabinet(bec)).toBe(true);
    expect(placedFootprint(bec)).toEqual({ w: 24, d: 24 });
    expect(placedFootprint({ ...bec, rotation: 90 })).toEqual({ w: 24, d: 24 });
  });

  it("uses Cabinet Config diagonal, lazy-Susan, and rectangular blind-corner settings in plan geometry", () => {
    const configured = {
      uid: "configured-corner",
      masterCode: "CUSTOM-36",
      description: '36" Configured Base Cabinet',
      width: 36,
      depth: 24,
      x: 0,
      y: 0,
      rotation: 0,
      placement: "base",
    } as PlacedCabinet;

    expect(placedFootprint({ ...configured, cornerType: "diagonal" })).toEqual({ w: 36, d: 36 });
    expect(placedFootprint({ ...configured, cornerType: "lazy-susan" })).toEqual({ w: 36, d: 36 });
    expect(placedFootprint({ ...configured, cornerType: "blind-corner" })).toEqual({ w: 36, d: 24 });
  });

  it("faces each blind-corner door away from all four room corners, including a six-inch pull", () => {
    const room: RoomData = { width: 120, depth: 120 };
    const base = {
      uid: "bbc",
      masterCode: "BBC-36",
      description: '36" Blind Corner Base Cabinet',
      placement: "base",
      width: 36,
      depth: 24,
      height: 34.5,
      y: 0,
      rotation: 0,
      swing: "left",
      pullMin: 3,
      pullMax: 6,
    } as PlacedCabinet;
    const leftCorner = { ...base, uid: "top-left", x: 6, swing: "left" as const };
    const rightCorner = { ...base, uid: "top-right", x: 78, swing: "right" as const };
    const lowerLeftCorner = { ...base, uid: "left-top", x: 0, y: 6, rotation: 90, swing: "left" as const };
    const lowerRightCorner = { ...base, uid: "right-bottom", x: 96, y: 78, rotation: 90, swing: "right" as const };

    expect(blindCornerDoorSide(leftCorner, room)).toBe("right");
    expect(blindCornerDoorSide(rightCorner, room)).toBe("left");
    expect(blindCornerDoorSide(lowerLeftCorner, room)).toBe("right");
    expect(blindCornerDoorSide(lowerRightCorner, room)).toBe("left");
    expect(normalizeBlindCornerDoorSides([leftCorner, rightCorner, lowerLeftCorner, lowerRightCorner], room)).toMatchObject([
      { uid: "top-left", swing: "right" },
      { uid: "top-right", swing: "left" },
      { uid: "left-top", swing: "right" },
      { uid: "right-bottom", swing: "left" },
    ]);
  });

  it("lets a blind corner release from the wall magnet but clamps its pull to the configured 3–6 inch range", () => {
    const room: RoomData = { width: 120, depth: 120, ceilingHeight: 96 };
    const blind = {
      uid: "bbc-release",
      masterCode: "BBC-36",
      description: '36" Blind Corner Base',
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "top",
      wallOffset: 0,
      pullMin: 3,
      pullMax: 6,
    } as PlacedCabinet;

    const withinRange = cabinetWallMovePreview(blind, { x: 4, y: 0 }, room, [], [], {
      magnet: true,
      exact: false,
      target: { wallId: "top", wallOffset: 4 },
    });
    expect(withinRange.candidate?.wallOffset).toBe(4);
    expect(withinRange.snapped).toBe(false);

    const beyondMaximum = cabinetWallMovePreview(blind, { x: 20, y: 0 }, room, [], [], {
      magnet: true,
      exact: false,
      target: { wallId: "top", wallOffset: 20 },
    });
    expect(beyondMaximum.candidate?.wallOffset).toBe(6);
  });

  it("keeps the ordinary base-cabinet wall magnet unchanged", () => {
    const room: RoomData = { width: 120, depth: 120, ceilingHeight: 96 };
    const cabinet = {
      uid: "b36",
      masterCode: "B36",
      description: '36" Base Cabinet',
      placement: "base",
      x: 2,
      y: 0,
      width: 36,
      depth: 24,
      height: 34.5,
      rotation: 0,
      wallId: "top",
      wallOffset: 2,
    } as PlacedCabinet;
    const result = cabinetWallMovePreview(cabinet, { x: 2, y: 0 }, room, [], [], { magnet: true });
    expect(result.candidate?.wallOffset).toBe(0);
    expect(result.snapped).toBe(true);
  });
});
