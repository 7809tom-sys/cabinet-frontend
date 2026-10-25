import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("DesignTool cabinet catalog organization", () => {
  it("orders the five exclusive Base sections requested by the designer", () => {
    const start = source.indexOf('// The "Base" tab is organized by base TYPE');
    const end = source.indexOf("const isBaseFamilyTab", start);
    const block = source.slice(start, end);
    const expected = [
      '{ key: "base", labelKey: "dt_pl_grp_base_std" }',
      '{ key: "drawer", labelKey: "dt_pl_grp_base_drawer" }',
      '{ key: "sink", labelKey: "dt_pl_grp_base_sink" }',
      '{ key: "full-height", labelKey: "dt_pl_grp_base_full_height" }',
      '{ key: "specialty", labelKey: "dt_pl_grp_base_specialty" }',
    ];
    let previous = -1;
    for (const item of expected) {
      const index = block.indexOf(item);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(block).toContain('"full-height": []');
    expect(block).toContain("buckets[baseSubGroup(c)].push(c)");
    expect(block).not.toContain(".filter((g) => g.items.length > 0)");
    expect(source).toContain('{t("dt_pl_no_category")}');
  });

  it("renders one compact counted height selector shared by responsive and desktop catalog layouts", () => {
    expect(source).toContain('data-testid="catalog-height-selector"');
    expect(source).toContain('role="group" aria-label={t("dt_pl_height_filter")}');
    expect(source).toContain("grid grid-cols-3 gap-1");
    expect(source).toContain("aria-pressed={selectedPaletteHeight == null}");
    expect(source).toContain("({option.count})");
    expect(source).toContain("setPaletteHeightByType");
  });

  it("filters the already-scoped supplier/style catalog and forces the selected group open", () => {
    expect(source).toContain("filterCatalogByHeight(filteredPalette, paletteType, selectedPaletteHeight, isCornerBase)");
    expect(source).toContain("const open = searching || selectedPaletteHeight != null || !collapsedGroups.has(groupKey)");
    expect(source).toContain("for (const c of heightFilteredPalette) buckets[baseSubGroup(c)].push(c)");
  });

  it("returns each requested cabinet and part tab to its condensed category headings when selected", () => {
    expect(source).toContain("const COLLAPSIBLE_CATALOG_TABS");
    expect(source).toContain('"base", "corner", "wall", "tall", "appliance", "accessory", "panel"');
    expect(source).toContain("const selectCatalogPaletteTab = useCallback((tab: HeightFilterPaletteType) => {");
    expect(source).toContain("setCatalogCollapseRequest(tab)");
    expect(source).toContain("catalogCollapseRequest !== paletteType");
    expect(source).toContain("groupedPalette.map((group) => `${paletteType}:${group.label}`)");
    expect(source).toContain("onClick={() => { selectCatalogPaletteTab(tab);");
  });

  it("keeps cabinet selection height groups and item dimensions in inches", () => {
    const groupingStart = source.indexOf('if (paletteType === "wall")');
    const groupingEnd = source.indexOf('// The "Base" tab is organized by base TYPE', groupingStart);
    const groupingBlock = source.slice(groupingStart, groupingEnd);
    expect(groupingBlock).toContain('t("dt_pl_grp_high", { h: formatCatalogInchValue(height) })');
    expect(groupingBlock).not.toContain("formatInches(height)");

    const itemStart = source.indexOf("const isBaseBox =");
    const itemEnd = source.indexOf("paletteFinishSwatch", itemStart);
    const itemBlock = source.slice(itemStart, itemEnd);
    expect(itemBlock).toContain("const widthVal = formatCatalogInchValue(dimensions.width)");
    expect(itemBlock).toContain("formatCatalogInchValue(dimensions.height)");
    expect(itemBlock).toContain('{widthVal}"W × {hVal}');
  });

  it("lets a shopper choose a distributor in Catalog before choosing a door style", () => {
    expect(source).toContain('const [catalogDistributorId, setCatalogDistributorId] = useState<number | null>(null);');
    expect(source).toContain('const catalogDistributorScopeId = lockedDistributorId ?? catalogDistributorId;');
    expect(source).toContain('data-testid="catalog-distributor-picker"');
    expect(source).toContain('aria-label="Choose catalog distributor"');
    expect(source).toContain('All distributors');
    expect(source).toContain('onValueChange={(value) => chooseCatalogDistributor(value === "all" ? null : Number(value))}');
    expect(source).toContain('styles={displayUniqueDoorStyles}');
    expect(source).toContain('if (panelDrawerMode) {\n\t                        setMobilePanel("style");');
  });
});
