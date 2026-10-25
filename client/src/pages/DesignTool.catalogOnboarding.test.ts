import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("fresh room catalog onboarding", () => {
  it("opens the distributor and door-style gate after room selection", () => {
    expect(source).toContain("const [catalogSetupOpen, setCatalogSetupOpen] = useState(false);");
    expect(source).toContain("const handleRoomLayoutSelected = useCallback((layoutPresetId: string) => {");
    expect(source).toContain("setCatalogSetupOpen(true);");
    expect(source).toContain("window.setTimeout(() => setCatalogSetupOpen(true), 0);");
    expect(source).toContain("onLayoutSelected={handleRoomLayoutSelected}");
    expect(source).toContain('data-testid="fresh-room-catalog-setup"');
  });

  it("requires distributor before door style and blocks the designer until both are selected", () => {
    expect(source).toContain('data-testid="fresh-room-distributor-step"');
    expect(source).toContain('data-testid="fresh-room-door-style-step"');
    expect(source).toContain('aria-label="Choose cabinet distributor"');
    expect(source).toContain('aria-label="Choose door style"');
    expect(source).toContain("Choose your cabinet vendor and color");
    expect(source).toContain("Door style / color");
    expect(source).toContain("disabled={catalogDistributorId == null || displayUniqueDoorStyles.length === 0}");
    expect(source).toContain("disabled={catalogDistributorId == null || styleId == null}");
    expect(source).toContain("onPointerDownOutside={(event) => event.preventDefault()}");
    expect(source).toContain("onInteractOutside={(event) => event.preventDefault()}");
  });

  it("hands the chosen catalog into the normal cabinet catalog", () => {
    expect(source).toContain('setPaletteType("base");');
    expect(source).toContain('toast.success("Catalog ready. Choose a cabinet to begin your design.")');
  });

  it("shows a readable door thumbnail beside every available door style/color", () => {
    const selectorStart = source.indexOf('data-testid="fresh-room-door-style-step"');
    const selectorEnd = source.indexOf("</Select>", selectorStart);
    const selector = source.slice(selectorStart, selectorEnd);

    expect(selectorStart).toBeGreaterThan(-1);
    expect(selectorEnd).toBeGreaterThan(selectorStart);
    expect(selector).toContain('data-testid="fresh-room-door-style-option"');
    expect(selector).toContain('<DoorStyleSwatch style={style} className="h-12 w-9 shrink-0 rounded border border-border object-cover" />');
    expect(selector).toContain('aria-label={`${affiliateStyleName(style)} door thumbnail`}');
  });
});
