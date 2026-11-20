/**
 * Glass needs a matching upper width (Tom, Nov 20 2026).
 *
 * The failure this prevents: the wall run picks a 9 in upper, the line sells no 9 in
 * stacker, and under the all-or-nothing glass rule the whole run loses its glass.
 */
import { describe, expect, it } from "vitest";
import { autoDesignGlassWidths, onlyGlassCapableUppers } from "./autoDesignGlassWidths";

type Row = { masterCode: string; width: number; height: number; placement: string; family?: string };
const row = (masterCode: string, width: number, height: number): Row =>
  ({ masterCode, width, height, placement: "wall", family: "wall" });

const catalog = [
  row("W1830", 18, 30),
  row("W2130", 21, 30),
  row("W0930", 9, 30),
  row("W3630", 36, 30),
  row("GD1812", 18, 12),
  row("GD2115", 21, 15),
  row("GD2418", 24, 18),
  row("DCW2430", 24, 30),
] as never[];

describe("glass-capable uppers", () => {
  it("reads the widths the line can actually glaze", () => {
    expect(autoDesignGlassWidths(catalog)).toEqual([18, 21, 24]);
  });

  it("drops the upper widths with no stacker", () => {
    const kept = onlyGlassCapableUppers(catalog).map((entry) => String((entry as { masterCode: string }).masterCode));
    expect(kept).not.toContain("W0930");
    expect(kept).not.toContain("W3630");
    expect(kept).toContain("W1830");
    expect(kept).toContain("W2130");
  });

  it("keeps the stackers themselves and the corner cabinets", () => {
    const kept = onlyGlassCapableUppers(catalog).map((entry) => String((entry as { masterCode: string }).masterCode));
    expect(kept).toContain("GD1812");
    expect(kept).toContain("GD2418");
    expect(kept).toContain("DCW2430");
  });

  it("changes nothing on a line that sells no stackers", () => {
    const noGlass = [row("W1830", 18, 30), row("W0930", 9, 30)] as never[];
    expect(onlyGlassCapableUppers(noGlass)).toHaveLength(2);
  });
});