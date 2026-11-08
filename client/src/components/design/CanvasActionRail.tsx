import { Boxes, Ruler, Wrench } from "lucide-react";
import {
  FloatingColumnButton,
  FloatingColumnLabel,
} from "./floatingColumn";

/**
 * The actions the owner actually uses, as thumb-sized icons:
 * add a cabinet, add hardware, and — in a kitchen — Auto-Design.
 *
 * This is an additive fast path, not a redesign. It owns no business logic — it
 * receives the same handlers the existing toolbar buttons call, so a cabinet
 * added here goes through the same validation, pricing and cart code.
 *
 * Two ways to render the same buttons:
 * - `inline`: just the buttons, no positioning. The 3D viewer's floating column
 *   uses this so the quick adds sit in the ONE right-edge column with zoom, pan
 *   and the rest, all the same size.
 * - default: the original positioned rail over the 2D plan and elevation views,
 *   which have no floating column of their own.
 *
 * Layout notes:
 * - 44×44 minimum touch targets, stacked with an 8px gap.
 * - The visible icon is paired with a small text label and a title/aria-label,
 *   so the action is readable on a tablet without hovering; the column drops the
 *   label automatically when it gets tight, and the tooltip still names it.
 * - It stays mounted in canvas-only mode; the Designer only hides its own bars.
 */
export type CanvasActionRailProps = {
  onAddCabinet: () => void;
  onAddHardware: () => void;
  /**
   * The page's existing Auto-Design opener. Omitted where Auto-Design is not
   * offered (a bathroom, laundry, closet, or other room), which hides the action.
   */
  onAutoDesign?: () => void;
  /** True when the plan is not empty or is locked, so Auto-Design cannot start. */
  autoDesignDisabled?: boolean;
  /** The page's shared reason for a disabled Auto-Design, shown as the tooltip. */
  autoDesignDisabledReason?: string;
  /** True when the design is locked or measuring, so adding is not allowed. */
  addCabinetDisabled?: boolean;
  /** Explains a disabled Add cabinet. Shown as the tooltip. */
  addCabinetDisabledReason?: string;
  /** "Add closet parts" replaces "Add cabinet" in the closet workspace. */
  addCabinetLabel?: string;
  /** The phone/tablet bottom bar already carries these; hidden there to avoid two fast paths. */
  hidden?: boolean;
  /** Render only the buttons, for the caller's own floating column. */
  inline?: boolean;
  /** Which actions to render. Defaults to all three. */
  actions?: ReadonlyArray<"cabinet" | "hardware" | "autoDesign">;
  /** Adds a test id prefix so the inline copy and the rail copy stay distinct. */
  testIdPrefix?: string;
};

export const AUTO_DESIGN_DEFAULT_TITLE =
  "Auto-Design a kitchen from four fixed fixture anchors";

/**
 * Shared rail geometry for the positioned copy. Anchored near the TOP of the
 * right edge, because the bottom-right corner belongs to the 3D column and the
 * floor-plan zoom controls.
 */
export const CANVAS_ACTION_RAIL_CLASS =
  "absolute right-2 top-[6.75rem] z-30 flex flex-col items-center gap-2";

export function CanvasActionRail({
  onAddCabinet,
  onAddHardware,
  onAutoDesign,
  autoDesignDisabled = false,
  autoDesignDisabledReason,
  addCabinetDisabled = false,
  addCabinetDisabledReason,
  addCabinetLabel = "Add cabinet",
  hidden = false,
  inline = false,
  actions = ["cabinet", "hardware", "autoDesign"],
  testIdPrefix = "canvas-quick",
}: CanvasActionRailProps) {
  if (hidden) return null;
  const cabinetTitle =
    addCabinetDisabled && addCabinetDisabledReason
      ? addCabinetDisabledReason
      : `${addCabinetLabel} — choose a cabinet from the catalog`;
  const autoDesignTitle =
    autoDesignDisabled && autoDesignDisabledReason
      ? autoDesignDisabledReason
      : AUTO_DESIGN_DEFAULT_TITLE;

  const buttons = (
    <>
      {actions.includes("cabinet") && (
        <FloatingColumnButton
          data-testid={`${testIdPrefix}-add-cabinet`}
          onClick={onAddCabinet}
          disabled={addCabinetDisabled}
          label={addCabinetLabel}
          tooltip={cabinetTitle}
        >
          <Boxes className="h-5 w-5" aria-hidden="true" />
          <FloatingColumnLabel>Cabinet</FloatingColumnLabel>
        </FloatingColumnButton>
      )}
      {actions.includes("hardware") && (
        <FloatingColumnButton
          data-testid={`${testIdPrefix}-add-hardware`}
          onClick={onAddHardware}
          label="Add hardware"
          tooltip="Add hardware — choose real knobs, pulls, and cup pulls for this design"
        >
          <Wrench className="h-5 w-5" aria-hidden="true" />
          <FloatingColumnLabel>Hardware</FloatingColumnLabel>
        </FloatingColumnButton>
      )}
      {actions.includes("autoDesign") && onAutoDesign && (
        <FloatingColumnButton
          data-testid={`${testIdPrefix}-auto-design`}
          onClick={onAutoDesign}
          disabled={autoDesignDisabled}
          label="Auto-Design"
          tooltip={autoDesignTitle}
          accent
        >
          <Ruler className="h-5 w-5" aria-hidden="true" />
          <FloatingColumnLabel>Auto</FloatingColumnLabel>
        </FloatingColumnButton>
      )}
    </>
  );

  if (inline) {
    return (
      <div
        data-testid="designer-canvas-action-buttons"
        className="contents"
        // The column floats over the 3D stage, which treats pointer-down as a
        // selection gesture. Stop the press so tapping a button never also
        // selects or deselects a cabinet behind it.
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        {buttons}
      </div>
    );
  }

  return (
    <div
      data-testid="designer-canvas-action-rail"
      className={CANVAS_ACTION_RAIL_CLASS}
      role="group"
      aria-label="Quick canvas actions"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      {buttons}
    </div>
  );
}
