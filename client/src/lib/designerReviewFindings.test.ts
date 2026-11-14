import { describe, expect, it } from "vitest";
import {
  autoDesignReportFindingLine,
  buildAutoDesignRulesReport,
  autoDesignRulesReportIsEmpty,
  autoDesignRunNotice,
  overRangeDefaultedFinding,
  type DesignerReviewFinding,
} from "./designerReviewFindings";

const warning: DesignerReviewFinding = {
  ruleId: "design-questions-honored",
  code: "range-neighbor-too-narrow",
  severity: "warning",
  title: "Landing beside the range is short",
  detail: "Only 5 in of counter.",
  wallLabel: "Wall 1",
  cabinetUid: null,
  cabinetCode: null,
};

const applied: DesignerReviewFinding = {
  ruleId: "auto-design-rule-11",
  code: "new-construction",
  severity: "info",
  title: "New construction",
  detail: "Dimensions were free to adjust within the room.",
  wallLabel: null,
  cabinetUid: null,
  cabinetCode: null,
};

describe("buildAutoDesignRulesReport", () => {
  it("groups unmet, applied, and defaulted findings without dropping wording", () => {
    const defaulted = overRangeDefaultedFinding();
    const report = buildAutoDesignRulesReport([warning, applied, defaulted]);
    expect(report.unmet).toEqual([
      "Landing beside the range is short (Wall 1) — Only 5 in of counter.",
    ]);
    expect(report.applied).toEqual([
      "New construction — Dimensions were free to adjust within the room.",
    ]);
    expect(report.changeable).toEqual([autoDesignReportFindingLine(defaulted)]);
    expect(defaulted.detail).toMatch(/You can change this after the build/);
    expect(autoDesignRulesReportIsEmpty(report)).toBe(false);
  });

  it("is empty when there are no findings", () => {
    expect(autoDesignRulesReportIsEmpty(buildAutoDesignRulesReport([]))).toBe(true);
  });
});

describe("autoDesignRunNotice", () => {
  it("keeps the exact toast sentence and routes warning vs info into the right group", () => {
    const warningNote = autoDesignRunNotice({
      text: "The faucet window was raised 2 in so the spout clears the sash.",
      kind: "warning",
      code: "faucet-window",
    });
    const appliedNote = autoDesignRunNotice({
      text: "Moved the range 3 in away from the corner to fit the required corner cabinet. Its measured center is now 24 in along the wall.",
      kind: "info",
      code: "appliance-move",
    });
    const shift = autoDesignRunNotice({
      text: "The landing is tight.",
      kind: "warning",
      code: "shift-review",
      title: "Landing beside the range is short",
      detail: "The landing is tight.",
    });
    const report = buildAutoDesignRulesReport([warningNote, appliedNote, shift]);
    expect(report.unmet).toEqual([
      "The faucet window was raised 2 in so the spout clears the sash.",
      "Landing beside the range is short — The landing is tight.",
    ]);
    expect(report.applied).toEqual([
      "Moved the range 3 in away from the corner to fit the required corner cabinet. Its measured center is now 24 in along the wall.",
    ]);
  });
});
