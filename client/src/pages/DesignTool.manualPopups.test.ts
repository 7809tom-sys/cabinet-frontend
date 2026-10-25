import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(__dirname, "DesignTool.tsx"), "utf8");

describe("DesignTool manual titled popups", () => {
  it("uses the shared dedicated drag grip for the sink/range and oven chooser flows", () => {
    expect(source).toContain('import { DraggableOverlayDialog } from "@/components/ui/DraggableOverlayDialog"');
    expect(source).toContain('import { PopupDragGrip } from "@/components/ui/PopupDragGrip"');
    expect((source.match(/<DraggableOverlayDialog/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((source.match(/<PopupDragGrip/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(source).not.toContain('data-popup-drag-handle="true"');
    expect(source).not.toContain('cursor-grab select-none');
    expect(source).not.toContain('fixed inset-0 z-[300] flex items-center justify-center" role="dialog"');
  });
});
