import { Maximize2, Minimize2 } from "lucide-react";

export type DesignerFocus3DToggleProps = {
  active: boolean;
  onToggle: () => void;
  testId: string;
  /** Touch/tablet size: a 44px square instead of the 36px desktop square. */
  compact?: boolean;
};

/**
 * The square, thumb-sized Focus 3D control that sits in the 3D viewer's
 * top-right control row. It only switches the workspace chrome; the camera,
 * the plan, and every placement rule stay exactly as they were.
 *
 * It stays a small square while the Designer is visible, and becomes a short
 * "Exit focus" pill once focus mode is on, so the way back is always readable
 * on a tablet that cannot hover a tooltip.
 */
export function DesignerFocus3DToggle({
  active,
  onToggle,
  testId,
  compact = false,
}: DesignerFocus3DToggleProps) {
  const size = compact ? "h-11" : "h-9";
  const shared = `inline-flex ${size} shrink-0 items-center justify-center rounded-md border shadow-sm transition active:scale-95`;
  if (active) {
    return (
      <button
        type="button"
        data-testid={testId}
        aria-pressed
        aria-label="Exit focus"
        title="Exit focus (Esc) — bring back the Designer toolbars"
        onClick={onToggle}
        className={`${shared} gap-1.5 border-[#1a2744] bg-[#1a2744] px-2.5 text-xs font-semibold text-white hover:bg-[#24375f]`}
      >
        <Minimize2 className="h-4 w-4" aria-hidden="true" />
        Exit focus
      </button>
    );
  }
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={false}
      aria-label="Focus 3D"
      title="Focus 3D — fill the screen with this 3D view"
      onClick={onToggle}
      className={`${shared} ${compact ? "w-11" : "w-9"} border-slate-300 bg-white text-[#1a2744] hover:bg-slate-50`}
    >
      <Maximize2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
