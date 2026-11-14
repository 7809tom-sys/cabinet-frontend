import { useEffect, useMemo, useState } from "react";
import {
  autoDesignRulesReportIsEmpty,
  buildAutoDesignRulesReport,
  type DesignerReviewFinding,
} from "@/lib/designerReviewFindings";

/**
 * Non-blocking Auto Design report after a build (Tom, Nov 14 2026).
 *
 * The end-of-flow "Design questions needing review" alert is replaced by this
 * summary panel: the same findings, grouped into what could not be met, what
 * was applied or adjusted, and defaults the shopper can still change. It is
 * not a modal, starts with the report visible, and can be collapsed or dismissed.
 */
export function AutoDesignReviewList({
  findings,
  onDismiss,
}: {
  findings: readonly DesignerReviewFinding[];
  onDismiss: () => void;
}) {
  const report = useMemo(() => buildAutoDesignRulesReport(findings), [findings]);
  const signature = `${report.unmet.join("\n")}\n${report.applied.join("\n")}\n${report.changeable.join("\n")}`;
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    setExpanded(true);
  }, [signature]);
  if (autoDesignRulesReportIsEmpty(report)) return null;
  const count = report.unmet.length + report.applied.length + report.changeable.length;
  const listId = "auto-design-rules-report-list";
  return (
    <div className="absolute bottom-3 right-28 z-40 max-w-md" data-testid="designer-review-list">
      <div
        role="status"
        className="rounded-lg border border-[#d7a46c]/70 bg-[#fffdf9] px-3 py-2 text-sm text-[#244338] shadow-md"
        data-testid="auto-design-rules-report"
      >
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 font-semibold">Auto Design report</p>
          <button
            type="button"
            data-testid="designer-review-toggle"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((open) => !open)}
            className="shrink-0 rounded-md border border-[#d7a46c]/80 bg-white px-2 py-0.5 text-xs font-semibold text-[#244338] hover:bg-[#f6f3ed]"
          >
            {expanded ? "Hide report" : `Show report (${count})`}
          </button>
        </div>
        {expanded && (
          <div id={listId} className="mt-2 max-h-[50vh] space-y-3 overflow-y-auto">
            <ReportSection testId="auto-design-rules-report-unmet" title="Couldn't be met" lines={report.unmet} />
            <ReportSection testId="auto-design-rules-report-applied" title="Applied or adjusted" lines={report.applied} />
            <ReportSection testId="auto-design-rules-report-changeable" title="You can still change" lines={report.changeable} />
          </div>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 rounded p-0.5 text-xs font-semibold text-[#244338] hover:bg-[#f6f3ed]"
          aria-label="Dismiss review list"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ReportSection({ testId, title, lines }: { testId: string; title: string; lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <section data-testid={testId}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#244338]/80">{title}</h3>
      <ul className="mt-1 space-y-1">
        {lines.map((line) => (
          <li key={line} data-testid="designer-review-finding">{line}</li>
        ))}
      </ul>
    </section>
  );
}
