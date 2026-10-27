import { describe, expect, it } from "vitest";
import { CRM_STAGES, CRM_STAGE_LABELS, isClosedStage, isWonRevenueStage } from "./crm";
import { CRM_STAGE_COLORS, summarizeAffiliatePipelines } from "./crmMailbox";
import { weightForDesign } from "./salesForecast";
import { PLACEHOLDER_CLOSE_BRACKETS } from "./closeRateBrackets";
import { statusFromStage } from "./customerDirectory";

describe("New Sale stage", () => {
  it("sits beside New and counts as closed won revenue", () => {
    expect(CRM_STAGES.slice(0, 2)).toEqual(["new", "new_sale"]);
    expect(CRM_STAGES).toContain("won");
    expect(CRM_STAGES).toContain("lost");
    expect(CRM_STAGE_LABELS.new_sale.en).toBe("New Sale");
    expect(CRM_STAGE_COLORS.new_sale).toBeTruthy();
    expect(isClosedStage("new_sale")).toBe(true);
    expect(isWonRevenueStage("new_sale")).toBe(true);
    expect(isWonRevenueStage("qualified")).toBe(false);
    expect(statusFromStage("new_sale")).toBe("won");
    const totals = summarizeAffiliatePipelines([
      { id: 1, title: "Open", stage: "qualified", priority: "medium", contactName: null, contactEmail: null, company: null, estimatedValue: "100", nextFollowUpAt: null, affiliateId: null },
      { id: 2, title: "Sold", stage: "new_sale", priority: "high", contactName: null, contactEmail: null, company: null, estimatedValue: "520", nextFollowUpAt: null, affiliateId: null },
    ], {});
    expect(totals[0]).toMatchObject({ openCount: 1, openValue: 100, wonCount: 1 });
    expect(weightForDesign({ updatedAt: "2026-03-01T00:00:00Z", ordered: false, crmStage: "new_sale" }, PLACEHOLDER_CLOSE_BRACKETS)).toMatchObject({ reason: "won", rate: 1 });
  });
});
