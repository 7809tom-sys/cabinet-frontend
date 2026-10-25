import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/design/SurfacesPickerDialog.tsx"),
  "utf8",
);

// Measured in the real Designer at a 1560x715 window: the card ScrollArea was a flex
// item without min-h-0, so it grew to its content height (4,078px for quartz, 7,821px
// for sinks & faucets) inside an overflow-hidden dialog. scrollHeight === clientHeight,
// so nothing could be scrolled and the cards below the fold were unreachable.
describe("SurfacesPickerDialog scrolling", () => {
  it("lets the card grid shrink to the dialog so it actually scrolls", () => {
    const tag = source.match(/<ScrollArea className="([^"]*)"/);
    expect(tag).not.toBeNull();
    const classes = (tag?.[1] ?? "").split(/\s+/);
    expect(classes).toContain("flex-1");
    expect(classes).toContain("min-h-0");
  });

  it("keeps only the tabs and search fixed; tall explanatory panels scroll with the cards", () => {
    const scrollStart = source.indexOf("<ScrollArea");
    expect(scrollStart).toBeGreaterThan(-1);
    const scrollBody = source.slice(scrollStart);
    const fixedControls = source.slice(source.indexOf("{/* Category tabs + search */}"), scrollStart);

    for (const marker of [
      'data-testid="backsplash-enabled-control"',
      'data-testid="countertop-priced-coverage"',
      'data-testid="countertop-selection-availability"',
      'data-testid="selected-bathroom-fixture-preview"',
    ]) {
      expect(fixedControls, `${marker} must not sit in the fixed header`).not.toContain(marker);
      expect(scrollBody, `${marker} must scroll with the cards`).toContain(marker);
    }
    // The search box and tabs stay pinned above the scroll area.
    expect(fixedControls).toContain('data-testid="pelican-style-filter"');
    expect(fixedControls).toContain("setCategory(c)");
  });
});
