import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, ListChecks, X } from "lucide-react";
import { FloatingColumnButton } from "./floatingColumn";

/**
 * The Bathroom setup checklist as one button in the canvas's floating column.
 *
 * It used to be an always-open panel pinned to the right edge, which sat on top of
 * the floating button column (PR 339) and covered it in both Plan and 3D. Now it is a
 * single 44 x 44 button in that same column, and the checklist opens as a popover to
 * the LEFT of the column so the buttons stay reachable.
 *
 * It starts closed and never auto-opens: nothing appears over the drawing surface
 * unless the shopper asks for it. Clicking the button again, the close X, Escape, or
 * a click outside all close it.
 */

export type BathroomChecklistStep = {
  id: string;
  label: string;
  detail: string;
  complete: boolean;
  optional?: boolean;
};

export type BathroomSetupChecklistProps = {
  steps: readonly BathroomChecklistStep[];
  /** Core choices that are done, and how many core choices there are. */
  completed: number;
  required: number;
  /** Opens the fixture picker, optionally at a specific checklist step. */
  onBrowseFixtures: (stepId?: string) => void;
  /** Optional id prefix so two copies on one page keep unique aria wiring. */
  idPrefix?: string;
};

/** The checklist body, shared by the popover so the content stays identical. */
function ChecklistBody({ steps, completed, required, onBrowseFixtures, onClose }: BathroomSetupChecklistProps & { onClose: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#1a2744]">Bathroom setup checklist</p>
          <p className="mt-0.5 text-[11px] text-slate-600">{completed} of {required} core choices selected</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onBrowseFixtures()}
            className="rounded border border-[#1a2744]/35 px-2 py-1 text-[10px] font-semibold text-[#1a2744] hover:bg-slate-100"
          >
            Browse fixtures
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bathroom setup checklist"
            data-testid="bathroom-checklist-close"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-[#1a2744]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ol className="mt-2 space-y-1.5">
        {steps.map((step) => (
          <li key={step.id} className={`rounded-lg border px-2 py-1.5 ${step.complete ? "border-emerald-200 bg-emerald-50/80" : "border-slate-200 bg-white/80"}`}>
            <button type="button" onClick={() => onBrowseFixtures(step.id)} className="flex w-full items-start gap-2 text-left">
              <span aria-hidden className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[9px] ${step.complete ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400 text-transparent"}`}>✓</span>
              <span className="min-w-0">
                <span className="font-semibold text-slate-800">{step.label}{step.optional ? " (optional)" : ""}</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-slate-600">{step.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-2 border-t border-slate-200 pt-2 text-[10px] leading-snug text-slate-600">
        Checklist notes are visual planning aids. Confirm fixture clearances, opening swings, and installation
        conditions with the official product sheets and qualified local guidance.
      </p>
    </>
  );
}

/**
 * The button + popover pair.
 *
 * `FloatingColumnButton` supplies the exact 44 x 44 size, icon, tooltip and
 * focus styling the rest of the column uses, so this control cannot drift out of
 * line with it.
 */
export function BathroomSetupChecklist(props: BathroomSetupChecklistProps) {
  const [open, setOpen] = useState(false);
  /**
   * Which way the panel opens. In the Plan column the button sits high, so the panel
   * hangs downward; in the 3D column it sits near the bottom, so the panel grows
   * upward. Anchoring blindly either way ran the checklist off the viewport.
   */
  const [opensUp, setOpensUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = `${props.idPrefix ?? "bathroom-checklist"}-${useId()}`.replace(/[^\w-]/g, "");
  const { steps, completed, required, onBrowseFixtures } = props;

  const close = useCallback(() => setOpen(false), []);

  // Decide the direction from the space above and below the button, every time it
  // opens, because the column's height changes with the viewport and the step count.
  useEffect(() => {
    if (!open) return;
    const button = wrapperRef.current?.getBoundingClientRect();
    if (!button) return;
    const spaceBelow = window.innerHeight - button.top;
    const spaceAbove = button.bottom;
    setOpensUp(spaceAbove > spaceBelow);
  }, [open]);

  // Escape closes, and focus returns to the button that opened it.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && wrapperRef.current && !wrapperRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    // `pointerdown` rather than `click`: a click outside must not also activate the
    // control underneath it.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <FloatingColumnButton
        label="Bathroom setup checklist"
        tooltip={`Bathroom setup checklist — ${completed} of ${required} core choices done`}
        data-testid="bathroom-checklist-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={open ? "border-[#1a2744] bg-[#eef2f8]" : undefined}
      >
        <span className="relative flex items-center justify-center">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
          {completed < required && (
            <span
              data-testid="bathroom-checklist-badge"
              aria-hidden="true"
              className="absolute -right-2 -top-1.5 rounded-full bg-[#1a2744] px-1 text-[8px] font-bold leading-3 text-white"
            >
              {completed}/{required}
            </span>
          )}
        </span>
      </FloatingColumnButton>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Bathroom setup checklist"
          data-testid="bathroom-fixture-checklist"
          // Opening to the LEFT of the column: `right-full` anchors the panel's right
          // edge to the button's left edge, so the buttons stay uncovered.
          className={`absolute right-full z-40 mr-2 w-[min(20rem,calc(100vw-6rem))] overflow-y-auto overscroll-contain rounded-xl border border-[#1a2744]/25 bg-white/98 p-3 text-xs shadow-xl backdrop-blur ${
            opensUp ? "bottom-0 max-h-[min(60vh,28rem)]" : "top-0 max-h-[min(75vh,34rem)]"
          }`}
        >
          <ChecklistBody {...props} onClose={close} />
        </div>
      )}
    </div>
  );
}

/** Small progress readout, for callers that want the count without the panel. */
export function BathroomSetupChecklistSummary({ completed, required }: { completed: number; required: number }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      {completed} of {required} core choices selected
    </span>
  );
}

export default BathroomSetupChecklist;
