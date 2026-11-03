/**
 * Regression guard for Tom's report: the auto-designer's corner cabinet choice
 * used to be offered and then disappeared.
 *
 * The component was never deleted. PR #114
 * ("Place Auto-Design corners automatically, with a 12\" measured-fridge slide",
 * merge commit 5e6babc / commit b43ac24) made the build place corners
 * automatically and removed the dialog from DesignTool's render tree while
 * keeping the import and the component on disk, so nothing failed and no test
 * noticed. These checks fail if the dialog is ever dropped from the render tree
 * again, and they pin the type-then-size picks the pop-up must offer.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import realCatalog from "@/lib/__fixtures__/autoDesignRealCatalog.json";
import type { DesignCabinet } from "@/lib/design";
import { cornerCatalogForLayer, cornerChoiceGroups } from "@/lib/autoDesignCornerChoice";

const designToolSource = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const dialogSource = readFileSync(new URL("../components/design/AutoDesignCornerDialog.tsx", import.meta.url), "utf8");

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[] };
const REAL = realCatalog as unknown as Record<string, Pack>;

describe("the auto-designer still offers a corner cabinet choice", () => {
  it("renders AutoDesignCornerDialog from the Designer", () => {
    expect(designToolSource).toContain("import { AutoDesignCornerDialog }");
    // The regression: the import stayed but the element was removed, so a bare
    // import check is not enough.
    expect(designToolSource).toContain("<AutoDesignCornerDialog");
    expect(designToolSource).toMatch(/\{autoDesignAvailable && autoDesignCornerStage && \(\s*<AutoDesignCornerDialog/);
  });

  it("passes the real corner options, the upper-corner options, and the fit for each corner", () => {
    expect(designToolSource).toContain("slots={autoDesignCornerStage.slots}");
    expect(designToolSource).toContain("options={autoDesignCornerStage.cornerOptions}");
    expect(designToolSource).toContain("wallOptions={cornerCatalogForLayer(autoDesignCornerStage.wallPool, \"wall\")");
    expect(designToolSource).toContain("fitBySlot={autoDesignCornerStage.cornerFit}");
    expect(designToolSource).toContain("onConfirm={completeAutoDesignLayout}");
  });

  it("offers a type dropdown and a size dropdown, and never preselects a corner", () => {
    expect(dialogSource).toContain("auto-design-corner-type-");
    expect(dialogSource).toContain("auto-design-corner-size-");
    // Both dropdowns start empty: no default type, no default size.
    expect(dialogSource).toContain("Pick a kind");
    expect(dialogSource).toContain("Pick a kind first");
    expect(dialogSource).not.toContain("preferredAutoDesignCorner");
  });

  it("keeps the homeowner wording: no SKU is the only label on a choice", () => {
    expect(dialogSource).toContain("Choose your corner cabinets");
    expect(dialogSource).toContain("We will not guess one.");
    expect(dialogSource).not.toContain("rejected.map");
    expect(dialogSource).not.toContain("slotOptions.map((option) => <SelectItem key={option.id} value={String(option.id)}>{option.masterCode} — {option.description}</SelectItem>)");
  });
});

describe("the corner choice list is the line's own products", () => {
  it("offers every base corner kind Ashford sells, at every size it sells", () => {
    const groups = cornerChoiceGroups(cornerCatalogForLayer(REAL["330011"]!.base, "base") as never);
    const byType = Object.fromEntries(groups.map((group) => [group.type, group.options.map((option) => option.widthIn)]));
    expect(byType["lazy-susan"]).toEqual(expect.arrayContaining([33, 36]));
    expect(byType.blind).toContain(36);
  });

  it("treats upper corners as their own products, not the base corners reused", () => {
    const baseIds = new Set(cornerCatalogForLayer(REAL["330011"]!.base, "base").map((row) => row.id));
    const wallRows = cornerCatalogForLayer(REAL["330011"]!.wall, "wall");
    expect(wallRows.length).toBeGreaterThan(0);
    for (const row of wallRows) expect(baseIds.has(row.id)).toBe(false);
  });
});
