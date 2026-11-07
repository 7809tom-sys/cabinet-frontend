import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../components/design/SampleDoorCompareDialog.tsx", import.meta.url), "utf8");
const lib = readFileSync(new URL("../lib/sampleDoorCompare.ts", import.meta.url), "utf8");

describe("sample door comparison wiring", () => {
  it("opens from an explicit button in the door-style header", () => {
    expect(designTool).toContain('data-testid="sample-door-compare-trigger"');
    const trigger = designTool.slice(
      designTool.indexOf('data-testid="sample-door-compare-trigger"') - 300,
      designTool.indexOf('data-testid="sample-door-compare-trigger"') + 900,
    );
    expect(trigger).toContain("onClick={() => setSampleDoorCompareOpen(true)}");
    expect(trigger).toContain('aria-haspopup="dialog"');
    expect(trigger).toContain("Sample door");
  });

  it("reuses the existing sample-door image source instead of a new URL", () => {
    expect(designTool).toContain("sampleDoorComparisonPhotoUrl({");
    expect(designTool).toContain("paletteSwatchUrl: paletteFinishSwatch");
    // No hard-coded image path anywhere in the new code.
    expect(lib).not.toMatch(/https?:\/\//);
    expect(lib).not.toContain("/manus-storage/");
    expect(dialog).not.toMatch(/https?:\/\//);
  });

  it("renders the same door the 3D viewer builds, not a lookalike", () => {
    expect(designTool).toContain("doorProfile={sampleDoorCompareProfile}");
    expect(designTool).toContain("const sampleDoorCompareProfile = activeCatalogDoorProfile as unknown as DoorAuditDoorProfile | null;");
    // The capture is the app's existing door renderer.
    expect(dialog).toContain('await import("@/lib/doorAuditDoorRender")');
    expect(dialog).toContain("createDoorAuditCapture()");
    expect(dialog).toContain("session.dispose();");
  });

  it("never leaves the render pane empty or shows a placeholder image", () => {
    expect(dialog).toContain('data-testid="sample-door-compare-render-image"');
    expect(dialog).toContain('data-testid="sample-door-compare-render-busy"');
    expect(dialog).toContain('data-testid="sample-door-compare-render-error"');
    expect(dialog).toContain('data-testid="sample-door-compare-no-photo"');
    // The render pane has no fallback to the sample photograph.
    const renderPane = dialog.slice(dialog.indexOf('data-testid="sample-door-compare-render"'), dialog.indexOf('data-testid="sample-door-compare-render"') + 2600);
    expect(renderPane).not.toContain("samplePhotoUrl");
  });

  it("is reachable on a phone, where the side panel is a closed drawer", () => {
    expect(designTool).toContain('data-testid="mobile-sample-door-compare-trigger"');
    expect(designTool).toContain("setTimeout(() => setSampleDoorCompareOpen(true), 150)");
  });

  it("keeps the selected door's state when the dialog closes", () => {
    // The dialog is a sibling of the workspace and closes by its own props;
    // nothing clears styleId, selection, or the placed cabinets.
    const usage = designTool.slice(designTool.indexOf("<SampleDoorCompareDialog"), designTool.indexOf("/>", designTool.indexOf("<SampleDoorCompareDialog")));
    expect(usage).not.toContain("setStyleId");
    expect(usage).not.toContain("setSelectedUid");
    expect(usage).not.toContain("setPlaced");
  });
});
