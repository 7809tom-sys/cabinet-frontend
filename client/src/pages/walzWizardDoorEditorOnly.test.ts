import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** The designer UI. None of these may mount the wizard or its wheels. */
const designerFiles = [
  "client/src/pages/DesignTool.tsx",
  "client/src/components/design/InteractiveRoom3D.tsx",
  "client/src/components/design/ElevationView.tsx",
  "client/src/components/design/IslandElevationView.tsx",
  "client/src/components/vendor/ClosetWallElevation.tsx",
  "client/src/pages/VendorClosetStudio.tsx",
];

const wizardMarkers = [
  "DoorEditorWalzAudit",
  "door-editor-walzcraft-audit",
  "wizard-stain-wheel",
  "wizard-paint-wheel",
  "wizard-paint-code",
  "wizard-stain-code",
  "wizard-model-number",
  "wizard-profile-image",
];

function read(relative: string): string {
  return readFileSync(path.join(repo, relative), "utf8");
}

describe("the WalzCraft wizard stays on the door editor", () => {
  it("is not mounted in the designer, the wall section, or the closet", () => {
    for (const file of designerFiles) {
      const source = read(file);
      for (const marker of wizardMarkers) {
        expect(source, `${file} must not contain ${marker}`).not.toContain(marker);
      }
    }
  });

  it("is mounted in the door editor", () => {
    const editor = read("client/src/components/admin/FeaturedStylesAdmin.tsx");
    expect(editor).toContain("<DoorEditorWalzAudit");
    const wizard = read("client/src/components/admin/DoorEditorWalzAudit.tsx");
    expect(wizard).toContain("door-editor-walzcraft-audit");
    expect(wizard).toContain("wizard-stain-wheel");
    expect(wizard).toContain("wizard-paint-wheel");
  });

  it("reaches the designer only through the shared face plan, never through a component", () => {
    // The designer reads the wizard's door through designerFacePlan, which delegates to the
    // shared pickup module. That module holds no UI.
    const facePlan = read("client/src/lib/designerFacePlan.ts");
    expect(facePlan).toContain("@shared/walzcraftDesignerPickup");
    const pickup = read("shared/walzcraftDesignerPickup.ts");
    expect(pickup).not.toContain("useState");
    expect(pickup).not.toContain("useEffect");
    expect(pickup).not.toContain("jsx");
  });
});
