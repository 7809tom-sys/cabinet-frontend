import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("four-anchor applies the shared designer rules", () => {
  it("records the user's appliance placement and wiggles before tiling", () => {
    expect(pageSource).toContain("anchorOrigins.push({ uid: candidate.uid, kind: anchor.kind, wallId: wall.engineWallId, originalStart: along })");
    expect(pageSource).toContain("applyFourAnchorWiggleRoom({");
    expect(pageSource).toContain("origins: stage.anchorOrigins");
    const completion = pageSource.slice(pageSource.indexOf("const completeFourAnchorAutoLayout"), pageSource.indexOf("const cancelFourAnchorCornerStage"));
    expect(completion.indexOf("applyFourAnchorWiggleRoom({")).toBeGreaterThan(completion.indexOf("for (const slot of stage.slots)"));
    expect(completion.indexOf("planFourAnchorBaseSegment({")).toBeGreaterThan(completion.indexOf("applyFourAnchorWiggleRoom({"));
    expect(completion.indexOf("applyDesignerLayoutRules({")).toBeGreaterThan(completion.indexOf("planFourAnchorBaseSegment({"));
    expect(completion.indexOf("fillFourAnchorLowerSeams({")).toBeGreaterThan(completion.indexOf("applyDesignerLayoutRules({"));
    expect(pageSource).toContain("formatAutoDesignWiggleMessage(move)");
    expect(pageSource).toContain("const reportedWiggleMoves = activeAutoDesignWiggleMoves(wiggle.moves, working, room)");
    expect(pageSource).toContain("setAutoDesignWiggleMoves(reportedWiggleMoves)");
    expect(pageSource).toContain("<AutoDesignWiggleNotice");
    expect(pageSource).toContain("autoDesignWiggleMoves={autoDesignWiggleMoves}");
  });
});
