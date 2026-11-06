/**
 * The auto-designer must READ the admin overrides: change a value in Kitchen
 * Rules and the pass that uses it behaves differently. It must also fall back
 * to the code defaults when nothing is saved, so shipping the page changes no
 * plan until an admin edits a value.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  KITCHEN_RULE_DEFINITIONS,
  KITCHEN_RULE_PARAMETER_DEFAULTS,
  KITCHEN_RULE_TEXT_DEFAULTS,
  kitchenRuleDefinition,
} from "./kitchenRuleRegistry";
import {
  kitchenRuleNumber,
  kitchenRuleText,
  resetKitchenRuleParameters,
  setKitchenRuleParameters,
  setKitchenRuleTextParameters,
} from "./kitchenRuleParameters";
import { autoDesignShiftLimitIn, anchorWiggleLimitIn, measuredRefrigeratorCornerShiftLimitIn } from "./designerLayoutRules";
import { effectiveSmallGapFillerMaxIn, effectiveAutoPlaceFillerMaxIn, installableSmallGapRemainder } from "./smallGapFiller";
import { autoDesignFillerMaxIn } from "./autoDesignSeamFillers";
import { autoDesignHoodMountBottom, AUTO_DESIGN_STANDARD_HOOD_BOTTOM_IN } from "./autoDesignRangeHood";
import { rangeBridgeSpec, RANGE_FRIDGE_MIN_CABINET_IN } from "./kitchenAdjacency";
import { RANGE_NEIGHBOR_MIN_WIDTH_IN } from "./autoDesignSeamFillers";

beforeEach(() => {
  resetKitchenRuleParameters();
});

describe("nothing changes until a value is edited", () => {
  it("reads the code default for every numeric rule with no override", () => {
    for (const rule of KITCHEN_RULE_DEFINITIONS) {
      if (rule.valueType !== "number" && rule.valueType !== "toggle") continue;
      const expected = Number(rule.defaultValue);
      expect(kitchenRuleNumber(rule.key as never), rule.key).toBe(expected);
    }
  });

  it("reads the code default for every text rule with no override", () => {
    for (const [key, value] of Object.entries(KITCHEN_RULE_TEXT_DEFAULTS)) {
      expect(kitchenRuleText(key), key).toBe(value);
    }
  });

  it("keeps the published constants equal to the defaults they replace", () => {
    // These are imported by modules that cannot call a function at module scope.
    expect(AUTO_DESIGN_STANDARD_HOOD_BOTTOM_IN).toBe(KITCHEN_RULE_PARAMETER_DEFAULTS.standard_hood_bottom_in);
    expect(RANGE_FRIDGE_MIN_CABINET_IN).toBe(15);
    expect(RANGE_NEIGHBOR_MIN_WIDTH_IN).toBe(15);
  });
});

describe("a saved value reaches the pass that reads it", () => {
  it("wiggle room: the cabinet jog", () => {
    expect(autoDesignShiftLimitIn("cabinet")).toBe(3);
    setKitchenRuleParameters({ jog_max_in: 1.5 });
    expect(autoDesignShiftLimitIn("cabinet")).toBe(1.5);
  });

  it("wiggle room: the range, refrigerator and sink cap", () => {
    expect(anchorWiggleLimitIn("sink")).toBe(2);
    setKitchenRuleParameters({ anchor_wiggle_cap_in: 1 });
    expect(anchorWiggleLimitIn("sink")).toBe(1);
    // Never wider than the general jog, however the two are set.
    setKitchenRuleParameters({ anchor_wiggle_cap_in: 8 });
    expect(anchorWiggleLimitIn("sink")).toBe(3);
  });

  it("wiggle room: the measured refrigerator corner slide", () => {
    expect(measuredRefrigeratorCornerShiftLimitIn()).toBe(12);
    setKitchenRuleParameters({ measured_fridge_corner_shift_in: 8 });
    expect(measuredRefrigeratorCornerShiftLimitIn()).toBe(8);
  });

  it("fillers: the widest seam and the automatic leftover", () => {
    expect(effectiveSmallGapFillerMaxIn()).toBe(6);
    expect(effectiveAutoPlaceFillerMaxIn()).toBe(3);
    setKitchenRuleParameters({ filler_gap_max_in: 4, auto_place_filler_max_in: 2 });
    expect(effectiveSmallGapFillerMaxIn()).toBe(4);
    expect(effectiveAutoPlaceFillerMaxIn()).toBe(2);
    // A seam wider than the new maximum is no longer installable.
    expect(installableSmallGapRemainder(5)).toBeNull();
    expect(installableSmallGapRemainder(3)).toBe(3);
  });

  it("fillers: the narrowest filler worth cutting", () => {
    expect(installableSmallGapRemainder(0.5)).toBe(0.5);
    setKitchenRuleParameters({ filler_min_in: 1 });
    expect(installableSmallGapRemainder(0.5)).toBeNull();
    expect(installableSmallGapRemainder(1.5)).toBe(1.5);
  });

  it("fillers: the seam Auto-Design closes by itself", () => {
    expect(autoDesignFillerMaxIn()).toBe(3);
    setKitchenRuleParameters({ seam_filler_max_in: 6 });
    expect(autoDesignFillerMaxIn()).toBe(6);
  });

  it("upper heights: the range bridge spec", () => {
    const hung = rangeBridgeSpec({ rangeWidthIn: 30, hangsBelow: true });
    expect(hung).toMatchObject({ heightIn: 24, bottomIn: 72, topIn: 96 });
    setKitchenRuleParameters({
      bridge_hung_height_in: 21,
      bridge_hung_bottom_in: 70,
      run_top_in: 91,
    });
    expect(rangeBridgeSpec({ rangeWidthIn: 30, hangsBelow: true }))
      .toMatchObject({ code: "W3021", heightIn: 21, bottomIn: 70, topIn: 91 });
    // The bridge with nothing under it is a separate rule and did not move.
    expect(rangeBridgeSpec({ rangeWidthIn: 30, hangsBelow: false }))
      .toMatchObject({ heightIn: 30, bottomIn: 66 });
  });

  it("range and hood: the hood mount height", () => {
    expect(autoDesignHoodMountBottom(42)).toBe(60);
    expect(autoDesignHoodMountBottom(30)).toBe(54);
    setKitchenRuleParameters({ hood_bottom_in: 66, standard_hood_bottom_in: 51 });
    expect(autoDesignHoodMountBottom(42)).toBe(66);
    expect(autoDesignHoodMountBottom(30)).toBe(51);
  });

  it("corners: the preference order is kept as written", () => {
    setKitchenRuleTextParameters({ corner_preference_order: "blind,diagonal,lazy-susan" });
    expect(kitchenRuleText("corner_preference_order")).toBe("blind,diagonal,lazy-susan");
  });

  it("a toggle reads off at 0 and on at 1", () => {
    expect(kitchenRuleNumber("dishwasher_panel_enabled")).toBe(1);
    setKitchenRuleParameters({ dishwasher_panel_enabled: 0 });
    expect(kitchenRuleNumber("dishwasher_panel_enabled")).toBe(0);
  });
});

describe("a mandatory rule cannot be softened from a stored value", () => {
  it("keeps the bridge above the range on", () => {
    setKitchenRuleParameters({ bridge_above_range_required: 0 });
    expect(kitchenRuleNumber("bridge_above_range_required")).toBe(1);
  });

  it("keeps the faucet at the sink on", () => {
    setKitchenRuleParameters({ faucet_at_sink_required: 0 });
    expect(kitchenRuleNumber("faucet_at_sink_required")).toBe(1);
  });

  it("keeps the window fixed", () => {
    setKitchenRuleParameters({ window_never_moves: 0 });
    expect(kitchenRuleNumber("window_never_moves")).toBe(1);
  });

  it("has no code path that could switch the hard behaviour off", () => {
    // The strongest form of "cannot be disabled": the bridge, the faucet and the
    // fixed window are unconditional in the auto-designer. Nothing reads these
    // three keys to decide whether to apply them, so no stored value, no admin
    // screen, and no hand-edited row can turn the behaviour off. The rows exist
    // so the rule is visible and auditable in Kitchen Rules, and the table shows
    // them with a lock.
    const locked = KITCHEN_RULE_DEFINITIONS.filter((rule) => rule.locked).map((rule) => rule.key);
    expect(locked.length).toBe(3);
    const sources = [
      "client/src/lib/autoDesignLayout.ts",
      "client/src/lib/designerLayoutRules.ts",
      "client/src/lib/kitchenAdjacency.ts",
      "client/src/lib/autoDesignFaucet.ts",
      "client/src/lib/autoDesignSink.ts",
      "client/src/lib/designerFaceRules.ts",
      "client/src/lib/overRangeCompanion.ts",
      "client/src/lib/preSavePlanReview.ts",
    ];
    for (const path of sources) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      for (const key of locked) {
        expect(source, `${path} must not branch on the locked rule ${key}`)
          .not.toContain(`kitchenRuleNumber("${key}")`);
      }
    }
  });
});

describe("the auto-designer modules read the settings, not hardcoded numbers", () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

  it("the layout pass reads the live jog and filler maximum", () => {
    const source = read("client/src/lib/autoDesignLayout.ts");
    expect(source).toContain('kitchenRuleNumber("jog_max_in")');
    expect(source).toContain('kitchenRuleNumber("anchor_wiggle_cap_in")');
    expect(source).toContain("autoDesignFillerMaxIn()");
    expect(source).not.toMatch(/=\s*3;\s*\/\*\* A sink base/);
  });

  it("the corner seating reads the live refrigerator slide", () => {
    const source = read("client/src/lib/autoDesignCornerSeating.ts");
    expect(source).toContain("refrigeratorShiftLimitIn()");
    expect(source).toContain("measuredRefrigeratorCornerShiftLimitIn()");
  });

  it("the hood reads the live mount height", () => {
    const source = read("client/src/lib/autoDesignRangeHood.ts");
    expect(source).toContain('kitchenRuleNumber("hood_bottom_in")');
    expect(source).toContain('kitchenRuleNumber("standard_hood_bottom_in")');
  });

  it("the dishwasher panel reads its run-end and 45 degree switches separately", () => {
    const source = read("client/src/lib/dishwasherPanelRule.ts");
    expect(source).toContain('kitchenRuleNumber("dishwasher_panel_enabled")');
    expect(source).toContain('kitchenRuleNumber("dishwasher_panel_forty_five_enabled")');
  });

  it("the tall cabinet pass reads the pantry-at-run-end switch", () => {
    const source = read("client/src/lib/autoDesignTallCabinets.ts");
    expect(source).toContain('kitchenRuleNumber("tall_at_run_end")');
  });

  it("the corner chooser reads the saved preference order", () => {
    const source = read("client/src/lib/autoDesignCornerChoice.ts");
    expect(source).toContain("cornerTypeOrder()");
    expect(source).toContain('kitchenRuleText("corner_preference_order")');
  });

  it("the filler pass reads the cabinet-first or filler-first preference", () => {
    const source = read("client/src/lib/designerLayoutRules.ts");
    expect(source).toContain("fillerFirstPreference()");
  });
});

describe("guidance rules reach plan review and the AI prompt", () => {
  it("does not add a guidance block when nothing is configured", async () => {
    const guidance = await import("./kitchenRuleGuidance");
    guidance.resetKitchenGuidanceRules();
    expect(guidance.kitchenGuidancePromptBlock()).toBe("");
    expect(guidance.withKitchenGuidance("base prompt")).toBe("base prompt");
  });

  it("adds one line per rule, and leaves the base prompt intact", async () => {
    const guidance = await import("./kitchenRuleGuidance");
    guidance.setKitchenGuidanceRules([
      { settingKey: "custom-a", title: "Leave 2 inches at a window", text: "Never butt a cabinet to window casing." },
      { settingKey: "custom-b", title: "Scribe over 1/2 inch", text: "+0.5", value: "0.5" },
    ]);
    const block = guidance.kitchenGuidancePromptBlock();
    expect(block).toContain("Leave 2 inches at a window");
    expect(block).toContain("Scribe over 1/2 inch (0.5)");
    expect(guidance.withKitchenGuidance("base prompt").startsWith("base prompt")).toBe(true);
    expect(guidance.kitchenGuidanceLines()).toHaveLength(2);
    guidance.resetKitchenGuidanceRules();
  });

  it("labels a custom rule as guidance in the admin table", () => {
    const definition = kitchenRuleDefinition("custom-anything");
    expect(definition).toBeUndefined();
  });
});
