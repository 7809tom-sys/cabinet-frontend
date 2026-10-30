export type PlacedItemContextMenuState = {
  x: number;
  y: number;
  uid: string;
  label: string;
};

/**
 * Right-click menu for a placed cabinet, panel, filler, or appliance.
 * Callers open it only after a click that did not drag.
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
  const run = (action?: (uid: string) => void) => {
    if (!action) return;
    action(menu.uid);
    onClose();
  };
  return (
    <div
      role="menu"
      data-testid="placed-item-context-menu"
      data-ui-overlay="placed-item-menu"
      aria-label={`Actions for ${menu.label}`}
      className="fixed z-[80] min-w-40 rounded-lg border border-slate-300 bg-white p-1 text-sm shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
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
