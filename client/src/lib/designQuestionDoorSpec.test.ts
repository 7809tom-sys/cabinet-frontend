import { describe, expect, it } from "vitest";
import { applyDesignQuestionDoorSpec, verifyDesignQuestionDoorSpec, wizardDoorSpec } from "./designQuestionDoorSpec";
import { effectiveStyleId } from "./design";

describe("rule 8: the design-question door spec reaches every cabinet", () => {
  const cabinets = [
    { uid: "a", masterCode: "B18", styleId: null },
    { uid: "b", masterCode: "B24", styleId: null },
    { uid: "c", masterCode: "W1830", styleId: 7 },
  ];

  it("applies the questioned style to a single-finish design", () => {
    const result = applyDesignQuestionDoorSpec({
      cabinets,
      formerDefaultStyleId: 7,
      spec: { styleId: 390009, styleName: "Ashford Shaker" },
    });
    expect(result.applied).toBe(true);
    expect(result.cabinets.map((cabinet) => effectiveStyleId(cabinet, 390009))).toEqual([390009, 390009, 390009]);
    expect(verifyDesignQuestionDoorSpec({ cabinets: result.cabinets, spec: { styleId: 390009 } })).toEqual([]);
  });

  it("a wizard-chosen door wins over the design default style", () => {
    const spec = wizardDoorSpec({ wizardStyleId: 512, wizardStyleName: "Wizard Oak", designDefaultStyleId: 7 });
    expect(spec?.styleId).toBe(512);
    const result = applyDesignQuestionDoorSpec({ cabinets, formerDefaultStyleId: 7, spec });
    expect(result.cabinets.every((cabinet) => effectiveStyleId(cabinet, 512) === 512)).toBe(true);
  });

  it("keeps an intentional two-tone override and reports it as info, not a miss", () => {
    const twoTone = [
      { uid: "perimeter", masterCode: "B18", styleId: 7 },
      { uid: "island", masterCode: "B36", styleId: 99 },
    ];
    const result = applyDesignQuestionDoorSpec({
      cabinets: twoTone,
      formerDefaultStyleId: 7,
      spec: { styleId: 512, styleName: "Wizard Oak", twoTone: true },
    });
    expect(result.cabinets.find((cabinet) => cabinet.uid === "island")!.styleId).toBe(99);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.severity).toBe("info");
    expect(result.findings[0]!.code).toBe("cabinet-kept-own-finish");
  });

  it("does nothing when the questions did not name a door", () => {
    const result = applyDesignQuestionDoorSpec({ cabinets, formerDefaultStyleId: 7, spec: null });
    expect(result.applied).toBe(false);
    expect(result.cabinets).toEqual(cabinets);
  });

  it("reports a cabinet that still has no style as a named warning", () => {
    const findings = verifyDesignQuestionDoorSpec({
      cabinets: [{ uid: "x", masterCode: "B12", styleId: null }],
      spec: { styleId: 512 },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: "design-question-door-spec", severity: "warning", code: "cabinet-has-no-style" });
  });
});
