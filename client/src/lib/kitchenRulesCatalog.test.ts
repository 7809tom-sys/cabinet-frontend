import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KITCHEN_ADJACENCY_RULES } from "./kitchenAdjacencyRules";
import { KITCHEN_RULE_SEED } from "./kitchenRulesCatalog";
import { autoDesignShiftLimitIn } from "./designerLayoutRules";
import { resetKitchenRuleParameters, setKitchenRuleParameters } from "./kitchenRuleParameters";
import { kitchenRulesToCsv, kitchenRulesToMarkdown, statusLabel } from "./kitchenRulesApi";
import { rangeBridgeSpec } from "./kitchenAdjacency";

const adminPage = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
const grouped = readFileSync(resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"), "utf8");

describe("kitchen rules catalog", () => {
  it("includes every research rule plus the owner rules", () => {
    const codes = KITCHEN_RULE_SEED.map((rule) => rule.ruleCode);
    expect(new Set(codes).size).toBe(codes.length);
    for (const rule of KITCHEN_ADJACENCY_RULES) expect(codes).toContain(rule.id);
    expect(codes).toEqual(expect.arrayContaining([
      "owner-jog-3",
      "owner-measured-fridge-corner-shift",
      "owner-range-fridge-15",
      "owner-filler-gap-3",
      "owner-filler-cut-2-5",
      "owner-molding-extra-stick",
      "owner-fridge-panel-24",
      "owner-over-fridge-24",
      "owner-u-shape-two-corners",
      "owner-blind-door-open-run",
      "owner-corner-fit",
      "owner-blind-corner-fallback",
      "owner-wall-bottom-54",
      "owner-24-at-66",
      "owner-bridge-cabinets",
      "owner-run-top-96",
      "owner-hood-bottom-60",
      "owner-baking-zone",
      "owner-heavy-cook-landing",
      "owner-sink-base-false-front",
      "owner-stock-prompt",
      "conflict-gas-hood-30",
      "conflict-fridge-panel-25",
    ]));
    expect(KITCHEN_RULE_SEED.find((rule) => rule.ruleCode === "owner-molding-extra-stick")?.notesText).toMatch(/craftsmanship/);
    expect(KITCHEN_RULE_SEED.find((rule) => rule.ruleCode === "owner-fridge-panel-24")?.notesText).toMatch(/30 inch panel cut down to 24/);
    expect(KITCHEN_RULE_SEED.find((rule) => rule.ruleCode === "owner-24-at-66")?.implementationStatus).toBe("reference");
    expect(KITCHEN_RULE_SEED.find((rule) => rule.ruleCode === "conflict-gas-hood-30")?.implementationStatus).toBe("reference");
  });

  it("lists the all-mosaics hard rule as an implemented auto rule in the Backsplash category", () => {
    const rule = KITCHEN_RULE_SEED.find((item) => item.ruleCode === "owner-mosaic-interlock");
    expect(rule).toMatchObject({ category: "Backsplash", enforcementKind: "auto", implementationStatus: "implemented" });
    expect(rule!.title).toBe("All mosaics show no sheet edges");
    expect(rule!.ruleDescription).toContain("Every mosaic in the catalog");
    expect(rule!.ruleDescription).not.toContain("Golden Trace");
  });

  it("keeps Kitchen Rules off the designer and sales-rep admin screens", () => {
    const designerBlock = adminPage.slice(adminPage.indexOf("if (isDesigner)"), adminPage.indexOf("return (", adminPage.indexOf("if (isDesigner)") + 20));
    const salesBlock = adminPage.slice(adminPage.indexOf("if (isSalesRep)"), adminPage.indexOf("if (isDesigner)"));
    expect(designerBlock).not.toContain("Kitchen Rules");
    expect(salesBlock).not.toContain("Kitchen Rules");
    expect(grouped).toContain('label: "Kitchen Rules"');
    expect(adminPage).toContain("<AdminGroupedTabs />");
  });
});

describe("stored kitchen rule parameters", () => {
  it("uses the code default until an admin value is loaded", () => {
    resetKitchenRuleParameters();
    expect(autoDesignShiftLimitIn("sink")).toBe(3);
    expect(autoDesignShiftLimitIn("stove")).toBe(3);
    setKitchenRuleParameters({ jog_max_in: 2 });
    expect(autoDesignShiftLimitIn("sink")).toBe(2);
    expect(rangeBridgeSpec({ rangeWidthIn: 30, hangsBelow: true }).bottomIn).toBe(72);
    setKitchenRuleParameters({ bridge_hung_bottom_in: 70, bridge_hung_height_in: 24, run_top_in: 96 });
    expect(rangeBridgeSpec({ rangeWidthIn: 30, hangsBelow: true })).toMatchObject({ code: "W3024", bottomIn: 70, topIn: 96 });
    resetKitchenRuleParameters();
    expect(autoDesignShiftLimitIn("sink")).toBe(3);
  });
});

describe("kitchen rule export", () => {
  it("writes csv and markdown and labels reference rules", () => {
    const row = {
      id: 1,
      ruleCode: "owner-jog-3",
      category: "Owner placement",
      title: "Jog",
      ruleDescription: "Three inches",
      parameters: { jog_max_in: 3 },
      enforcementKind: "auto" as const,
      sourceText: "Owner",
      implementationStatus: "reference" as const,
      enabledFlag: true,
      notesText: null,
      readsParameters: false,
      updatedByName: "Tom",
      createdAt: null,
      updatedAt: "2026-10-28",
    };
    expect(kitchenRulesToCsv([row])).toContain("jog_max_in");
    expect(kitchenRulesToMarkdown([row])).toContain("Reference only");
    expect(statusLabel("pending")).toBe("Pending in another PR");
    expect(statusLabel("implemented")).toBe("Implemented in code");
  });
});

describe("corner after anchors rule", () => {
  it("is in the seed, owner-sourced, and honest that it is not implemented yet", () => {
    const rule = KITCHEN_RULE_SEED.find((r) => r.ruleCode === "owner-corner-after-anchors");
    expect(rule).toMatchObject({ category: "Owner placement", sourceText: "Owner", implementationStatus: "pending" });
    expect(rule!.ruleDescription).toMatch(/fewest fillers/);
  });
});
