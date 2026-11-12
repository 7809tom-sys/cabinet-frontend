import { useEffect, useState } from "react";

/**
 * "Design questions needing review" after an Auto Design run (Tom, Nov 12 2026).
 *
 * The rule findings used to open fully expanded the moment Auto Design ran. They
 * are now collapsed behind a "Show rules (N)" toggle the user opens only if they
 * want; "Hide rules" collapses them again. The findings, their wording and the
 * Dismiss action are unchanged, and the rules still apply either way. A new run
 * (a different set of lines) starts collapsed again.
 */
export function AutoDesignReviewList({ lines, onDismiss }: { lines: string[]; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const signature = lines.join("\n");
  useEffect(() => {
    setExpanded(false);
  }, [signature]);
  if (lines.length === 0) return null;
  const listId = "designer-review-finding-list";
  return (
    <div className="absolute bottom-3 right-28 z-40 max-w-md" data-testid="designer-review-list">
      <div role="alert" className="rounded-lg border border-rose-400 bg-rose-50 px-3 py-2 text-sm text-rose-950 shadow-md">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 font-semibold">Design questions needing review</p>
          <button
            type="button"
            data-testid="designer-review-toggle"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((open) => !open)}
            className="shrink-0 rounded-md border border-rose-300 bg-white px-2 py-0.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
          >
            {expanded ? "Hide rules" : `Show rules (${lines.length})`}
          </button>
        </div>
        {expanded && (
          <ul id={listId} className="mt-1 max-h-[50vh] space-y-1 overflow-y-auto">
            {lines.map((line) => (
              <li key={line} data-testid="designer-review-finding">{line}</li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onDismiss} className="mt-1 rounded p-0.5 text-xs font-semibold text-rose-800 hover:bg-rose-100" aria-label="Dismiss review list">Dismiss</button>
      </div>
    </div>
  );
}
