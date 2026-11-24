import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./DesignTool.toolbar.css", import.meta.url), "utf8");

describe("toolbar Edit window button", () => {
  it("replaces the inline window dropdowns with one Edit window button", () => {
    expect(source).not.toContain("designer-toolbar-window-controls");
    expect(source).toContain('aria-label="Edit window"');
    expect(source).toContain('data-testid="edit-window-button"');
    expect(source).toContain("const openEditWindow = useCallback(() => {");
    expect(source).toContain("openWindowAttributes(target.uid);");
    expect(source).toContain('data-testid="window-frame-style-selector"');
    expect(source).toContain('data-testid="window-scene-selector"');
    expect(source).toContain("Garden photo");
    expect(css).toContain("button.designer-toolbar-edit-window");
    expect(css).toContain("height: 48px");
    expect(css).toContain("width: 96px");
  });
});
