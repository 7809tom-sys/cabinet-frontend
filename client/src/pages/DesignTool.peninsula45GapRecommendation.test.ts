import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("45-degree peninsula return cabinet recommendation", () => {
  it("recommends only a real compatible base from the active priced line and allows direct placement", () => {
    expect(source).toContain("const activePeninsulaGapRecommendation = useMemo");
    expect(source).toContain("if (!run || run.turn !== 45) return null;");
    expect(source).toContain('freeSegmentsOnWall(run.id as WallSide, room, placed, openings, 9)');
    expect(source).toContain('!/^FILL[-_ ]?\\d/.test(code)');
    expect(source).toContain('!isCornerBase(cabinet)');
    expect(source).toContain('data-testid="peninsula-45-gap-recommendation"');
    expect(source).toContain("Recommended from the active priced cabinet line");
    expect(source).toContain("addCabinet(activePeninsulaGapRecommendation.cabinet)");
  });
});
