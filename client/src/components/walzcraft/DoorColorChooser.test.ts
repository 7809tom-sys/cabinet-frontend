import { describe, expect, it } from "vitest";
import { explainDoorPaint } from "./DoorColorChooser";
import { standardShakerDlFacePlan } from "@shared/shakerDoorBlueprint";

describe("door color source", () => {
  it("names the saved render hex as the paint and does not mention a brand snap", () => {
    const explained = explainDoorPaint({ doorStyle: "Shaker", ourName: "Fresh Sage", color: "#8faf8a", renderHex: "#244338", sheetColor: "Classic White" });
    expect(explained.hex).toBe("#244338");
    expect(explained.sentence).toContain("saved render hex");
    expect(explained.sentence).toContain("Classic White");
    expect(explained.sentence).toContain("not the paint");
    expect(standardShakerDlFacePlan({ doorStyle: "Shaker", railWidth: 3, color: "#8faf8a", renderHex: "#244338" }, "base")?.dlcCrop?.solidColor).toBe("#244338");
  });

  it("says a color name is a guess when no hex is saved", () => {
    const explained = explainDoorPaint({ doorStyle: "Shaker", ourName: "White Shaker", color: "White" });
    expect(explained.sentence).toContain("guessed from the color name");
    expect(explained.hex).toBe("#f7f6f3");
  });
});
