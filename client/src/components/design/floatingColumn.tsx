import "./floatingColumn.css";
import { useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The one floating column on the right edge of the drawing surface.
 *
 * The owner's ask: every floating control — fullscreen, the canvas controls
 * (panels) menu, zoom, add cabinet, add hardware, auto design, reset, share,
 * lighting, final preview — sits on ONE vertical axis in ONE column, every
 * button the same size, with the PAN pad last at the bottom of the drawing
 * surface. The column hangs off the bottom-right corner of the canvas, so it
 * keeps the same place in normal mode, in fullscreen (Focus 3D) mode and on a
 * tablet.
 *
 * Everything here is layout and labelling only: no button reads or changes a
 * design, a price, or the cart. Each button keeps the handler its owner passed.
 */

export const THREE_D_FLOATING_COLUMN_TEST_ID = "three-d-floating-column";

/**
 * Column container: anchored to the bottom-right corner of the drawing surface
 * with the canvas's own padding. `flex-col` plus the bottom anchor is what puts
 * the PAN pad (last child) at the bottom and stacks everything else above it.
 *
 * `max-h` + `overflow-y-auto` is the last resort on a very short canvas: the
 * buttons compress first (see `floatingColumn.css`), and only past that does the
 * column scroll inside itself, so the stack is never cut off by the stage's
 * `overflow-hidden`.
 */
export const THREE_D_VIEWER_COLUMN_CLASS =
  "three-d-floating-column absolute right-2 bottom-3 z-30 flex w-max max-h-[calc(100%-0.25rem)] flex-col items-center gap-1 overflow-y-auto overscroll-contain pb-1 sm:right-3";

/** Marks one square floating button so the column sizes every one alike. */
export const THREE_D_FLOATING_BUTTON_CLASS = "three-d-floating-button";

/**
 * One button style for the whole column: a square white target with a thin
 * border. `h-11 w-11` is the 44px touch target the rail has always promised;
 * `floatingColumn.css` lowers both dimensions together for every button when the
 * viewport is short, so the column stays one even line instead of drifting into
 * the staggered rows it had before.
 */
export const THREE_D_VIEWER_BUTTON_CLASS =
  `flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0 rounded-md border border-slate-300 bg-white text-[#1a2744] shadow-sm transition hover:bg-slate-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2744] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45 ${THREE_D_FLOATING_BUTTON_CLASS}`;

/** Auto Design and the final photo preview keep the gold accent so they read as AI actions. */
export const THREE_D_VIEWER_ACCENT_BUTTON_CLASS =
  `${THREE_D_VIEWER_BUTTON_CLASS} border-[#d4a75a] text-[#765416] hover:bg-[#fffaf1]`;

/**
 * One PAN pad arrow. Deliberately smaller than a column button: the pad is a 3x3
 * cluster, and three 44px cells plus the PAN label would be wider than the
 * column it has to sit in.
 */
export const THREE_D_VIEWER_PAN_CELL_CLASS =
  "three-d-floating-pan-cell flex h-7 w-7 items-center justify-center border border-slate-300 bg-white text-[#1a2744] transition hover:bg-slate-50 active:scale-95";

/**
 * The hover description bubble, drawn as a fixed layer on `document.body`.
 *
 * It used to be an absolutely positioned child of the button, styled by
 * `floatingColumn.css`. That cannot work here: the column is `overflow-y-auto`
 * and the 3D stage is `overflow-hidden`, so the bubble was clipped at the
 * column's own edge, and any z-index inside the stage's stacking context lost to
 * the pricing panel beside it. Tom saw the bubble cut off behind
 * "Current Selections", and on a narrow viewport not at all.
 *
 * `fixed` + `z-[9999]` + a portal is the only combination that escapes both the
 * clipping and the stacking context, so the bubble is always whole and always on
 * top. It stays CSS-styled (no stateful popover inside the render loop).
 */
export const THREE_D_FLOATING_TOOLTIP_PORTAL_CLASS = "three-d-floating-tooltip-portal fixed z-[9999]";

/** Kept for the legacy in-flow bubble; still used by the sr-only description. */
export const THREE_D_FLOATING_TOOLTIP_CLASS = "three-d-floating-tooltip";

/** The bubble's max width, shared with the positioning maths below. */
const TOOLTIP_MAX_WIDTH = 260;
const TOOLTIP_GAP = 10;

type FloatingColumnButtonProps = {
  /** Accessible name — the real action, e.g. "Zoom in". */
  label: string;
  /** Hover description when the action needs more than its name. */
  tooltip?: string;
  accent?: boolean;
  /** "cell" is the smaller square used inside the 3x3 PAN pad. */
  shape?: "button" | "cell";
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title" | "aria-label">;

/**
 * One button in the floating column.
 *
 * Four ways to learn what it does, because one is never enough: a hover
 * description beside the button (also shown on keyboard focus), `title` for a
 * long press on touch, `aria-label` for a screen reader, and `aria-describedby`
 * so the description is read with the button rather than only seen.
 */
export function FloatingColumnButton({
  label,
  tooltip,
  accent = false,
  shape = "button",
  children,
  className = "",
  id,
  ...buttonProps
}: FloatingColumnButtonProps) {
  const description = tooltip ?? label;
  // A stable id so the description is announced with the button (`aria-describedby`)
  // as well as drawn beside it. `useId` keeps it unique when the page renders two
  // columns (the tablet copy and the desktop copy).
  const reactId = useId();
  const descriptionId = `${id ?? "three-d-floating"}-${reactId}-description`.replace(/[^\w-]/g, "");
  const base =
    shape === "cell"
      ? THREE_D_VIEWER_PAN_CELL_CLASS
      : accent
        ? THREE_D_VIEWER_ACCENT_BUTTON_CLASS
        : THREE_D_VIEWER_BUTTON_CLASS;

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number; side: "left" | "right" } | null>(null);

  /**
   * Place the bubble beside the button in viewport coordinates.
   *
   * It sits to the LEFT of the column, because the column hugs the right edge and
   * that is where the open canvas is. On a narrow screen where it would not fit,
   * it flips to the right of the button and is clamped inside the viewport, so a
   * phone still shows the whole description.
   */
  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    const roomOnLeft = rect.left - TOOLTIP_GAP;
    const roomOnRight = viewportWidth - rect.right - TOOLTIP_GAP;
    const openLeft = roomOnLeft >= Math.min(TOOLTIP_MAX_WIDTH, viewportWidth * 0.7)
      || roomOnLeft >= roomOnRight;

    // `left` is the bubble's RIGHT edge when opening left, because the CSS uses
    // `transform: translateX(-100%)`; when opening right it is the LEFT edge.
    let left: number;
    if (openLeft) {
      left = Math.max(rect.left - TOOLTIP_GAP, TOOLTIP_MAX_WIDTH + TOOLTIP_GAP);
      // If the clamp pushed it past the button, fall back to the right side.
      if (left - TOOLTIP_MAX_WIDTH < TOOLTIP_GAP) {
        left = Math.min(rect.right + TOOLTIP_GAP + TOOLTIP_MAX_WIDTH, viewportWidth - TOOLTIP_GAP);
        setAnchor({ left, top: rect.top + rect.height / 2, side: "right" });
        return;
      }
      setAnchor({ left, top: rect.top + rect.height / 2, side: "left" });
    } else {
      left = Math.min(rect.right + TOOLTIP_GAP, viewportWidth - TOOLTIP_GAP);
      setAnchor({ left, top: rect.top + rect.height / 2, side: "right" });
    }
  }, []);

  const showTooltip = useCallback(() => place(), [place]);
  const hideTooltip = useCallback(() => setAnchor(null), []);

  // Scrolling or resizing moves the button under an open bubble, so re-anchor it
  // rather than leave it pointing at where the button used to be.
  useEffect(() => {
    if (!anchor) return;
    const update = () => place();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, place]);

  const side = anchor?.side ?? "left";

  return (
    <span className="three-d-floating-item relative flex shrink-0 items-center justify-center">
      <button
        ref={buttonRef}
        type="button"
        {...buttonProps}
        id={id}
        aria-label={label}
        aria-describedby={descriptionId}
        title={description}
        className={`${base} ${className}`.trim()}
        onPointerEnter={showTooltip}
        onPointerLeave={hideTooltip}
        onPointerDown={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </button>
      {/* Always present so `aria-describedby` resolves, and touch screens — which
          can never hover — still have the action named for assistive tech. */}
      <span id={descriptionId} role="tooltip" className="sr-only">
        {description}
      </span>
      {anchor && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              aria-hidden="true"
              data-testid={`floating-tooltip-${label.replace(/\s+/g, "-").toLowerCase()}`}
              data-side={side}
              className={THREE_D_FLOATING_TOOLTIP_PORTAL_CLASS}
              style={{
                left: anchor.left,
                top: anchor.top,
                maxWidth: TOOLTIP_MAX_WIDTH,
                transform: `translate(${side === "left" ? "-100%" : "0"}, -50%)`,
              }}
            >
              {description}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

/**
 * The small visible label under an icon. Only the quick-add actions carry one;
 * the CSS drops it as soon as the column gets tight, and the tooltip and
 * aria-label still name the action.
 */
export function FloatingColumnLabel({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="three-d-floating-label text-[8px] font-semibold leading-none">
      {children}
    </span>
  );
}
