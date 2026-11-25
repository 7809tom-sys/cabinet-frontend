import { RICH_ANSWER_PROMPT } from "./kitchenRulesRichQuestions";
import type { KitchenRuleRecord, KitchenRuleUpdate } from "./kitchenRulesApi";

/**
 * Rich's answers to the "Questions for Rich" list.
 *
 * Each question is a reference-only row in cabinet_dealz.kitchen_rules (seeded by
 * docs/sql/0238), and Rich's answer is that row's Notes field (notesText). Saving
 * an answer goes through kitchenRules.update with the row's own description,
 * category and empty parameters, so it can never change a number the Designer
 * reads. Answers are NOT kitchen rule settings, so they never reach the plan
 * review guidance list or the AI prompt. Tom turns an answer into a real rule in
 * a separate change.
 */

const UNANSWERED_PREFIX = "Rich's answer: (not answered yet)";

/** The saved answer, or null when the Notes still hold the "not answered yet" prompt. */
export function richAnswerText(notesText: string | null | undefined): string | null {
  const text = (notesText ?? "").trim();
  if (!text) return null;
  if (text === RICH_ANSWER_PROMPT || text.startsWith(UNANSWERED_PREFIX)) return null;
  return text;
}

/** The stored kitchen_rules row for one question, matched on its rule code. */
export function richAnswerRecord(
  rows: readonly KitchenRuleRecord[] | undefined,
  ruleCode: string,
): KitchenRuleRecord | null {
  return rows?.find((row) => row.ruleCode === ruleCode) ?? null;
}

/**
 * The update that writes ONLY the answer: every other field is the stored row's
 * own value, the kind stays "reference" and the parameters stay empty. A blank
 * answer puts the "not answered yet" prompt back.
 */
export function richAnswerUpdateInput(record: KitchenRuleRecord, answer: string): KitchenRuleUpdate {
  const trimmed = answer.trim();
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    ruleDescription: record.ruleDescription,
    parameters: {},
    enforcementKind: "reference",
    sourceText: record.sourceText,
    enabledFlag: record.enabledFlag,
    notesText: trimmed ? trimmed : RICH_ANSWER_PROMPT,
  };
}

export type RichAnswerSaveState =
  | { kind: "ready" }
  | { kind: "loading" }
  /** The server answers, but this question's row is not in kitchen_rules (0238 not run). */
  | { kind: "row-missing"; message: string }
  | { kind: "error"; message: string };

/** True when a database error says the table is not there (TiDB/MySQL 1146), so the SQL hint applies. */
export function isMissingTableError(message: string | null | undefined): boolean {
  return /doesn't exist|does not exist|no such table|ER_NO_SUCH_TABLE|\b1146\b/i.test(message ?? "");
}

export const RICH_ANSWER_ROW_MISSING =
  "This question is not on the database yet, so its answer cannot be saved. Run docs/sql/0233_kitchen_rules.tidb.sql and "
  + "docs/sql/0238_kitchen_rules_questions_for_rich.tidb.sql in the TiDB editor, then reload.";

/** Whether an answer for this question can be saved to the server right now, and why not. */
export function richAnswerSaveState(input: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string | null;
  record: KitchenRuleRecord | null;
}): RichAnswerSaveState {
  if (input.isError) {
    if (isMissingTableError(input.errorMessage)) return { kind: "row-missing", message: RICH_ANSWER_ROW_MISSING };
    return { kind: "error", message: `The answers could not be loaded: ${input.errorMessage ?? "unknown error"}` };
  }
  if (input.isLoading) return { kind: "loading" };
  if (!input.record) return { kind: "row-missing", message: RICH_ANSWER_ROW_MISSING };
  return { kind: "ready" };
}

/* ---------- answers kept on this computer when a save fails ---------- */

const LOCAL_PREFIX = "kitchen-rules-rich-answer:";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readLocalRichAnswer(ruleCode: string, store: StorageLike | null = storage()): string | null {
  const text = store?.getItem(`${LOCAL_PREFIX}${ruleCode}`)?.trim();
  return text ? text : null;
}

export function writeLocalRichAnswer(ruleCode: string, answer: string, store: StorageLike | null = storage()): void {
  if (!store) return;
  const trimmed = answer.trim();
  if (trimmed) store.setItem(`${LOCAL_PREFIX}${ruleCode}`, trimmed);
  else store.removeItem(`${LOCAL_PREFIX}${ruleCode}`);
}

/** Markdown of every question with its answer, for Tom's learning loop. */
export function richAnswersToMarkdown(
  questions: ReadonlyArray<{ ruleCode: string; title: string; ruleDescription: string }>,
  answerFor: (ruleCode: string) => { text: string | null; where: "server" | "this computer" | null },
): string {
  const lines = ["# Questions for Rich: answers", ""];
  for (const question of questions) {
    const answer = answerFor(question.ruleCode);
    lines.push(`## ${question.title}`, "", `Code: ${question.ruleCode}`, "", question.ruleDescription, "");
    lines.push(answer.text ? `**Rich's answer (${answer.where}):** ${answer.text}` : "**Rich's answer:** not answered yet");
    lines.push("");
  }
  return lines.join("\n");
}
