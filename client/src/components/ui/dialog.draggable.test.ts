import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dialogSource = readFileSync(resolve(process.cwd(), "client/src/components/ui/dialog.tsx"), "utf8");
const alertDialogSource = readFileSync(resolve(process.cwd(), "client/src/components/ui/alert-dialog.tsx"), "utf8");
const popupDragGripSource = readFileSync(resolve(process.cwd(), "client/src/components/ui/PopupDragGrip.tsx"), "utf8");

describe("movable popup headers", () => {
  it("uses an explicit grip-only drag button for standard dialogs", () => {
    expect(popupDragGripSource).toContain('data-popup-drag-handle="true"');
    expect(popupDragGripSource).toContain('aria-label="Drag to move this popup"');
    expect(dialogSource).not.toContain('data-dialog-drag-handle="true"');
    expect(dialogSource).toContain('onPointerCancel={handlePointerCancel}');
    expect(dialogSource).toContain('onLostPointerCapture={handleLostPointerCapture}');
    expect(dialogSource).toContain("event.currentTarget.setPointerCapture(event.pointerId)");
	    expect(dialogSource).toContain("calc(-50% + ${dragOffset.x}px) calc(-50% + ${dragOffset.y}px)");
    expect(dialogSource).toContain("PopupDragGrip");
    expect(dialogSource).toContain("readPopupSessionPosition");
    expect(dialogSource).toContain("writePopupSessionPosition");
  });

  it("gives confirmation dialogs the same grip-only drag behavior", () => {
    expect(alertDialogSource).not.toContain('data-alert-dialog-drag-handle="true"');
    expect(alertDialogSource).toContain('onPointerCancel={handlePointerCancel}');
    expect(alertDialogSource).toContain('onLostPointerCapture={handleLostPointerCapture}');
    expect(alertDialogSource).toContain("event.currentTarget.setPointerCapture(event.pointerId)");
    expect(alertDialogSource).toContain("function AlertDialogTitle");
    expect(alertDialogSource).toContain("PopupDragGrip");
    expect(alertDialogSource).toContain("readPopupSessionPosition");
    expect(alertDialogSource).toContain("writePopupSessionPosition");
  });
});
