import { describe, expect, it } from "vitest";
import {
	drywallPonyWallAppearance,
	drywallPonyWallPreviewBackground,
  makePeninsulaDrywallBackPonyWall,
	  makePeninsulaPonyWall,
	  peninsulaRunEndpoints,
		ponyWallFitsRoom,
		ponyWallMiteredFootprint,
		ponyWallPlanFrame,
	roomWallAppearance,
  type PeninsulaRun,
  type RoomData,
} from "./design";

const primary: PeninsulaRun = {
  id: "peninsula-primary",
  parentWall: "top",
  startOffset: 72,
  turn: 90,
  direction: "right",
  length: 72,
  height: 34.5,
  label: "Peninsula · straight",
};

const return45: PeninsulaRun = {
  id: "peninsula-return-45",
  parentRunId: primary.id,
  startOffset: 0,
  turn: 45,
  direction: "right",
  length: 36,
  height: 34.5,
  label: "Peninsula end · 45° right",
};

const room: RoomData = {
  width: 180,
  depth: 180,
  ceilingHeight: 96,
  peninsulaRuns: [primary, return45],
};

describe("peninsula-attached pony walls", () => {
  it("snaps the pony wall to the final 45-degree peninsula endpoint", () => {
    const ponyWall = makePeninsulaPonyWall(return45, room, {
      width: 36,
      depth: 6,
      height: 34.5,
      label: "Pony wall · follows 45° right peninsula end",
    });
    const runEnd = peninsulaRunEndpoints(return45, room).end;
    const frame = ponyWallPlanFrame(ponyWall, room);

    expect(ponyWall.peninsulaRunId).toBe(return45.id);
    expect(ponyWall.peninsulaEnd).toBe("end");
    expect(frame.attachedToPeninsula).toBe(true);
    expect(frame.start).toEqual(runEnd);
    expect(frame.radians).toBeCloseTo(peninsulaRunEndpoints(return45, room).radians, 8);
    expect(ponyWallFitsRoom(ponyWall, room)).toBe(true);
  });

	  it("follows a changed parent attachment and length instead of retaining a loose screen position", () => {
    const ponyWall = makePeninsulaPonyWall(return45, room, { width: 24 });
    const movedPrimary = { ...primary, startOffset: 84, length: 60 };
    const movedRoom: RoomData = { ...room, peninsulaRuns: [movedPrimary, { ...return45, parentRunId: movedPrimary.id }] };

    const originalStart = ponyWallPlanFrame(ponyWall, room).start;
    const movedStart = ponyWallPlanFrame(ponyWall, movedRoom).start;

    expect(movedStart).toEqual(peninsulaRunEndpoints(movedRoom.peninsulaRuns![1]!, movedRoom).end);
    expect(movedStart).not.toEqual(originalStart);
	    expect(ponyWallFitsRoom(ponyWall, movedRoom)).toBe(true);
	  });

	  it("keeps a drywall pony wall directly behind the cabinet side and stretches it with the full peninsula run", () => {
	    const ponyWall = makePeninsulaDrywallBackPonyWall(primary, room, { depth: 4.5, height: 40, color: "#7c9588", texture: "light-plaster" });
	    const frame = ponyWallPlanFrame(ponyWall, room);
	    const runFrame = peninsulaRunEndpoints(primary, room);
	    const leftNormal = { x: -Math.sin(runFrame.radians), y: Math.cos(runFrame.radians) };

	    expect(ponyWall.peninsulaPlacement).toBe("behind-cabinets");
	    expect(ponyWall.finish).toBe("drywall");
	    expect(ponyWall.drywallColor).toBe("#7c9588");
	    expect(ponyWall.drywallTexture).toBe("light-plaster");
	    expect(frame.width).toBe(primary.length);
	    expect(frame.height).toBe(40);
	    expect(frame.start.x).toBeCloseTo(runFrame.start.x - leftNormal.x * ponyWall.depth / 2, 8);
	    expect(frame.start.y).toBeCloseTo(runFrame.start.y - leftNormal.y * ponyWall.depth / 2, 8);
	    expect(ponyWallFitsRoom(ponyWall, room)).toBe(true);

	    const extended = { ...primary, length: 84 };
	    const extendedRoom: RoomData = { ...room, peninsulaRuns: [extended, return45] };
	    expect(ponyWallPlanFrame(ponyWall, extendedRoom).width).toBe(84);
	  });

  it("uses mirrored miter cuts when matching drywall pony walls meet at a 45-degree peninsula joint", () => {
    const parentWall = makePeninsulaDrywallBackPonyWall(primary, room, { depth: 4.5, height: 40 });
    const returnWall = makePeninsulaDrywallBackPonyWall(return45, room, { depth: 4.5, height: 40 });
    const parent = ponyWallMiteredFootprint(parentWall, [parentWall, returnWall], room);
    const child = ponyWallMiteredFootprint(returnWall, [parentWall, returnWall], room);

    expect(parent.miteredEnd).toBe(true);
    expect(child.miteredStart).toBe(true);
    // The shared bisector intentionally replaces both square ends, removing
    // the triangular visual gap at the joined 45-degree pony-wall corner.
    expect(parent.corners[2]!.x).not.toBeCloseTo(parent.corners[3]!.x, 8);
    expect(child.corners[0]!.x).not.toBeCloseTo(child.corners[1]!.x, 8);
    const toPlanPoint = (frame: typeof parent.frame, corner: { x: number; z: number }) => ({
      x: frame.start.x + Math.cos(frame.radians) * corner.x - Math.sin(frame.radians) * corner.z,
      y: frame.start.y + Math.sin(frame.radians) * corner.x + Math.cos(frame.radians) * corner.z,
    });
    const parentCut = [parent.corners[2]!, parent.corners[3]!].map((corner) => toPlanPoint(parent.frame, corner));
    const childCut = [child.corners[0]!, child.corners[1]!].map((corner) => toPlanPoint(child.frame, corner));
    for (const point of parentCut) {
      expect(Math.min(...childCut.map((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y)))).toBeLessThan(1e-7);
    }
  });

	  it("uses safe paint and texture defaults for legacy or malformed drywall settings", () => {
	    expect(drywallPonyWallAppearance({ drywallColor: "not-a-color", drywallTexture: "rough-cement" as any })).toEqual({
	      color: "#e7e1d5",
	      texture: "smooth",
	      roughness: 0.78,
	    });
	    expect(drywallPonyWallAppearance({ drywallColor: "#506d92", drywallTexture: "orange-peel" })).toEqual({
	      color: "#506d92",
	      texture: "orange-peel",
	      roughness: 0.9,
	    });
	    expect(roomWallAppearance({ wallAppearance: { color: "#506d92", texture: "orange-peel" } })).toEqual({
	      color: "#506d92",
	      texture: "orange-peel",
	      roughness: 0.9,
	    });
	    expect(drywallPonyWallPreviewBackground({ drywallColor: "#506d92", drywallTexture: "smooth" })).toBe("#506d92");
	    expect(drywallPonyWallPreviewBackground({ drywallColor: "#506d92", drywallTexture: "orange-peel" })).toContain("radial-gradient");
	    expect(drywallPonyWallPreviewBackground({ drywallColor: "#506d92", drywallTexture: "light-plaster" })).toContain("repeating-linear-gradient");
	  });

	  it("keeps a free-standing legacy pony wall independent of any peninsula run", () => {
    const frame = ponyWallPlanFrame({
      uid: "legacy-pony-wall",
      x: 24,
      y: 36,
      width: 48,
      depth: 6,
      height: 34.5,
    }, room);

    expect(frame.attachedToPeninsula).toBe(false);
    expect(frame.start).toEqual({ x: 24, y: 36 });
    expect(frame.end).toEqual({ x: 72, y: 36 });
  });
});
