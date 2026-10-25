export type CompactWorkspaceMoveControlInput = {
  isCompactWorkspace: boolean;
  hasSelectedCabinet: boolean;
  cabinetsLocked: boolean;
  measureMode: boolean;
};

/**
 * Compact Workspace intentionally keeps the canvas clear, so its explicit Move
 * entry is available only when the currently selected cabinet can be moved.
 */
export function canShowCompactWorkspaceMoveControl({
  isCompactWorkspace,
  hasSelectedCabinet,
  cabinetsLocked,
  measureMode,
}: CompactWorkspaceMoveControlInput): boolean {
  return isCompactWorkspace && hasSelectedCabinet && !cabinetsLocked && !measureMode;
}
