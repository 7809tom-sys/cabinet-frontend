import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("peninsula Auto-fill workflow", () => {
  it("routes an active-peninsula catalog drop through the same first-clear resolver as a catalog click", () => {
    expect(source).toContain("const firstClearPeninsulaSpot = activePeninsulaRun");
    expect(source).toContain("normalizeLegacyPeninsulaCabinets(placedRef.current, room)");
    expect(source).toContain("wallOffset: firstClearPeninsulaSpot.wallOffset ?? 0");
  });

  it("uses first-clear placement for an active peninsula and never persists a generic filler placeholder", () => {
    expect(source).toContain("const isActivePeninsula = Boolean(peninsulaRunById(room, activeWall));");
    expect(source).toContain("firstCollisionFreePeninsulaPlacement(activeWall, room, working, width, depth, \"base\")");
    expect(source).toContain("const catalogFillerCandidate = it.isFiller");
    expect(source).toContain("const catalogFiller = catalogFillerCandidate");
    expect(source).toContain("catalogFillerForGap(pool, it.width, \"base\")");
    expect(source).toContain("if (it.isFiller && !catalogFiller)");
    expect(source).toContain("fittedCatalogFillerDescription(c, width)");
  });
});
