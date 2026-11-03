/**
 * The on-screen half of `?colorTrace=1`: a small panel an admin can read while
 * looking at the 3D view, next to the console dump of the same data.
 *
 * It shows each cabinet's accepted run, which layer won, any later override, and
 * the hex every surface ended up with. Rows where the surfaces disagree are
 * flagged, because that is the bug it exists to find.
 *
 * Read-only. It draws nothing into the design and never writes anything.
 */
import { colorTraceToText, type ColorTrace } from "@/lib/colorTrace";

const SURFACES = ["front", "box", "sides", "skin", "toeKick"] as const;

function Swatch({ hex }: { hex: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px]">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-black/20"
        style={{ background: hex ?? "transparent" }}
        aria-hidden="true"
      />
      {hex ?? "none"}
    </span>
  );
}

export function ColorTracePanel({
  trace,
  onClose,
  onCopy,
}: {
  trace: ColorTrace;
  onClose: () => void;
  onCopy?: () => void;
}) {
  const mismatched = new Set(trace.mismatches.map((entry) => entry.cabinetUid));
  return (
    <aside
      data-testid="color-trace-panel"
      className="pointer-events-auto fixed bottom-3 left-3 z-[60] max-h-[52vh] w-[min(30rem,92vw)] overflow-y-auto rounded-lg border border-slate-300 bg-white/95 p-2.5 text-[11px] shadow-xl backdrop-blur"
    >
      <header className="mb-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">Color trace</p>
          <p className="truncate text-[10px] text-slate-500">
            {trace.cabinets.length} cabinet(s) · {trace.mismatches.length} mismatch(es)
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              data-testid="color-trace-copy"
              className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Copy
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            data-testid="color-trace-close"
            aria-label="Close the color trace"
            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </header>
      {trace.cabinets.length === 0 && (
        <p className="text-slate-500">No cabinets traced yet. Place or select a cabinet, or reload the 3D view.</p>
      )}
      <ul className="space-y-1.5">
        {trace.cabinets.map((cabinet) => (
          <li
            key={cabinet.cabinetUid}
            data-testid={`color-trace-cabinet-${cabinet.cabinetUid}`}
            className={`rounded border p-1.5 ${mismatched.has(cabinet.cabinetUid) ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`}
          >
            <p className="font-semibold text-slate-900">
              {cabinet.masterCode || cabinet.cabinetUid}
              <span className="ml-1 font-normal text-slate-500">
                style {cabinet.styleId ?? "?"} {cabinet.styleCode ?? ""}
              </span>
              {mismatched.has(cabinet.cabinetUid) && (
                <span className="ml-1 font-semibold text-red-700">surfaces disagree</span>
              )}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {SURFACES.filter((surface) => cabinet.surfaces[surface] !== undefined).map((surface) => (
                <span key={surface} className="text-slate-600">
                  {surface}: <Swatch hex={cabinet.surfaces[surface] ?? null} />
                </span>
              ))}
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] font-medium text-slate-600">
                {cabinet.steps.length} step(s)
              </summary>
              <ol className="mt-1 space-y-0.5">
                {cabinet.steps.map((step, index) => (
                  <li key={`${step.key}-${index}`} className="flex gap-1.5">
                    <span className="w-12 shrink-0 text-right font-mono text-[9px] text-slate-400">+{step.atMs}ms</span>
                    <span className="min-w-0">
                      <span className="font-medium text-slate-800">{step.key}</span>
                      <span className="text-slate-600"> {step.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] text-slate-500">
        Same data in the console. Admin only, and only with <code>?colorTrace=1</code> in the URL.
      </p>
    </aside>
  );
}

/** The console block for the same trace. */
export function logColorTrace(trace: ColorTrace, log: (text: string) => void = console.info): void {
  log(colorTraceToText(trace));
}
