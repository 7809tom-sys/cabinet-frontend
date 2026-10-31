import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("auto-design applies the shared designer rules", () => {
  it("records the user's appliance placement and wiggles before tiling", () => {
    expect(pageSource).toContain("anchorOrigins.push({ uid: candidate.uid, kind: anchor.kind, wallId: wall.engineWallId, originalStart: along })");
    expect(pageSource).toContain("applyAutoDesignWiggleRoom({");
    expect(pageSource).toContain("origins: stage.anchorOrigins");
    const completion = pageSource.slice(pageSource.indexOf("const completeAutoDesignLayout"), pageSource.indexOf("finishAutoDesignLayoutRef.current = completeAutoDesignLayout"));
    expect(completion.indexOf("applyAutoDesignWiggleRoom({")).toBeGreaterThan(completion.indexOf("for (const slot of stage.slots)"));
    expect(completion.indexOf("planAutoDesignBaseSegment({")).toBeGreaterThan(completion.indexOf("applyAutoDesignWiggleRoom({"));
    expect(completion.indexOf("applyDesignerLayoutRules({")).toBeGreaterThan(completion.indexOf("planAutoDesignBaseSegment({"));
    expect(completion.indexOf("fillAutoDesignLowerSeams({")).toBeGreaterThan(completion.indexOf("applyDesignerLayoutRules({"));
  });

  it("does not tell the user that Auto-Design moved an appliance", () => {
    expect(pageSource).not.toContain("formatAutoDesignWiggleMessage");
    expect(pageSource).not.toContain("AutoDesignWiggleNotice");
    expect(pageSource).not.toContain("AutoDesignWiggleBadge");
    expect(pageSource).not.toContain("autoDesignWiggleMoves");
  });
});
