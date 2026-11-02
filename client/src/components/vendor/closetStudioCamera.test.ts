import { describe, expect, it } from "vitest";
import { closetCabinetCorners, frameClosetStudioCamera, projectClosetPoint, type ClosetAabb } from "./closetStudioCamera";

/** Two 24 in towers: about 4.2 ft wide and 7.25 ft tall, 14.5 in deep. */
const cabinet: ClosetAabb = { minX: 0, minY: 0, minZ: 0, maxX: 4.19, maxY: 7.25, maxZ: 1.21 };

function expectCabinetInFrame(aspect: number, view: "angle" | "front" | "overhead" = "angle") {
  const frame = frameClosetStudioCamera(cabinet, aspect, { view });
  expect(frame.position.z).toBeGreaterThan(cabinet.maxZ);
  expect(frame.minDistance).toBeCloseTo(frame.distance, 5);
  expect(frame.distance).toBeLessThan(frame.maxDistance);
  expect(frame.near).toBeLessThan(frame.distance - 1);
  const projected = closetCabinetCorners(cabinet).map((corner) => projectClosetPoint(corner, frame, aspect));
  for (const point of projected) {
    expect(point.depth).toBeGreaterThan(frame.near);
    expect(Math.abs(point.x)).toBeLessThan(0.94);
    expect(Math.abs(point.y)).toBeLessThan(0.94);
  }
  const ys = projected.map((point) => point.y);
  const xs = projected.map((point) => point.x);
  const topGap = 1 - Math.max(...ys);
  const bottomGap = Math.min(...ys) + 1;
  expect(Math.abs(topGap - bottomGap)).toBeLessThan(view === "overhead" ? 0.22 : 0.05);
  expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2)).toBeLessThan(0.08);
  const center = projectClosetPoint(
    { x: 2.095, y: 3.625, z: 0.6 },
    frame,
    aspect,
  );
  expect(Math.abs(center.x)).toBeLessThan(0.08);
  expect(Math.abs(center.y)).toBeLessThan(0.08);
  expect(frame.target.y).toBeCloseTo(3.625, 2);
  return frame;
}

describe("closet studio camera", () => {
  it("fits the cabinet, not a wide wall, on Tom's short desktop and a narrow third of it", () => {
    const wide = expectCabinetInFrame(1024 / 576);
    const third = expectCabinetInFrame((1024 / 3) / 480);
    const tall = expectCabinetInFrame(1440 / 900);
    expect(third.distance).toBeGreaterThan(wide.distance * 0.9);
    expect(tall.position.z).toBeGreaterThan(cabinet.maxZ + 2);
    expectCabinetInFrame(1920 / 1072);
    expectCabinetInFrame(390 / 700);
  });

  it("keeps the front and overhead cameras on the interior side of the back wall", () => {
    for (const view of ["front", "overhead"] as const) {
      const frame = expectCabinetInFrame(1.4, view);
      expect(frame.position.z).toBeGreaterThan(0);
    }
    const overhead = frameClosetStudioCamera(cabinet, 1.2, { view: "overhead" });
    expect(overhead.position.y).toBeGreaterThan(cabinet.maxY);
  });
});
