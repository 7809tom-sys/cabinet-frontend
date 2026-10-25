import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const elevation = readFileSync(resolve(process.cwd(), "client/src/components/design/ElevationView.tsx"), "utf8");
const threeD = readFileSync(resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");

describe("stacked glass crown rendering", () => {
  it("uses the shared stack-aware crown eligibility list in elevation and 3D", () => {
    expect(elevation).toContain("crownEligibleCabinets(sorted, room)");
    expect(threeD).toContain("const cabinets = crownEligibleCabinets(placed, room)");
  });
});
