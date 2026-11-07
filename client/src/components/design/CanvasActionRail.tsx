import { Boxes, Wrench } from "lucide-react";

/**
 * The two actions the owner actually uses, as thumb-sized icons floating on the
 * right edge of the canvas: Add a cabinet and Add hardware.
 *
 * This is an additive fast path, not a redesign. It owns no business logic — it
 * receives the same handlers the existing toolbar buttons call, so a cabinet
 * added here goes through the same validation, pricing and cart code.
 *
 * Layout notes:
 * - 44×44 minimum touch targets, stacked with an 8px gap, vertically centred so
 *   they clear the immersive toggle (top-right) and the zoom/pan rail
 *   (bottom-right) at every width.
 * - The visible icon is paired with a small text label and a title/aria-label,
 *   so the action is readable on a tablet without hovering.
 * - It stays mounted in canvas-only mode; the Designer only hides its own bars.
 */
export type CanvasActionRailProps = {
  onAddCabinet: () => void;
  onAddHardware: () => void;
  /** True when the design is locked or measuring, so adding is not allowed. */
  addCabinetDisabled?: boolean;
  /** Explains a disabled Add cabinet. Shown as the tooltip. */
  addCabinetDisabledReason?: string;
  /** "Add closet parts" replaces "Add cabinet" in the closet workspace. */
  addCabinetLabel?: string;
  /** The phone/tablet bottom bar already carries these; hidden there to avoid two fast paths. */
  hidden?: boolean;
};

const ITEM_CLASS =
  "group inline-flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-[#d9cdb4] bg-white/95 text-[8px] font-semibold leading-none text-[#1a2744] shadow-md backdrop-blur transition hover:bg-white hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2744] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white/95 disabled:hover:shadow-md";

/**
 * Shared rail geometry. Kept as data so the layout test pins it.
 *
 * Anchored near the TOP of the right edge, directly under the fullscreen toggle
 * and the canvas-tools row. The bottom-right corner already belongs to the
 * zoom / reset / pan rail, which is up to 380px tall, so a vertically centred
 * rail would sit on top of it at desktop and tablet heights.
 */
export const CANVAS_ACTION_RAIL_CLASS =
  "absolute right-2 top-[6.75rem] z-30 flex flex-col items-center gap-2";

export function CanvasActionRail({
  onAddCabinet,
  onAddHardware,
  addCabinetDisabled = false,
  addCabinetDisabledReason,
  addCabinetLabel = "Add cabinet",
  hidden = false,
}: CanvasActionRailProps) {
  if (hidden) return null;
  const cabinetTitle = addCabinetDisabled && addCabinetDisabledReason ? addCabinetDisabledReason : `${addCabinetLabel} — choose a cabinet from the catalog`;
  return (
    <div
      data-testid="designer-canvas-action-rail"
      className={CANVAS_ACTION_RAIL_CLASS}
      role="group"
      aria-label="Quick canvas actions"
      // The rail floats over the 3D stage, which treats pointer-down as a
      // selection gesture. Stop the press so tapping a button never also
      // selects or deselects a cabinet behind it.
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        data-testid="canvas-quick-add-cabinet"
        onClick={onAddCabinet}
        disabled={addCabinetDisabled}
        title={cabinetTitle}
        aria-label={addCabinetLabel}
        className={ITEM_CLASS}
      >
        <Boxes className="h-5 w-5" aria-hidden="true" />
        <span aria-hidden="true">Cabinet</span>
      </button>
      <button
        type="button"
        data-testid="canvas-quick-add-hardware"
        onClick={onAddHardware}
        title="Add hardware — choose real knobs, pulls, and cup pulls for this design"
        aria-label="Add hardware"
        className={ITEM_CLASS}
      >
        <Wrench className="h-5 w-5" aria-hidden="true" />
        <span aria-hidden="true">Hardware</span>
      </button>
    </div>
  );
}
