import { useEffect, useRef } from "react";

export type PlacedItemContextMenuState = {
  x: number;
  y: number;
  uid: string;
  label: string;
};

/**
 * Right-click menu for a placed cabinet, panel, filler, or appliance.
 * Callers open it only after a click that did not drag.
 *
 * Escape closes it from anywhere on the page. The menu floats over the plan and
 * does not take focus, so without this an open menu stayed on screen while the
 * user pressed Delete or reached for the toolbar — and on a tablet, where there
 * is no Escape key, the only way out was to find another right-click target.
 */
export function PlacedItemContextMenu({
  menu,
  onEdit,
  onMove,
  onRemove,
  onClose,
}: {
  menu: PlacedItemContextMenuState;
  onEdit?: (uid: string) => void;
  onMove?: (uid: string) => void;
  onRemove?: (uid: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const node = menuRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // A nested popup (a Radix select or dialog opened from here) owns its Esc.
      if ((event.target instanceof Element) && (event.target as Element).closest("[data-radix-popper-content-wrapper],[data-slot='dialog-content'],[data-slot='sheet-content']")) return;
      event.preventDefault();
      onClose();
    };
    // Tapping anywhere else dismisses the menu, exactly like a native context
    // menu. It floats over the whole workspace, so a press on a toolbar button,
    // the price panel, or the plan background must all count as "outside".
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (node?.contains(event.target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  const run = (action?: (uid: string) => void) => {
    if (!action) return;
    action(menu.uid);
    onClose();
  };
  return (
    <div
      ref={menuRef}
      role="menu"
      data-testid="placed-item-context-menu"
      data-ui-overlay="placed-item-menu"
      aria-label={`Actions for ${menu.label}`}
      className="fixed z-[80] min-w-40 rounded-lg border border-slate-300 bg-white p-1 pr-8 text-sm shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {/* A menu opened by a long-press on a tablet has no Escape key. Give it a
          thumb-sized close control so it is never a trap. */}
      <button
        type="button"
        data-testid="placed-item-menu-close"
        aria-label={`Close the ${menu.label} actions`}
        title="Close"
        onClick={onClose}
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:scale-95"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
      <p className="px-2 py-1 text-[11px] font-bold text-[#1a2744]">{menu.label}</p>
      {onEdit && (
        <button type="button" role="menuitem" data-testid="placed-item-menu-edit" className="flex w-full rounded px-2 py-1.5 text-left font-semibold text-[#1a2744] hover:bg-slate-100" onClick={() => run(onEdit)}>
          Edit
        </button>
      )}
      {onMove && (
        <button type="button" role="menuitem" data-testid="placed-item-menu-move" className="flex w-full rounded px-2 py-1.5 text-left font-semibold text-[#1a2744] hover:bg-slate-100" onClick={() => run(onMove)}>
          Move
        </button>
      )}
      {onRemove && (
        <button type="button" role="menuitem" data-testid="placed-item-menu-remove" className="flex w-full rounded px-2 py-1.5 text-left font-semibold text-red-700 hover:bg-red-50" onClick={() => run(onRemove)}>
          Remove
        </button>
      )}
    </div>
  );
}
