import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/design/PlanCanvas.tsx"), "utf8");

describe("PlanCanvas peninsula attachment measurement", () => {
  it("shows the measured parent-wall segment for a primary peninsula but not a connected return", () => {
    expect(source).toContain("const primaryAttachmentMeasure = !run.parentRunId && parentWall");
    expect(source).toContain('data-testid="peninsula-attachment-measurement"');
    expect(source).toContain("Wall start → peninsula · {formatEighthInches(primaryAttachmentMeasure)}");
    expect(source).toContain("displayed outside the room so it does not cover cabinets");
    expect(source).toContain('top: parentWall === "top" ? -25 : roomPxH + 10');
  });

  it("names the straight run and a 45-degree return directly on the plan", () => {
    expect(source).toContain('data-testid="peninsula-plan-label"');
    expect(source).toContain('`PENINSULA · ${run.turn}° ${run.direction} RETURN`');
    expect(source).toContain('`PENINSULA · ${formatEighthInches(run.length)}`');
  });
});
