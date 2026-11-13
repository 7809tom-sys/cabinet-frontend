/**
 * The mandatory 3" blind-corner base filler (owner rule: "a blind corner base
 * always comes with a 3-inch filler next to it"). Tom found a BBC42 seated with
 * no filler beside it: the seal ran, then the stock-closing and consolidation
 * passes reshaped the runs after it. The build now seals last as well.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./autoDesignLayout.ts", import.meta.url), "utf8");

function indexOfAll(haystack: string, needle: string): number[] {
  const hits: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return hits;
    hits.push(at);
    from = at + needle.length;
  }
}

describe("blind corner base filler", () => {
  it("is sealed after the passes that can reshape the runs, not only before them", () => {
    const seals = indexOfAll(source, "ensureRequiredBlindCornerBaseFillers({");
    const closing = source.indexOf("closeSmallOpeningsWithStock({");
    const consolidation = source.indexOf("consolidateAutoDesignFillers({");
    expect(seals.length).toBeGreaterThanOrEqual(3);
    const lastSeal = seals[seals.length - 1]!;
    expect(lastSeal).toBeGreaterThan(closing);
    expect(lastSeal).toBeGreaterThan(consolidation);
  });

  it("reports the reason when the filler cannot be seated", () => {
    expect(source).toContain("finalBlindSeal.notes");
  });
});
