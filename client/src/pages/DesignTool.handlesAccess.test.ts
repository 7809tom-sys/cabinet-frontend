import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const designer = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const viewer = readFileSync(new URL("../components/design/InteractiveRoom3D.tsx", import.meta.url), "utf8");

describe("regular Designer Handles access beyond the main toolbar", () => {
  it("passes the same persisted hardware state callback to both actual 3D viewers", () => {
    const viewers = designer.split("<InteractiveRoom3D").slice(1).map(block => block.slice(0, block.indexOf("/>")));
    expect(viewers).toHaveLength(2);
    for (const block of viewers) {
      expect(block).toContain("hardwareStyleId={hardwareStyleId}");
      expect(block).toContain("onHardwareStyleChange={setHardwareStyleId}");
    }
  });
  it("keeps optional in-canvas controls in the existing desktop and tablet/mobile tool rows", () => {
    expect(viewer).toContain("onHardwareStyleChange?: (style: HardwareStyleId) => void;");
    expect(viewer).toContain('hardwareStyleId = "none", onHardwareStyleChange,');
    expect(viewer.match(/<ThreeDHandlesControl value={hardwareStyleId} onChange={onHardwareStyleChange}/g)).toHaveLength(3);
    const canvas = viewer.slice(viewer.indexOf('ref={mountRef}'), viewer.indexOf('{selectedCabinet && (() =>'));
    expect(canvas.match(/<ThreeDHandlesControl/g)).toHaveLength(2);
    expect(canvas).toContain("onHardwareStyleChange &&");
  });
  it("makes the existing hardware chooser recognizable as Handles in More tools", () => {
    expect(designer).toContain('data-testid="designer-more-handles"');
    expect(designer).toContain("Handles &amp; knobs");
    expect(designer).toContain("setHardwareSheetOpen(true)");
  });
});
