import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const toolbarStart = source.indexOf('{/* Toolbar */}');
const toolbar = source.slice(toolbarStart, source.indexOf('{/* Mobile room size indicator', toolbarStart));

describe("compact Designer top toolbar", () => {
  it("wraps controls instead of requiring horizontal scrolling in every workspace mode", () => {
    const root = toolbar.slice(0, toolbar.indexOf('{/* Title + badge'));
    expect(root).toContain("designer-top-toolbar");
    expect(root).toContain("flex-wrap");
    expect(root).not.toContain("overflow-x-auto");
    expect(root).not.toContain("flex-nowrap");
  });

  it("keeps compact visible labels and full accessible names on the original actions", () => {
    expect(toolbar).toContain('aria-label="Floor Plan"');
    expect(toolbar).toContain('aria-label="3D View"');
    expect(toolbar).toContain('aria-label="Room layout"');
    expect(toolbar).toContain('aria-label="Peninsula Wizard"');
    expect(toolbar).toContain('aria-label="Materials & Parts"');
    expect(toolbar).toContain('className="designer-toolbar-short-label">Plan</span>');
    expect(toolbar).toContain('className="designer-toolbar-short-label">3D</span>');
    expect(toolbar).toContain('className="designer-toolbar-short-label">Layout</span>');
    expect(toolbar).toContain('className="designer-toolbar-short-label">Materials</span>');
    expect(toolbar).toContain('onClick={openPeninsulaWizard}');
    expect(toolbar).toContain('onClick={() => setMaterialsListOpen(true)}');
    expect(toolbar).toContain('onClick={() => setLayoutStarterOpen(true)}');
  });

  it("uses a one-row compact desktop treatment before a common monitor toolbar begins to crowd the drawing", () => {
    const css = readFileSync(new URL("./DesignTool.toolbar.css", import.meta.url), "utf8");
    expect(css).toContain("@container (max-width: 2100px)");
    expect(css).toContain("height: var(--designer-toolbar-control-height)");
    expect(css).toContain("padding-inline: 5px");
    expect(css).toContain("--designer-toolbar-control-height: 30px");
    expect(css).toContain(".designer-toolbar-title");
    expect(css).toContain("overflow-x: auto");
  });

  it("scopes sizing to this toolbar and preserves tablet touch-target heights", () => {
    const css = readFileSync(new URL("./DesignTool.toolbar.css", import.meta.url), "utf8");
    expect(source).toContain('import "./DesignTool.toolbar.css";');
    expect(css).toContain("container-type: inline-size");
    expect(css).toContain('.designer-top-toolbar[data-tablet-workspace="true"]');
    expect(css).toContain("min-height: 40px");
    expect(css).not.toContain("transform: scale");
  });
});
