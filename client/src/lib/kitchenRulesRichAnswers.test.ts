import { describe, expect, it } from "vitest";
import { RICH_ANSWER_PROMPT, richQuestionSeeds } from "./kitchenRulesRichQuestions";
import {
  isMissingTableError,
  readLocalRichAnswer,
  richAnswerSaveState,
  richAnswerText,
  richAnswerUpdateInput,
  richAnswersToMarkdown,
  writeLocalRichAnswer,
} from "./kitchenRulesRichAnswers";
import type { KitchenRuleRecord } from "./kitchenRulesApi";

const record: KitchenRuleRecord = {
  id: 7,
  ruleCode: "rich-q-corners",
  category: "Questions for Rich",
  title: "Corners",
  ruleDescription: "NKBA: x Auto-Design today: y Question for Rich: z?",
  parameters: {},
  enforcementKind: "reference",
  sourceText: "src",
  implementationStatus: "reference",
  enabledFlag: true,
  notesText: RICH_ANSWER_PROMPT,
  readsParameters: false,
  updatedByName: null,
  createdAt: null,
  updatedAt: null,
};

describe("Rich answers", () => {
  it("treats the seeded prompt as not answered", () => {
    expect(richAnswerText(RICH_ANSWER_PROMPT)).toBeNull();
    expect(richAnswerText("")).toBeNull();
    expect(richAnswerText(null)).toBeNull();
    expect(richAnswerText("  Lazy Susan in a small kitchen. ")).toBe("Lazy Susan in a small kitchen.");
    for (const seed of richQuestionSeeds) expect(richAnswerText(seed.notesText)).toBeNull();
  });

  it("an update only writes the answer and keeps the question reference-only", () => {
    const input = richAnswerUpdateInput({ ...record, parameters: { stray: 1 }, enforcementKind: "auto" }, "Blind 3 in off the wall");
    expect(input.notesText).toBe("Blind 3 in off the wall");
    expect(input.parameters).toEqual({});
    expect(input.enforcementKind).toBe("reference");
    expect(input.id).toBe(7);
    expect(richAnswerUpdateInput(record, "   ").notesText).toBe(RICH_ANSWER_PROMPT);
  });

  it("tells a load error apart from a missing table or row", () => {
    expect(isMissingTableError("Table 'cabinet_dealz.kitchen_rules' doesn't exist")).toBe(true);
    expect(isMissingTableError("You do not have required permission (10002)")).toBe(false);
    expect(richAnswerSaveState({ isLoading: false, isError: true, errorMessage: "Table 'cabinet_dealz.kitchen_rules' doesn't exist", record: null }).kind).toBe("row-missing");
    expect(richAnswerSaveState({ isLoading: false, isError: true, errorMessage: "boom", record: null }).kind).toBe("error");
    expect(richAnswerSaveState({ isLoading: false, isError: false, record: null }).kind).toBe("row-missing");
    expect(richAnswerSaveState({ isLoading: false, isError: false, record }).kind).toBe("ready");
  });

  it("keeps and clears an answer on this computer", () => {
    const map = new Map<string, string>();
    const store = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
    writeLocalRichAnswer("rich-q-corners", " lazy susan ", store);
    expect(readLocalRichAnswer("rich-q-corners", store)).toBe("lazy susan");
    writeLocalRichAnswer("rich-q-corners", "", store);
    expect(readLocalRichAnswer("rich-q-corners", store)).toBeNull();
  });

  it("exports every question with its answer for Tom", () => {
    const md = richAnswersToMarkdown([record], () => ({ text: "Lazy Susan", where: "server" }));
    expect(md).toContain("## Corners");
    expect(md).toContain("**Rich's answer (server):** Lazy Susan");
  });
});
