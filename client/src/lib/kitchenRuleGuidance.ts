/**
 * Guidance rules: the kitchen rules an admin wrote that the auto-designer cannot
 * execute on its own.
 *
 * A rule added from the admin screen is plain text. No code knows how to apply
 * it, so nothing pretends it moves a cabinet. Instead it is carried to the two
 * places a person reads before a plan is ordered:
 *
 *   1. the plan review list, as a named guidance line, and
 *   2. the AI prompt, when the customer asks for a render or a description.
 *
 * Built-in rules the Designer does execute are NOT repeated in either place, so
 * guidance stays short and every line is something a person must judge.
 *
 * The list is process-wide state filled from the same `kitchenRules.parameters`
 * payload the numbers come from, so a Designer session and a server-side prompt
 * read the same saved rules.
 */

export type KitchenGuidanceRule = {
  /** Setting key, so a line can be traced back to its admin row. */
  settingKey: string;
  title: string;
  text: string;
  /** Optional numeric value the admin attached, already formatted for display. */
  value?: string | null;
  category?: string | null;
};

let guidanceRules: KitchenGuidanceRule[] = [];

/** Replaces the guidance list. Called whenever saved kitchen rules load. */
export function setKitchenGuidanceRules(rules: readonly KitchenGuidanceRule[] | null | undefined): void {
  guidanceRules = (rules ?? [])
    .filter((rule): rule is KitchenGuidanceRule => Boolean(rule && rule.settingKey && (rule.title || rule.text)))
    .map((rule) => ({
      ...rule,
      title: rule.title.trim(),
      text: rule.text.trim(),
    }))
    .filter((rule) => rule.title.length > 0 || rule.text.length > 0);
}

export function kitchenGuidanceRules(): KitchenGuidanceRule[] {
  return [...guidanceRules];
}

export function resetKitchenGuidanceRules(): void {
  guidanceRules = [];
}

/** One line per guidance rule, for the plan review list. */
export function kitchenGuidanceLines(): string[] {
  return guidanceRules.map((rule) => {
    const value = rule.value?.trim();
    const head = value ? `${rule.title} (${value})` : rule.title;
    return rule.text ? `${head} — ${rule.text}` : head;
  });
}

/**
 * The block appended to an AI prompt. Empty when there is nothing to say, so a
 * prompt is byte-identical to today's when no guidance rule exists.
 */
export function kitchenGuidancePromptBlock(): string {
  const lines = kitchenGuidanceLines();
  if (lines.length === 0) return "";
  return [
    "Owner kitchen rules that must be respected in this design (written by the business, not optional style choices):",
    ...lines.map((line) => `- ${line}`),
  ].join("\n");
}

/** Appends the guidance block to a base prompt, without changing it when empty. */
export function withKitchenGuidance(basePrompt: string): string {
  const block = kitchenGuidancePromptBlock();
  return block ? `${basePrompt}\n\n${block}` : basePrompt;
}
