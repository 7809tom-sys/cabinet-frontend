import { useEffect, useRef } from "react";

export type WallActionsMenuState = {
  x: number;
  y: number;
  label: string;
};

/**
 * Right-click menu for a drawn or rectangular room wall.
 * Edit keeps the existing wall attributes dialog. Add wall opens the dialog
 * that collects length, height, and turn before any geometry is created.
 * Delete wall reuses that same confirm and removes only this wall.
 */
export function WallActionsMenu({
  menu,
  onEdit,
  onAdd,
  onDelete,
  deleteDisabledReason = null,
  onClose,
}: {
  menu: WallActionsMenuState;
  onEdit: () => void;
  onAdd: () => void;
  onDelete?: () => void;
  /** Visible when deleting this wall would leave an invalid room, or the layout is locked. */
  deleteDisabledReason?: string | null;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const node = menuRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if ((event.target instanceof Element) && event.target.closest("[data-radix-popper-content-wrapper],[data-slot='dialog-content'],[data-slot='sheet-content']")) return;
      event.preventDefault();
      onClose();
    };
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

  const blockedReason = deleteDisabledReason ?? (onDelete ? null : "This wall cannot be deleted.");
  const left = typeof window === "undefined" ? menu.x : Math.max(8, Math.min(menu.x, window.innerWidth - 240));
  const top = typeof window === "undefined" ? menu.y : Math.max(8, Math.min(menu.y, window.innerHeight - (blockedReason ? 280 : 176)));

  return (
    <div
      ref={menuRef}
      role="menu"
      data-testid="wall-actions-menu"
      aria-label={`Actions for ${menu.label}`}
      className="fixed z-[80] min-w-40 max-w-56 rounded-lg border border-slate-300 bg-white p-1 pr-8 text-sm shadow-lg"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        data-testid="wall-actions-menu-close"
        aria-label={`Close the ${menu.label} actions`}
        title="Close"
        onClick={onClose}
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
      <p className="px-2 py-1 text-[11px] font-bold text-[#1a2744]">{menu.label}</p>
      <button type="button" role="menuitem" data-testid="wall-actions-edit" className="flex w-full rounded px-2 py-1.5 text-left font-semibold text-[#1a2744] hover:bg-slate-100" onClick={() => { onEdit(); onClose(); }}>
        Edit wall
      </button>
      <button type="button" role="menuitem" data-testid="wall-actions-add" className="flex w-full rounded px-2 py-1.5 text-left font-semibold text-[#1a2744] hover:bg-slate-100" onClick={() => { onAdd(); onClose(); }}>
        Add wall
      </button>
      <button
        type="button"
        role="menuitem"
        data-testid="wall-actions-delete"
        disabled={Boolean(blockedReason)}
        aria-disabled={Boolean(blockedReason)}
        aria-describedby={blockedReason ? "wall-actions-delete-reason" : undefined}
        title={blockedReason ?? "Delete this wall"}
        className={`flex w-full rounded px-2 py-1.5 text-left font-semibold ${blockedReason ? "cursor-not-allowed text-red-300" : "text-red-700 hover:bg-red-50"}`}
        onClick={() => {
          if (blockedReason || !onDelete) return;
          onDelete();
          onClose();
        }}
      >
        Delete wall
      </button>
      {blockedReason ? (
        <p id="wall-actions-delete-reason" data-testid="wall-actions-delete-reason" className="px-2 pb-1 text-[11px] font-medium leading-4 text-red-700">
          {blockedReason}
        </p>
      ) : null}
    </div>
  );
}
