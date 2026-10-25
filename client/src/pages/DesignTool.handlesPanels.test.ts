import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("regular Designer handles and Panels integration", () => {
  it("starts and resets only this Designer with visible handles, preserving saved None metadata", () => {
    expect(source).toContain("useState<HardwareStyleId>(DEFAULT_DESIGNER_HARDWARE_STYLE_ID)");
    expect(source).toContain("setHardwareStyleId(DEFAULT_DESIGNER_HARDWARE_STYLE_ID)");
    expect(source).toContain('<CabinetHandlesControl value={hardwareStyleId} onChange={setGenericHardwareStyle} tablet={isTabletWorkspace} />');
    expect(source).toContain('if (typeof d.hardwareStyleId === "string") setHardwareStyleId(d.hardwareStyleId as HardwareStyleId);');
  });
  it("uses a real selected hardware SKU as one current-priced material and cart line, with generic quote fallback", () => {
    expect(source).toContain('HardwareCatalogPicker');
    expect(source).toContain('catalogHardwareSelection');
    expect(source).toContain('normalizeCatalogHardwareSelection');
    expect(source).toContain('catalogHardwareReferenceUrl={catalogHardwareSelection?.imageUrl ?? HARDWARE_STYLES');
    expect(source).toContain('trpc.hardware.selected.useQuery');
    expect(source).toContain('productKind: "hardware"');
    expect(source).toContain('vendorProductId: selectedPricedHardware.id');
    expect(source).toContain('const hardwareLines: CartItem[]');
    expect(source).toContain('!hasSelectedPricedHardware && hwSchedule.total > 0');
  });
  it("makes Panels explicit, pressed-state accessible and non-scrolling on tablets", () => {
    expect(source).toContain('tab === "panel"');
    expect(source).toContain('aria-pressed={paletteType === tab}');
    expect(source).toContain('data-testid="designer-catalog-tabs"');
    const i = source.indexOf('data-testid="designer-catalog-tabs"');
    expect(source.slice(i, i + 250)).toContain('flex flex-wrap');
    expect(source.slice(i, i + 250)).not.toContain('overflow-x-auto');
  });
  it("uses the existing scoped accessory query and shared physical panel filter", () => {
    expect(source).toContain('paletteType === "accessory" || paletteType === "panel"');
    expect(source.match(/if \(paletteType === "panel"\) return isPanelPaletteItem\(c\);/g)).toHaveLength(2);
    expect(source).toContain('styleId: styleId ?? undefined');
    expect(source).toContain('distributorId: catalogDistributorScopeId ?? undefined');
  });
  it("keeps panel clicks/drags in the accessory branch and existing 3/4-inch stock handling", () => {
    expect(source).toContain('(forceAccessory || paletteType === "accessory" || paletteType === "panel")');
    expect(source).toContain('(paletteType === "accessory" || paletteType === "panel") && isPlaceableAccessory(data)');
    expect(source).toContain('paletteType === "accessory" || paletteType === "panel" ? "Accessory" : "Cabinet"');
    expect(source).toContain('const isFlatPanel = isAccessory && isPanelItem(c);');
    expect(source).toContain('isPanelItem(item) ? 0.75 : footprintDepth(item)');
  });
});
