import { describe, expect, it } from "vitest";
import { planCabinetHardwarePosition, splitFillerDimensionTooltip } from "./PlanCanvas";

const b12 = (overrides: Record<string, unknown> = {}) => ({
  uid: "b12",
  cabinetId: 12,
  masterCode: "B-12",
  description: "12 inch base cabinet",
  placement: "base",
  x: 0,
  y: 0,
  width: 12,
  depth: 24,
  height: 34.5,
  rotation: 0,
  swing: "left",
  ...overrides,
} as never);

describe("Plan and 3D cabinet hardware parity", () => {
  it("retires a legacy centered B-12 handle to the same opposite-hinge side used by 3D", () => {
    expect(planCabinetHardwarePosition(b12({ hardwarePosition: "center" }))).toBe("right");
  });

  it("preserves explicit B-12 handle sides and retires top-center on an ordinary door (rule 5, Nov 13 2026)", () => {
    expect(planCabinetHardwarePosition(b12({ hardwarePosition: "left" }))).toBe("left");
    // Top center is kept only where it is a real choice (tray dividers, pull-outs, B15/B18).
    // On a plain B-12 door it drew a horizontal bar, so it returns to the opposite-hinge side like 3D.
    expect(planCabinetHardwarePosition(b12({ hardwarePosition: "top-center" }))).toBe(planCabinetHardwarePosition(b12({ hardwarePosition: "auto" })));
  });
});

describe("Plan split-filler measurements", () => {
  it("reports the exact total gap, selected half, adjoining half, depth, and height", () => {
    expect(splitFillerDimensionTooltip(b12({
      masterCode: "F3",
      description: "Installed split filler",
      width: 0.5,
      depth: 24,
      height: 34.5,
      fillerPieceGroupId: "split-filler-1",
      fillerPlacementMode: "split",
      fillerTotalWidth: 1,
    }))).toBe('Split filler gap: 1" total. This half: 1/2" wide × 24" deep × 34 1/2" high. Adjoining half: 1/2" wide.');
  });

  it("returns no split-filler tooltip for ordinary cabinets", () => {
    expect(splitFillerDimensionTooltip(b12())).toBeNull();
  });
});
