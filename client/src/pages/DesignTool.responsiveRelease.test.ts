import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../../../package.json", import.meta.url), "utf8");

describe("Designer responsive release gate", () => {
  it("keeps the same complete Attributes editor reachable from phone and non-phone workspaces", () => {
    expect(source).toContain('testId="mobile-designer-attributes"');
    expect(source).toContain("onClick={openMobileAttributes}");
    expect(source).toContain('data-testid="desktop-touch-attributes-trigger"');
    expect(source).toContain("onClick={() => openAttributes(selectedCab.uid)}");
    expect(source).toContain("setAttrOpen(true);");
    expect(source).toContain("setCabEditSheetOpen(false);");
  });

  it("keeps essential compact tablet controls direct instead of hiding them behind a desktop-only sidebar", () => {
    expect(source).toContain('data-testid="compact-workspace-show-panels-trigger"');
    expect(source).toContain('data-testid="compact-workspace-materials-trigger"');
    expect(source).toContain('data-testid="compact-workspace-surfaces-trigger"');
    expect(source).toContain('data-testid="compact-workspace-wall-selector"');
    expect(source).toContain('data-testid="compact-workspace-view-selector"');
    expect(source).toContain('data-testid="compact-workspace-move-trigger"');
  });

  it("keeps the responsive control contracts in every production build", () => {
    expect(packageJson).toContain('"test:designer-responsive"');
    expect(packageJson).toContain('"build": "pnpm run test:designer-responsive && vite build');
  });
});
