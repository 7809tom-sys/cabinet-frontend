import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url), "utf8");

describe("PlanCanvas angled filler", () => {
  it("keeps legacy one-edge 45-degree filler rendering compatible", () => {
    expect(source).toContain("isMiteredAngledWallFiller");
    expect(source).toContain("miterClipPath");
    expect(source).toContain("data-angled-wall-mitered-filler");
    expect(source).toContain("45° MITER FILLER");
  });

  it("draws each current transition member from its exact front-only miter footprint", () => {
    expect(source).toContain('const isFrontMiterPair = p.fillerTransitionKind === "front-miter-pair"');
    expect(source).toContain("angledWallTransitionFootprint");
    expect(source).toContain("fillerTransitionPlanFootprint");
    expect(source).toContain("transitionClipPath");
    expect(source).toContain("data-angled-wall-transition-filler");
    expect(source).toContain("22.5° FRONT FILLER");
    expect(source).toContain("Together the pair forms one tight 45° turn");
    expect(source).toContain("source-priced");
  });

  it("keeps normal cabinet clipping for every non-transition placement", () => {
    expect(source).toContain(": planCabinetClipPath(p, room)");
  });
});
