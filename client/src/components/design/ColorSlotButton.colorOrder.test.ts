import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ColorSlotButton color ordering", () => {
  it("uses the shared light-to-deep ordering before filtering the picker grid", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/components/design/ColorSlotButton.tsx"),
      "utf8",
    );

    expect(source).toContain('import { doorStyleColorHex, orderDoorStylesByColor } from "@/lib/doorColorSpectrum";');
    expect(source).toContain("applyFilters(orderDoorStylesByColor(list), seriesName)");
  });
});
