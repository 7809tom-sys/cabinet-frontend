import { FLOORING_LAYOUT_PATTERNS, type FlooringLayoutPattern } from "@/lib/design";
import {
  FLOORING_HERRINGBONE_OVERAGE,
  FLOORING_INSTALLATION_RULES,
  FLOORING_STANDARD_OVERAGE,
} from "@/lib/flooringLayout";

export function FlooringLayoutPicker({
  value,
  onChange,
}: {
  value: FlooringLayoutPattern | null;
  onChange: (pattern: FlooringLayoutPattern) => void;
}) {
  const herringbonePct = Math.round(FLOORING_HERRINGBONE_OVERAGE * 100);
  const standardPct = Math.round(FLOORING_STANDARD_OVERAGE * 100);
  return (
    <div data-testid="flooring-layout-picker" className="mt-4 space-y-3">
      <div data-testid="flooring-installation-rules" className="rounded-lg border border-[#d8c7a1] bg-[#fffaf0] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6e5320]">Before installation</p>
        <ul className="mt-1.5 space-y-1.5">
          {FLOORING_INSTALLATION_RULES.map((rule) => (
            <li key={rule.id} data-testid={`flooring-rule-${rule.id}`}>
              <p className="text-[11px] font-semibold text-[#1a2744]">{rule.title}</p>
              <p className="text-[11px] leading-snug text-muted-foreground">{rule.body}</p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="sticky top-0 z-10 -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1.5 border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Plank layout</span>
          <span className="text-[10px] font-normal normal-case text-muted-foreground/70">· Choose one</span>
        </div>
        <p className="px-1 pt-1.5 text-[11px] leading-snug text-muted-foreground">
          {value ? "The layout you choose is shown on the floor plan and on the quote." : "No layout is selected yet. Choose one to show it on the floor plan and the quote."}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {FLOORING_LAYOUT_PATTERNS.map((pattern) => {
            const selected = value === pattern.id;
            return (
              <button
                key={pattern.id}
                type="button"
                aria-pressed={selected}
                data-testid={`flooring-layout-option-${pattern.id}`}
                onClick={() => onChange(pattern.id)}
                className={`min-h-11 rounded-lg border px-3 py-2 text-left transition-colors ${
                  selected
                    ? "border-[#a87f33] bg-[#a87f33]/5 ring-1 ring-[#a87f33]/40"
                    : "border-border hover:border-[#a87f33]/50 hover:bg-muted/40"
                }`}
              >
                <div className="text-[11px] font-semibold text-foreground sm:text-xs">{pattern.name}</div>
                <div className="text-[10px] leading-snug text-muted-foreground sm:text-[11px]">{pattern.description}</div>
              </button>
            );
          })}
        </div>
      </div>
      {value === "herringbone" && (
        <p data-testid="flooring-herringbone-warning" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-950">
          Herringbone needs significantly more planks than the other layouts, so it costs more.
          This quote adds {herringbonePct}% extra material for herringbone. The other layouts use {standardPct}%.
        </p>
      )}
    </div>
  );
}
