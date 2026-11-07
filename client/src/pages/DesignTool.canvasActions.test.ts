import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../components/design/HardwareCatalogPicker.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./DesignTool.toolbar.css", import.meta.url), "utf8");

describe("floating canvas action rail wiring", () => {
  it("mounts inside the canvas so it floats over the 3D stage", () => {
    const canvas = designTool.slice(designTool.indexOf('data-testid="designer-canvas"'));
    const rail = canvas.indexOf("<CanvasActionRail");
    const firstPlanBlock = canvas.indexOf("{showCountertopToast");
    expect(rail).toBeGreaterThan(-1);
    expect(rail).toBeLessThan(firstPlanBlock);
  });

  it("routes Add cabinet to the existing catalog affordance instead of a second add path", () => {
    const rail = designTool.slice(designTool.indexOf("<CanvasActionRail"), designTool.indexOf("/>", designTool.indexOf("<CanvasActionRail")));
    // Same drawer the toolbar "Add cabinet" button opens.
    expect(rail).toContain('setMobilePanel("catalog")');
    // No new cabinet-creation logic: the rail never calls addCabinet itself.
    expect(rail).not.toContain("addCabinet(");
  });

  it("routes Add hardware to the one real Hardware Resources picker", () => {
    expect(designTool).toContain('onAddHardware={() => setHardwarePickerSignal((signal) => signal + 1)}');
    expect(designTool).toContain("openSignal={hardwarePickerSignal}");
    // The picker opens the dialog it already owns; there is no second dialog.
    expect(picker).toContain("const lastOpenSignal = useRef(openSignal ?? 0);");
    expect(picker).toContain("if (signal === lastOpenSignal.current) return;");
    expect(picker).toContain("setOpen(true);");
    // Mounting the Designer must not pop the picker open.
    expect(picker).toContain("useRef(openSignal ?? 0)");
  });

  it("keeps the existing toolbar buttons and the new rail side by side", () => {
    // The existing triggers stay exactly where they were — this is additive.
    expect(picker).toContain('data-testid="designer-real-hardware-trigger"');
    expect(designTool).toContain('data-testid="tablet-add-cabinet"');
    // The rail's own test ids live in the rail component.
    const railSource = readFileSync(new URL("../components/design/CanvasActionRail.tsx", import.meta.url), "utf8");
    expect(railSource).toContain('data-testid="canvas-quick-add-cabinet"');
    expect(railSource).toContain('data-testid="canvas-quick-add-hardware"');
  });

  it("stays visible in canvas-only mode", () => {
    // Only the Designer's own bars are hidden; the rail is never guarded by
    // canvasOnly. On a phone/tablet-portrait width it is hidden alongside the
    // bottom strip — but NOT in canvas-only mode, where that strip is gone and
    // this rail is the only control left (Auto Design must stay reachable).
    const rail = designTool.slice(designTool.indexOf("<CanvasActionRail"), designTool.indexOf("/>", designTool.indexOf("<CanvasActionRail")));
    expect(rail).toContain("hidden={isMobile && !canvasOnly}");
    expect(rail).not.toContain("hidden={isMobile}");
    // A bare canvasOnly guard would hide the rail exactly when it is needed.
    expect(rail).not.toContain("hidden={canvasOnly}");
  });

  it("keeps the rail clear of safe-area insets on a tablet", () => {
    expect(css).toContain('[data-testid="three-d-floating-actions"]');
    expect(css).toContain("safe-area-inset-left");
  });
});
