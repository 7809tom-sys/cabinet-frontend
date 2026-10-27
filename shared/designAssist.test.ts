import { describe, expect, it } from "vitest";
import { decideAssistAccess } from "./customerDirectory";
import { planAssistedRevision, planRevert, planSuggestedCopy, snapshotDesign, type DesignSnapshot } from "./designAssist";

const previous: DesignSnapshot = snapshotDesign({
  name: "Ada kitchen",
  roomData: { width: 120 },
  placedCabinets: [{ id: "a" }],
  selectedSurfaces: [],
  threeDPresentation: null,
  selectedStyleId: 2,
  selectedDistributorId: 5,
  projectName: "Maple job",
  roomLabel: "Kitchen",
  roomType: "kitchen",
});

describe("assisted design plans", () => {
  it("keeps the previous snapshot and does not delete the design", () => {
    const next = { ...previous, name: "Ada kitchen revised", placedCabinets: [{ id: "b" }] };
    const plan = planAssistedRevision(previous, next, "Maple Kitchens");
    expect(plan.mode).toBe("revision");
    if (plan.mode !== "revision") return;
    expect(plan.deletesDesign).toBe(false);
    expect(plan.preservesPrevious).toBe(true);
    expect(plan.snapshot.placedCabinets).toEqual([{ id: "a" }]);
    expect(plan.live.placedCabinets).toEqual([{ id: "b" }]);
    expect(plan.authorLabel).toBe("Edited by Maple Kitchens");
  });

  it("creates a suggestion without updating the original", () => {
    const plan = planSuggestedCopy(previous, { ...previous, name: "Suggested layout" }, 44);
    expect(plan.mode).toBe("suggestion");
    if (plan.mode !== "suggestion") return;
    expect(plan.updatesOriginal).toBe(false);
    expect(plan.deletesDesign).toBe(false);
    expect(plan.original).toEqual(previous);
    expect(plan.copy.recordKind).toBe("suggested");
    expect(plan.copy.suggestionOfDesignId).toBe(44);
    expect(plan.copy.assistLabel).toBe("Suggested by your designer");
  });

  it("reverts to the previous snapshot and keeps the current one", () => {
    const current = { ...previous, name: "Edited" };
    const plan = planRevert(current, previous);
    expect(plan.deletesDesign).toBe(false);
    expect(plan.live.name).toBe("Ada kitchen");
    expect(plan.preservedCurrent.name).toBe("Edited");
  });

  it("refuses a designer from another store", () => {
    const access = { affiliateId: 7, isOwner: true, accessCrm: true, accessDesigner: true };
    expect(decideAssistAccess({ role: "user", access, designAffiliateId: 8 }).ok).toBe(false);
    expect(decideAssistAccess({ role: "user", access: { ...access, isOwner: false, accessDesigner: false }, designAffiliateId: 7 }).ok).toBe(false);
    expect(decideAssistAccess({ role: "user", access, designAffiliateId: 7 }).ok).toBe(true);
  });
});
