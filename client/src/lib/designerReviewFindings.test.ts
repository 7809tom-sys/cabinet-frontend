import { describe, expect, it } from "vitest";
import {
  autoDesignReportFindingLine,
  buildAutoDesignRulesReport,
  autoDesignRulesReportIsEmpty,
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
