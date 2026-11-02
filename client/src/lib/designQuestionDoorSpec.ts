/**
 * Rule 8: the wizard / design-question door specification applies to EVERY cabinet in the build.
 *
 * The owner's rule is precise about precedence:
 *   - a door style chosen in the design questions WINS over the design's default style,
 *   - a per-cabinet override the user set by hand still wins over both,
 *   - and a stale former-default override (the `rebaseFormerDefaultStyleOverrides` case) must
 *     not survive to quietly re-spec one cabinet.
 *
 * So the build applies the questioned style through the shared rebase helper, then verifies every
 * cabinet resolves to the expected style and reports any cabinet that does not.
 */
import { effectiveStyleId, rebaseFormerDefaultStyleOverrides } from "./design";
import type { DesignerReviewFinding } from "./designerReviewFindings";

export type DesignQuestionDoorSpec = {
  /** Door style the design questions chose. Null when the questions did not ask. */
  styleId: number | null;
  /** Plain name for the review list, e.g. "Ashford Shaker". */
  styleName?: string | null;
  /** True when the design carries an intentional second color, so overrides must be preserved. */
  twoTone?: boolean;
};

type StyledCabinet = { uid?: string; masterCode?: string | null; styleId?: number | null };

/**
 * Applies the design-question door spec to every cabinet.
 *
 * A questioned style replaces the design default, so every cabinet that inherited the old default
 * is rebased onto it. An explicit two-tone override is left exactly as the user set it.
 */
export function applyDesignQuestionDoorSpec<T extends StyledCabinet>(input: {
  cabinets: readonly T[];
  /** The design's default style before this build. */
  formerDefaultStyleId: number | null;
  spec: DesignQuestionDoorSpec | null | undefined;
}): { cabinets: T[]; applied: boolean; findings: DesignerReviewFinding[] } {
  const spec = input.spec;
  if (!spec || spec.styleId == null) {
    return { cabinets: [...input.cabinets], applied: false, findings: [] };
  }
  // Rule 8 + `rebaseFormerDefaultStyleOverrides`: a cabinet still carrying the design's FORMER
  // default follows the questioned style in both modes. A two-tone design keeps its intentional
  // second-finish overrides; a single-finish design clears every override.
  const questionedStyleId = spec.styleId;
  const rebased = input.cabinets.map((cabinet) => {
    if (spec.twoTone === true) {
      const carriesFormerDefault = cabinet.styleId != null && cabinet.styleId === input.formerDefaultStyleId;
      return carriesFormerDefault ? ({ ...cabinet, styleId: questionedStyleId } as T) : cabinet;
    }
    return rebaseFormerDefaultStyleOverrides([cabinet] as T[], input.formerDefaultStyleId, questionedStyleId, false)[0]!;
  });
  // Stamp the questioned style on every cabinet that has no explicit override of its own.
  const stamped = rebased.map((cabinet) => (
    cabinet.styleId == null ? { ...cabinet, styleId: questionedStyleId } : cabinet
  )) as T[];
  const findings: DesignerReviewFinding[] = [];
  for (const cabinet of stamped) {
    if (effectiveStyleId(cabinet, questionedStyleId) === questionedStyleId) continue;
    findings.push({
      ruleId: "design-question-door-spec",
      code: "cabinet-kept-own-finish",
      severity: "info",
      title: `${cabinet.masterCode ?? cabinet.uid ?? "Cabinet"} keeps its own finish`,
      detail: `The design questions chose ${spec.styleName ?? `style ${spec.styleId}`}, but this cabinet has an explicit two-tone override.`,
      cabinetUid: cabinet.uid ?? null,
      cabinetCode: cabinet.masterCode ?? null,
    });
  }
  return { cabinets: stamped, applied: true, findings };
}

/**
 * Verifies the questioned style really reached every cabinet, and names any cabinet that did not.
 * A cabinet with no style at all after the pass is a real miss and becomes a warning.
 */
export function verifyDesignQuestionDoorSpec(input: {
  cabinets: readonly StyledCabinet[];
  spec: DesignQuestionDoorSpec | null | undefined;
}): DesignerReviewFinding[] {
  const spec = input.spec;
  if (!spec || spec.styleId == null) return [];
  const findings: DesignerReviewFinding[] = [];
  for (const cabinet of input.cabinets) {
    const resolved = effectiveStyleId(cabinet, null);
    if (resolved == null) {
      findings.push({
        ruleId: "design-question-door-spec",
        code: "cabinet-has-no-style",
        severity: "warning",
        title: `${cabinet.masterCode ?? cabinet.uid ?? "Cabinet"} has no door style`,
        detail: `The design questions chose ${spec.styleName ?? `style ${spec.styleId}`}, but this cabinet resolved to no style.`,
        cabinetUid: cabinet.uid ?? null,
        cabinetCode: cabinet.masterCode ?? null,
      });
    }
  }
  return findings;
}

/**
 * Rule 8 for a wizard run: the wizard's own answers are the design questions. A wizard style id
 * always wins over the design default, even when the design default was already set.
 */
export function wizardDoorSpec(input: {
  wizardStyleId: number | null | undefined;
  wizardStyleName?: string | null;
  designDefaultStyleId: number | null;
}): DesignQuestionDoorSpec | null {
  if (input.wizardStyleId == null) return null;
  return {
    styleId: input.wizardStyleId,
    styleName: input.wizardStyleName ?? null,
    // A wizard selection is a single finish unless the design already carries two tones.
    twoTone: false,
  };
}
