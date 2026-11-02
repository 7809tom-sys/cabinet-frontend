import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const forbidden = [
  "client/src/pages/DesignTool.tsx",
  "client/src/components/design/InteractiveRoom3D.tsx",
  "client/src/components/design/ElevationView.tsx",
  "client/src/components/design/IslandElevationView.tsx",
  "client/src/components/vendor/ClosetWallElevation.tsx",
  "client/src/pages/VendorClosetStudio.tsx",
];

describe("WalzCraft audit stays on the door editor", () => {
  it("is not mounted in the designer, the wall section, or the closet", () => {
    for (const file of forbidden) {
      const source = readFileSync(path.join(repo, file), "utf8");
      expect(source, file).not.toContain("DoorEditorWalzAudit");
      expect(source, file).not.toContain("door-editor-walzcraft-audit");
      expect(source, file).not.toContain("PlanWalzCraftWizard");
    }
    const editor = readFileSync(path.join(repo, "client/src/components/admin/FeaturedStylesAdmin.tsx"), "utf8");
    const wizard = readFileSync(path.join(repo, "client/src/components/admin/DoorEditorWalzAudit.tsx"), "utf8");
    expect(editor).toContain("<DoorEditorWalzAudit");
    expect(wizard).toContain("door-editor-walzcraft-audit");
  });
});
