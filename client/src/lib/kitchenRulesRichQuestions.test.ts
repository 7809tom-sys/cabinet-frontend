import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KITCHEN_RULE_SEED } from "./kitchenRulesCatalog";
import { RICH_QUESTIONS_CATEGORY, richQuestionSeeds } from "./kitchenRulesRichQuestions";

const admin = readFileSync(resolve(process.cwd(), "client/src/components/admin/KitchenRulesAdmin.tsx"), "utf8");

describe("Questions for Rich", () => {
  it("are in the Kitchen Rules catalog under their own category, with unique codes", () => {
    const mine = KITCHEN_RULE_SEED.filter((rule) => rule.category === RICH_QUESTIONS_CATEGORY);
    expect(mine.length).toBe(richQuestionSeeds.length);
    expect(mine.length).toBeGreaterThanOrEqual(18);
    expect(new Set(KITCHEN_RULE_SEED.map((rule) => rule.ruleCode)).size).toBe(KITCHEN_RULE_SEED.length);
  });

  it("are reference-only: they never change Designer behavior and read no parameters", () => {
    for (const rule of richQuestionSeeds) {
      expect(rule.enforcementKind, rule.ruleCode).toBe("reference");
      expect(rule.implementationStatus, rule.ruleCode).toBe("reference");
      expect(rule.readsParameters, rule.ruleCode).toBe(false);
      expect(rule.parameters, rule.ruleCode).toEqual({});
    }
  });

  it("each one says what NKBA says, what Auto-Design does today, and asks Rich a question, with a place for his answer", () => {
    for (const rule of richQuestionSeeds) {
      expect(rule.ruleDescription, rule.ruleCode).toMatch(/^NKBA: .+ Auto-Design today: .+ Question for Rich: .+\?$/);
      expect(rule.notesText, rule.ruleCode).toMatch(/^Rich's answer:/);
    }
  });

  it("quotes the NKBA numbers from the planning guidelines", () => {
    const text = richQuestionSeeds.map((rule) => rule.ruleDescription).join("\n");
    expect(text).toContain("24 inches minimum to a protected noncombustible surface, 30 inches to combustible material or metal cabinets");
    expect(text).toContain("12 inches on one side and 15 inches on the other");
    expect(text).toContain("within 36 inches of the sink edge, with 21 inches of standing space");
    expect(text).toContain("24 inches on one side and 18 inches on the other");
    expect(text).toContain("42 inches minimum for one cook, 48 inches for two, and 60 inches");
  });

  it("the admin screen has a Questions for Rich filter and a short help line for him", () => {
    expect(admin).toContain("RICH_QUESTIONS_CATEGORY");
    expect(admin).toContain('data-testid="kitchen-rules-rich-filter"');
    expect(admin).toContain('data-testid="kitchen-rules-rich-help"');
  });
});
