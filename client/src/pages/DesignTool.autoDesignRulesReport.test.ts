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
  const announce = between(designTool, "const announceFaucetWindowNotes = useCallback", "const layoutHasRefrigerator");

  it("shows findings on the Auto Design report panel instead of a review pop-up or toast", () => {
    expect(designTool).toContain("<AutoDesignReviewList");
    expect(designTool).toContain("findings={autoDesignReviewFindings}");
    expect(designTool).toContain("open={autoDesignReportOpen}");
    expect(designTool).not.toContain("designerReviewLines(");
    expect(build).not.toContain("need review");
    expect(build).not.toContain("toast.warning(`${named.length}");
    expect(build).toContain("publishAutoDesignReport(reviewFindings)");
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

  it("routes former per-rule toasts into the report and keeps only a short finished notice", () => {
    expect(designTool).toContain('toast.success("Auto Design finished.")');
    expect(build).not.toMatch(/toast\.(info|warning|success)/);
    expect(complete).not.toMatch(/toast\.(info|warning|success)/);
    expect(build).toContain('code: "placed-summary"');
    expect(build).toContain('"run-note"');
    expect(build).toContain('code: "appliance-move"');
    expect(build).toContain('code: "upper-height"');
    expect(build).toContain('code: "upper-review"');
    expect(build).toContain('code: "run-warning"');
    expect(build).toContain('code: "sink-window"');
    expect(complete).toContain('code: "placed-summary"');
    expect(complete).toContain('code: "mandatory-bridge-note"');
    expect(complete).toContain('code: "seam-note"');
    expect(complete).toContain('code: "appliance-move"');
    expect(complete).toContain('code: "upper-height"');
    expect(complete).toContain('code: "upper-review"');
    expect(complete).toContain('code: "shift-review"');
    expect(complete).toContain('code: "sink-window"');
    expect(announce).toContain('code: "faucet-window"');
    expect(announce).toContain("autoDesignReportCollectingRef.current");
    expect(announce).toContain("toast.warning(note.text, { duration: 8000 })");
  });

  it("resets findings at the start of each run instead of appending across runs", () => {
    expect(build).toContain("startAutoDesignReportRun()");
    expect(complete).toContain("startAutoDesignReportRun()");
    expect(build.indexOf("startAutoDesignReportRun()")).toBeLessThan(build.indexOf("publishAutoDesignReport(reviewFindings)"));
    expect(complete.indexOf("startAutoDesignReportRun()")).toBeLessThan(complete.indexOf("publishAutoDesignReport(reviewFindings)"));
    expect(complete).not.toContain("setAutoDesignReviewFindings((current) => [...current, ...mandatoryBridge.findings])");
    expect(complete).not.toContain("setAutoDesignReviewFindings((current) => [...current, overRangeDefaultedFinding()])");
    expect(complete).toContain("reviewFindings.push(...mandatoryBridge.findings)");
    expect(complete).toContain("reviewFindings.push(overRangeDefaultedFinding())");
    expect(designTool).toContain("setAutoDesignReviewFindings([])");
  });

  it("can reopen the last report after dismiss", () => {
    expect(designTool).toContain("onDismiss={() => setAutoDesignReportOpen(false)}");
    expect(designTool).toContain("onReopen={() => setAutoDesignReportOpen(true)}");
  });
});
