import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../components/design/HardwareCatalogPicker.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./DesignTool.toolbar.css", import.meta.url), "utf8");

describe("floating canvas action rail wiring", () => {
  it("renders the 2D/elevation rail inside the canvas, and hands the 3D view the same buttons inline", () => {
    const canvas = designTool.slice(designTool.indexOf('data-testid="designer-canvas"'));
    const rail = canvas.indexOf("<CanvasActionRail");
    const firstPlanBlock = canvas.indexOf("{showCountertopToast");
    expect(rail).toBeGreaterThan(-1);
    expect(rail).toBeLessThan(firstPlanBlock);
  });

  it("routes Add cabinet to the existing catalog affordance instead of a second add path", () => {
    const rail = designTool.slice(designTool.indexOf("const threeDFloatingQuickActions"), designTool.indexOf("const renderNativeThreeDCanvas"));
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
    // The rail's own test ids live in the rail component, built from the caller's
    // prefix so the column copy and this copy stay individually addressable.
    const railSource = readFileSync(new URL("../components/design/CanvasActionRail.tsx", import.meta.url), "utf8");
    expect(railSource).toContain("data-testid={`${testIdPrefix}-add-cabinet`}");
    expect(railSource).toContain("data-testid={`${testIdPrefix}-add-hardware`}");
    expect(railSource).toContain("testIdPrefix = \"canvas-quick\"");
  });

  it("keeps the 3D quick adds in the one floating column instead of a second rail", () => {
    // The 3D viewer owns the right-edge column, so the standalone rail must not
    // also draw over the 3D stage: two rails on the same edge is exactly the
    // staggered layout the owner asked us to remove.
    // The positioned rail is the one rendered from inside the canvas; the two
    // `inline` copies that feed the 3D column come first in the file.
    const canvas = designTool.slice(designTool.indexOf('data-testid="designer-canvas"'));
    const railStart = canvas.indexOf("<CanvasActionRail");
    const rail = canvas.slice(railStart, canvas.indexOf("/>", railStart));
    expect(rail).toContain('hidden={isMobile || viewMode === "threeD" || viewMode === "hybrid"}');
    // The same handlers are handed to the viewer's column as inline buttons.
    expect(designTool).toContain("floatingQuickActions={threeDFloatingQuickActions}");
    expect(designTool).toContain("floatingAutoDesignAction={threeDFloatingAutoDesignAction}");
    // Never gated by canvasOnly: in that mode the column is the only control left.
    expect(rail).not.toContain("hidden={canvasOnly}");
  });

  it("keeps the rail clear of safe-area insets on a tablet", () => {
    expect(css).toContain('[data-testid="three-d-floating-actions"]');
    expect(css).toContain("safe-area-inset-left");
  });
});
