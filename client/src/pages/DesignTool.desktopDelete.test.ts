import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

/** The bar's `selectedCab && !drawMode && !isMobile` action block. */
function desktopBarActions(): string {
  const start = source.indexOf("Contextual row: keep desktop cabinet editing inline");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("{isMobile && selectedCab && !drawMode", start);
  expect(end).toBeGreaterThan(start);
  const bar = source.slice(start, end);
  const actionsStart = bar.indexOf("{selectedCab && !drawMode && !isMobile && (");
  expect(actionsStart).toBeGreaterThan(-1);
  return bar.slice(actionsStart);
}

describe("desktop selected-cabinet bar can delete", () => {
  it("offers a red Delete control beside Edit door style", () => {
    const actions = desktopBarActions();
    const editDoorStyle = actions.indexOf('testId="selected-cabinet-edit-door-style"');
    const del = actions.indexOf('data-testid="selected-cabinet-delete"');
    expect(editDoorStyle).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(editDoorStyle);
    const block = actions.slice(del, del + 1200);
    expect(block).toContain("border-red-300");
    expect(block).toContain("text-red-700");
    expect(block).toContain("<Trash2");
    expect(block).toContain("Delete {selectedCab.masterCode}");
  });

  it("uses the same lock checks and the same delete call as the mobile sheet", () => {
    const actions = desktopBarActions();
    const del = actions.indexOf('data-testid="selected-cabinet-delete"');
    const block = actions.slice(del, del + 1200);
    expect(block).toContain("disabled={cabinetsLocked || Boolean(selectedCab.locked)}");
    expect(block).toContain('toast.info("Cabinets are locked — unlock them before deleting.")');
    expect(block).toContain('toast.info("This cabinet is locked — unlock it before deleting.")');
    expect(block).toContain("deleteCabinet(selectedCab.uid)");

    // The mobile sheet's control is unchanged, so both routes share one delete.
    const mobile = source.indexOf('data-testid="mobile-selected-cabinet-delete"');
    expect(mobile).toBeGreaterThan(-1);
    expect(source.slice(mobile, mobile + 900)).toContain("deleteCabinet(selectedCab.uid)");
  });

  it("passes onDelete to both Floor Plan instances, so the item menu shows Remove", () => {
    const matches = source.match(/onDelete=\{deleteCabinet\}/g) ?? [];
    expect(matches).toHaveLength(2);
    // deleteCabinet routes through the one removal path, which is what keeps the
    // cart and the countertop in step with the drawing.
    expect(source).toContain("const deleteCabinet = useCallback((uid: string) => {");
    const deleteStart = source.indexOf("const deleteCabinet = useCallback((uid: string) => {");
    expect(source.slice(deleteStart, deleteStart + 200)).toContain("requestCabinetDeletion(uid)");
  });

  it("deletes the selected cabinet from Delete/Backspace, wherever focus is", () => {
    const keyboard = source.indexOf("Keyboard: Delete/Backspace removes the selected cabinet");
    expect(keyboard).toBeGreaterThan(-1);
    const block = source.slice(keyboard, keyboard + 2400);
    expect(block).toContain('(e.key === "Delete" || e.key === "Backspace") && selectedUid');
    expect(block).toContain("deleteCabinet(selectedUid)");
    expect(block).toContain('window.addEventListener("keydown", onKey)');
    // Typing in a field must never delete a cabinet.
    expect(block).toContain('if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || editable) return;');
  });
});
