import { describe, expect, it } from "vitest";
import { cabinetCollisionDetail, RUN_SEAM_TOLERANCE_IN } from "./design";
import type { PlacedCabinet } from "./design";

const onRun = (uid: string, masterCode: string, wallOffset: number, width: number): PlacedCabinet => ({
  uid,
  cabinetId: 1,
  masterCode,
  description: masterCode,
  placement: "base",
  x: 0,
  y: 0,
  width,
  depth: 24,
  rotation: 135,
  wallId: "wall-4",
  wallOffset,
} as PlacedCabinet);

describe("along-run seam tolerance on angled walls", () => {
  it("treats floating-point noise at a butt joint as touching, not overlapping", () => {
    // A 45° wall length comes from a square root, so clamping to (length - 36)
    // can land a hair inside the neighbour that ends at 84.
    const neighbour = onRun("u2", "U249624", 60, 24);
    const drawer = onRun("db", "3DB36", 84 - 1e-7, 36);
    expect(cabinetCollisionDetail(drawer, [neighbour])).toBeNull();
  });

  it("still rejects a real overlap of 1/16 inch or more", () => {
    const neighbour = onRun("u2", "U249624", 60, 24);
    const drawer = onRun("db", "3DB36", 84 - 1 / 16, 36);
    expect(cabinetCollisionDetail(drawer, [neighbour])?.cabinet.masterCode).toBe("U249624");
    expect(RUN_SEAM_TOLERANCE_IN).toBeLessThan(1 / 16);
  });
});
