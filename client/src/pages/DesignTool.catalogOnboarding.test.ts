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

  it("shows a scrollable door-card grid and selects a style from the sample photo", () => {
    const selectorStart = source.indexOf('data-testid="fresh-room-door-style-step"');
    const selectorEnd = source.indexOf('data-testid="fresh-room-door-style-preview"', selectorStart);
    const selector = source.slice(selectorStart, selectorEnd);

    expect(selectorStart).toBeGreaterThan(-1);
    expect(selectorEnd).toBeGreaterThan(selectorStart);
    expect(selector).toContain('data-testid="fresh-room-door-style-option"');
    expect(selector).toContain('aria-label={`${name} door thumbnail`}');
    expect(selector).toContain('const photoUrl = preferredDoorReferenceUrl(style);');
    expect(selector).toContain('onClick={() => setSlotStyle("A", style.id)}');
    expect(selector).toContain('aria-pressed={selected}');
    expect(selector).toContain("overflow-y-auto");
    expect(selector).toContain("<DoorSamplePhoto url={photoUrl} alt=\"\" className=\"h-36 w-full\" />");
    expect(source).toContain('loading="lazy"');
    expect(source).toContain("object-contain");
  });

  it("shows the selected door and drawer sample above the continue button", () => {
    const previewStart = source.indexOf('data-testid="fresh-room-door-style-preview"');
    const footerStart = source.indexOf("<DialogFooter>", previewStart);
    const preview = source.slice(previewStart, footerStart);

    expect(previewStart).toBeGreaterThan(-1);
    expect(footerStart).toBeGreaterThan(previewStart);
    expect(preview).toContain("<StyleSamplePreview");
    expect(preview).toContain("showImageCheck={isAdmin}");
    expect(preview).toContain("finish={activeFinish}");
    expect(preview).not.toContain("h-52");
    expect(preview).not.toContain("activeDrawerSampleUrl");
    expect(source).toContain("preferredDrawerReferenceUrl(style)");
  });

  it("stacks the selected cabinet door photo, style name, and distributor on desktop and mobile", () => {
    const identityCount = source.split('data-testid="selected-cabinet-door-identity"').length - 1;
    expect(identityCount).toBe(1);
    expect(source).toContain("<SelectedCabinetDoorIdentity");
    expect(source.split("<SelectedCabinetDoorIdentity").length - 1).toBe(2);
    expect(source).toContain('className="h-16 w-12 rounded border border-neutral-200 bg-white object-contain"');
    expect(source).toContain('data-testid="selected-cabinet-door-distributor"');
    expect(source).toContain("text-[10px] leading-tight text-muted-foreground");
    expect(source).toContain("const activeStyleDistributorName = useMemo(");
    expect(source).toContain("distributorNameById.get(distributorId)");
    expect(source).toContain("styleDistributorId ?? catalogDistributorId");
    expect(source).toContain('data-testid="selected-cabinet-door-color-chip"');
    expect(source).not.toContain('className="h-9 w-9 rounded border border-border object-cover"');
    expect(source).not.toContain("hidden md:inline text-[10px] leading-tight text-muted-foreground");
  });
});
