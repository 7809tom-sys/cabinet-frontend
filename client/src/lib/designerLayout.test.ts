import { describe, expect, it } from "vitest";
import { DESIGNER_CANVAS_CONTAINER_CLASS, DESIGNER_CONSULTANT_PLACEMENT } from "./designerLayout";

describe("designer mobile layout contract", () => {
  it("retains a visible canvas height and places the consultant with room controls", () => {
    expect(DESIGNER_CANVAS_CONTAINER_CLASS).toContain("min-h-[300px]");
    expect(DESIGNER_CANVAS_CONTAINER_CLASS).toContain("flex-col");
    expect(DESIGNER_CANVAS_CONTAINER_CLASS).toContain("flex-1");
    expect(DESIGNER_CANVAS_CONTAINER_CLASS).toContain("lg:min-h-0");
    expect(DESIGNER_CANVAS_CONTAINER_CLASS).toContain("overflow-hidden");
    expect(DESIGNER_CONSULTANT_PLACEMENT).toBe("room-controls");
  });
});
