import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer desktop viewport fit", () => {
  it("keeps the compact desktop toolbar within the viewport without sideways scrolling", () => {
    const start = source.indexOf('{/* Toolbar */}');
    const toolbarRoot = source.slice(start, source.indexOf('{/* Title + badge', start));
    expect(toolbarRoot).toContain('designer-top-toolbar');
    expect(toolbarRoot).toContain('flex-wrap');
    expect(toolbarRoot).not.toContain('overflow-x-auto');
  });

  it("keeps contextual desktop cabinet controls in one horizontal scroll strip", () => {
    expect(source).toContain('lg:flex-nowrap lg:overflow-x-auto lg:overflow-y-hidden lg:scrollbar-none');
  });

  it("contains the peninsula builder inside the canvas with a scrollable body and persistent creation action", () => {
    expect(source).toContain('data-testid="peninsula-inline-builder"');
    expect(source).toContain('max-h-[calc(100%-1.5rem)]');
    expect(source).toContain('overflow-y-auto overscroll-contain p-3');
    expect(source).toContain('shrink-0 border-t border-[#d4a75a]/45');
    expect(source).toContain('Create straight peninsula');
  });
});
