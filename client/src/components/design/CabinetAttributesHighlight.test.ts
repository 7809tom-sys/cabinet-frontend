import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const planSource = readFileSync(resolve(root, "client/src/components/design/PlanCanvas.tsx"), "utf8");
const elevationSource = readFileSync(resolve(root, "client/src/components/design/ElevationView.tsx"), "utf8");
const islandSource = readFileSync(resolve(root, "client/src/components/design/IslandElevationView.tsx"), "utf8");
const cornerSource = readFileSync(resolve(root, "client/src/components/design/CornerView.tsx"), "utf8");
const threeDSource = readFileSync(resolve(root, "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");
const dialogSource = readFileSync(resolve(root, "client/src/components/design/CabinetAttributesDialog.tsx"), "utf8");
const designToolSource = readFileSync(resolve(root, "client/src/pages/DesignTool.tsx"), "utf8");

describe("Cabinet Attributes active target highlighting", () => {
  it("uses the open attributes target rather than ordinary selection alone", () => {
    expect(designToolSource).toContain("const attributesTargetUid = attrOpen ? attrUid : null");
    expect(designToolSource).toContain("attributesTargetUid={attributesTargetUid}");
    expect(designToolSource).toContain("if (!open) setAttrUid(null);");
  });

  it("adds a clear active-target cue to plan, elevation, island, and corner views", () => {
    for (const source of [planSource, elevationSource, islandSource, cornerSource]) {
      expect(source).toContain("attributesTargetUid");
    }
    expect(planSource).toContain('data-cabinet-attributes-target={isAttributesTarget ? "true" : undefined}');
    expect(elevationSource).toContain('data-cabinet-attributes-target={isAttributesTarget ? "true" : undefined}');
    expect(islandSource).toContain('data-cabinet-attributes-target={isAttributesTarget ? "true" : undefined}');
    expect(planSource).toContain('data-testid="plan-cabinet-attributes-target"');
    expect(elevationSource).toContain('data-testid="elevation-cabinet-attributes-target"');
    expect(islandSource).toContain('data-testid="island-cabinet-attributes-target"');
    expect(threeDSource).toContain("cabinet-attributes-target-outline");
    expect(threeDSource).toContain("cabinetAttributesTarget: true");
  });

  it("names the exact active cabinet in the attributes panel", () => {
    expect(dialogSource).toContain('data-testid="cabinet-attributes-active-target"');
    expect(dialogSource).toContain("Editing this cabinet");
    expect(dialogSource).toContain("highlighted in the active Designer view");
  });

  it("offers the Wizard shortcut only when the selected cabinet is safely editable", () => {
    expect(dialogSource).toContain("wizardBuiltEditable?: boolean;");
    expect(dialogSource).toContain("onJumpToWizard?: (uid: string) => void;");
    expect(dialogSource).toContain('data-testid="cabinet-wizard-jump-panel"');
    expect(dialogSource).toContain('data-testid="jump-to-peninsula-wizard"');
    expect(dialogSource).toContain("This cabinet belongs to an editable Peninsula Wizard assembly.");
  });

  it("tells a saved refrigerator when requested panels have no real source-SKU placements", () => {
    expect(dialogSource).toContain("refrigeratorPanelsRequestedButMissing?: boolean;");
    expect(dialogSource).toContain("no real catalog panel SKUs are placed");
    expect(dialogSource).toContain('aria-label="Configure refrigerator side panels"');
    expect(designToolSource).toContain("attrRefrigeratorPanelsRequestedButMissing");
    expect(designToolSource).toContain("onSetRefrigeratorSidePanels={(uid) => {");
    expect(designToolSource).toContain("setFridgeDialog({ fridgeUid: uid });");
  });
});
