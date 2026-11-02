/**
 * Rule 14: design questions are honored 100%. Anything the Designer could not honor must
 * surface as a NAMED warning on a reviewable list — never as a silent substitution and never
 * as a toast that scrolls away.
 *
 * Every finding carries the designer rule id it belongs to, a stable machine code, the plain
 * sentence shown to the user, and the wall or cabinet it concerns. The Auto-Design build
 * returns this list so the review panel can show exactly what was ignored and why.
 */
import type { WallLabel } from "./autoDesignAutoBuild";

export type DesignerReviewSeverity = "warning" | "info";

export type DesignerReviewFinding = {
  /** Designer rule id the finding belongs to (see DESIGNER_LAYOUT_RULES). */
  ruleId: string;
  /** Stable machine code, e.g. `range-neighbor-too-narrow`. */
  code: string;
  severity: DesignerReviewSeverity;
  /** The named warning shown on the review list. */
  title: string;
  /** What the Designer did instead. */
  detail: string;
  wallLabel?: WallLabel | null;
  cabinetUid?: string | null;
  cabinetCode?: string | null;
};

export type DesignerReviewList = {
  findings: DesignerReviewFinding[];
  /** True when every design question was honored. */
  allHonored: boolean;
};

export function makeReviewFinding(finding: DesignerReviewFinding): DesignerReviewFinding {
  return {
    ...finding,
    title: finding.title.trim(),
    detail: finding.detail.trim(),
  };
}

/** Deduplicates by rule, code and subject so one miss is never reported twice. */
export function reviewFindingKey(finding: DesignerReviewFinding): string {
  return [
    finding.ruleId,
    finding.code,
    finding.wallLabel ?? "",
    finding.cabinetUid ?? finding.cabinetCode ?? "",
  ].join("|");
}

/** The reviewable list: stable order, no duplicate subject, `allHonored` reflects reality. */
export function buildDesignerReviewList(findings: readonly DesignerReviewFinding[]): DesignerReviewList {
  const seen = new Set<string>();
  const unique: DesignerReviewFinding[] = [];
  for (const finding of findings) {
    const key = reviewFindingKey(finding);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(makeReviewFinding(finding));
  }
  unique.sort((left, right) => (
    left.ruleId.localeCompare(right.ruleId)
    || left.code.localeCompare(right.code)
    || (left.wallLabel ?? "").localeCompare(right.wallLabel ?? "")
  ));
  return {
    findings: unique,
    allHonored: !unique.some((finding) => finding.severity === "warning"),
  };
}

/** Plain lines for the review dialog, one per finding. */
export function designerReviewLines(list: DesignerReviewList): string[] {
  return list.findings.map((finding) => (
    finding.wallLabel
      ? `${finding.title} (${finding.wallLabel}) — ${finding.detail}`
      : `${finding.title} — ${finding.detail}`
  ));
}
