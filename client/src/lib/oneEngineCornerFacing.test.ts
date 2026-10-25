import { describe, expect, it } from "vitest";
import { appendWallBuilderSegment, wallBuilderRoomGeometry, type WallBuilderSegment } from "./polygonRoom";
import {
  cabinetWall,
  cabinetWallMovePreview,
  cornerRotationForPlaced,
  nextAvailableRoomCornerPlacement,
  wallRunFrame,
  wallRunJoinAt,
  type PlacedCabinet,
  type RoomData,
  type WallRunFrame,
} from "./design";
import { existingCabinetTransform, threeDCornerBodyDimensions } from "@/components/design/InteractiveRoom3D";

/**
 * User bug (2026-09-30): a corner upper on a Wall Builder wall rendered
 * backwards (door facing the wall). A corner body's saved plan rotation only
 * names an axis (0 and 180 draw the same footprint); which way that axis faces
 * must come from the wall run the body is seated on. This suite proves the ONE
 * facing rule for corner uppers and corner bases at 90° and 45° corners in a
 * standard room and in a Wall Builder room: in 3D the body's back edge lies on
 * the wall and its front points into the room, and the plan clip turn equals
 * the seated turn.
 */

function drawnRoom(): RoomData {
  let segments: WallBuilderSegment[] = [];
  segments = appendWallBuilderSegment(segments, 120, "start");
  segments = appendWallBuilderSegment(segments, 96, "right90");
  segments = appendWallBuilderSegment(segments, 60, "right45");
  segments = appendWallBuilderSegment(segments, 96, "right45");
  const result = wallBuilderRoomGeometry(segments);
  if (!result.room) throw new Error(result.error ?? "Expected a measured room path");
  return { ...result.room, ceilingHeight: 96 };
}

const STANDARD: RoomData = { width: 120, depth: 96, ceilingHeight: 96 };
const DRAWN = drawnRoom();

const CORNER_BODIES = [
  { code: "WDC2442", placement: "wall" as const, width: 24, depth: 24, height: 42, cornerType: "diagonal" },
  { code: "WER2430", placement: "wall" as const, width: 24, depth: 24, height: 30, cornerType: "lazy-susan" },
  { code: "LSB36", placement: "base" as const, width: 36, depth: 36, height: 34.5, cornerType: "lazy-susan" },
  { code: "ERB36", placement: "base" as const, width: 36, depth: 36, height: 34.5, cornerType: "lazy-susan" },
];

function body(sample: typeof CORNER_BODIES[number], x = 0, y = 0): PlacedCabinet {
  return {
    uid: sample.code,
    cabinetId: 1,
    masterCode: sample.code,
    description: sample.code,
    placement: sample.placement,
    x,
    y,
    width: sample.width,
    depth: sample.depth,
    height: sample.height,
    rotation: 0,
    cornerType: sample.cornerType,
  } as PlacedCabinet;
}

/** World-space 3D footprint corners of the rendered body (plan x / plan y). */
function worldCorners(cabinet: PlacedCabinet, room: RoomData) {
  const t = existingCabinetTransform(cabinet, room);
  const dims = threeDCornerBodyDimensions(cabinet);
  const w = dims?.width ?? cabinet.width;
  const d = dims?.depth ?? cabinet.depth;
  const world = (px: number, pz: number) => ({
    x: t.x + px * Math.cos(t.rotation) + pz * Math.sin(t.rotation),
    y: t.z - px * Math.sin(t.rotation) + pz * Math.cos(t.rotation),
  });
  return { backLeft: world(-w / 2, -d / 2), backRight: world(w / 2, -d / 2), frontRight: world(w / 2, d / 2) };
}

const inwardDistance = (frame: WallRunFrame, p: { x: number; y: number }) =>
  (p.x - frame.start.x) * frame.inward.x + (p.y - frame.start.y) * frame.inward.y;

describe("one-engine corner facing: corner uppers and bases face the room on every wall kind", () => {
  const drawnWalls = DRAWN.customWalls!;
  const ninetyJoinFrame = wallRunFrame(drawnWalls[1]!.id, DRAWN)!;
  expect(wallRunJoinAt(ninetyJoinFrame, "start", DRAWN)?.turnDeg).toBe(90);

  const NINETY_CORNERS = [
    ["standard room, back-right corner", STANDARD, { x: 120, y: 0 }],
    ["standard room, front-left corner", STANDARD, { x: 0, y: 96 }],
    ["Wall Builder room, 90° join", DRAWN, ninetyJoinFrame.start],
  ] as const;

  for (const [label, room, vertex] of NINETY_CORNERS) {
    for (const sample of CORNER_BODIES) {
      it(`${sample.code} seated at the ${label} lands its back corner on the vertex and faces the room`, () => {
        const candidate = body(sample, vertex.x - sample.width / 2, vertex.y - sample.depth / 2);
        const spot = nextAvailableRoomCornerPlacement(candidate, cabinetWall(candidate, room), room, [], vertex);
        expect(spot, "shared corner seat must exist at a 90° join").not.toBeNull();
        const seated = { ...candidate, ...spot! };
        // Plan clip turn is the seated turn (no rectangle re-inference).
        expect(cornerRotationForPlaced(seated, room)).toBe(((Math.round(seated.rotation) % 360) + 360) % 360);
        // 3D: the wall corner of the body sits on the room vertex.
        const { backLeft } = worldCorners(seated, room);
        expect(Math.hypot(backLeft.x - vertex.x, backLeft.y - vertex.y)).toBeLessThan(0.01);
        // 3D: the front is inside the room, away from the owning wall.
        const frame = wallRunFrame(seated.wallId!, room)!;
        expect(inwardDistance(frame, worldCorners(seated, room).frontRight)).toBeGreaterThan(1);
      });
    }
  }

  it("standard and Wall Builder 90° corners produce the same 3D facing for the same body", () => {
    for (const sample of CORNER_BODIES) {
      const std = body(sample, 120 - sample.width / 2, -sample.depth / 2);
      const stdSpot = nextAvailableRoomCornerPlacement(std, "top", STANDARD, [], { x: 120, y: 0 })!;
      const drawn = body(sample, ninetyJoinFrame.start.x - sample.width / 2, ninetyJoinFrame.start.y - sample.depth / 2);
      const drawnSpot = nextAvailableRoomCornerPlacement(drawn, drawnWalls[0]!.id, DRAWN, [], ninetyJoinFrame.start)!;
      const a = existingCabinetTransform({ ...std, ...stdSpot }, STANDARD).rotation;
      const b = existingCabinetTransform({ ...drawn, ...drawnSpot }, DRAWN).rotation;
      const norm = (r: number) => ((Math.round((r * 180) / Math.PI) % 360) + 360) % 360;
      expect(norm(b), sample.code).toBe(norm(a));
    }
  });

  const fortyFive = wallRunFrame(drawnWalls[2]!.id, DRAWN)!;
  expect(wallRunJoinAt(fortyFive, "start", DRAWN)?.turnDeg).toBe(45);

  for (const sample of CORNER_BODIES) {
    it(`${sample.code} seated on the 45° Wall Builder wall keeps its back on the wall and its front in the room`, () => {
      const mid = { x: (fortyFive.start.x + fortyFive.end.x) / 2, y: (fortyFive.start.y + fortyFive.end.y) / 2 };
      const candidate = body(sample, mid.x - sample.width / 2, mid.y - sample.depth / 2);
      const preview = cabinetWallMovePreview(candidate, candidate, DRAWN, [], [], { magnet: true, wallId: fortyFive.id });
      expect(preview.candidate).not.toBeNull();
      const seated = preview.candidate!;
      expect(seated.wallId).toBe(fortyFive.id);
      const corners = worldCorners(seated, DRAWN);
      expect(Math.abs(inwardDistance(fortyFive, corners.backLeft))).toBeLessThan(0.01);
      expect(Math.abs(inwardDistance(fortyFive, corners.backRight))).toBeLessThan(0.01);
      expect(inwardDistance(fortyFive, corners.frontRight)).toBeGreaterThan(1);
    });
  }

  it("the Gemini test room (45° wall + half wall) never renders a corner upper facing the wall, in any orientation", () => {
    // Regression for the reported screenshot: rotate the drawn room through
    // all four quadrants so every 0°/45°/90°/135°… wall heading is covered.
    const rotate = (deg: number): RoomData => {
      const r = (deg * Math.PI) / 180;
      const pts = DRAWN.vertices!.map((v) => ({ id: v.id, x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) }));
      const minX = Math.min(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      return { ...DRAWN, vertices: pts.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY })) };
    };
    for (const deg of [0, 90, 180, 270]) {
      const room = rotate(deg);
      for (const wall of room.customWalls!) {
        const frame = wallRunFrame(wall.id, room)!;
        for (const sample of CORNER_BODIES.filter((s) => s.placement === "wall")) {
          const mid = { x: (frame.start.x + frame.end.x) / 2, y: (frame.start.y + frame.end.y) / 2 };
          const candidate = body(sample, mid.x - sample.width / 2, mid.y - sample.depth / 2);
          const seated = cabinetWallMovePreview(candidate, candidate, room, [], [], { magnet: true, wallId: wall.id }).candidate!;
          const corners = worldCorners(seated, room);
          expect(Math.abs(inwardDistance(frame, corners.backLeft)), `${sample.code} @${deg}° ${wall.id}`).toBeLessThan(0.01);
          expect(inwardDistance(frame, corners.frontRight), `${sample.code} @${deg}° ${wall.id}`).toBeGreaterThan(1);
        }
      }
    }
  });
});
