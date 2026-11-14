import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThan(-1);
  const to = source.indexOf(end, from);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("Auto Design end-of-flow rules report", () => {
  const build = between(designTool, "const buildAutoDesignLayout = useCallback", "const completeAutoDesignLayout = useCallback");
  const complete = between(designTool, "const completeAutoDesignLayout = useCallback", "finishAutoDesignLayoutRef.current = completeAutoDesignLayout");

  it("shows findings on the Auto Design report panel instead of a review pop-up or toast", () => {
    expect(designTool).toContain("<AutoDesignReviewList");
    expect(designTool).toContain("findings={autoDesignReviewFindings}");
    expect(designTool).not.toContain("designerReviewLines(");
    expect(build).not.toContain("need review");
    expect(build).not.toContain("toast.warning(`${named.length}");
    expect(build).toContain("setAutoDesignReviewFindings(reviewFindings)");
  });

  it("defaults a missing over-range answer on both build paths and never opens the end-of-flow range pop-up", () => {
    expect(build).toContain("resolveAutoDesignOverRangeAnswer(input.overRangeAnswer)");
    expect(build).toContain("overRangeAnswerToPersist(current.overRangeAnswer, overRangeResolved.value)");
    expect(build).toContain("overRangeDefaultedFinding()");
    expect(build).not.toContain("setAutoDesignRangeVentPrompt({ rangeUid: run.bareRangeUid })");
    expect(complete).toContain("resolveAutoDesignOverRangeAnswer(stage.input.overRangeAnswer)");
    expect(complete).toContain("overRangeDefaultedFinding()");
    expect(complete).not.toContain("setAutoDesignRangeVentPrompt({ rangeUid: bareRange.uid })");
  });
});
