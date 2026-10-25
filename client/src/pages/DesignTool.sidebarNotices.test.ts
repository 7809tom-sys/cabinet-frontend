import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer sidebar reference information and conflict notices", () => {
  it("keeps full manufacturer specifications available from a compact, keyboard-accessible Specs action instead of consuming cart height", () => {
    expect(source).toContain('const [catalogSpecificationsOpen, setCatalogSpecificationsOpen] = useState(false);');
    expect(source).toContain('data-testid="catalog-style-specifications-trigger"');
    expect(source).toContain('aria-label="Open catalog specifications"');
    expect(source).toContain('setCatalogSpecificationsOpen(true)');
    expect(source).toContain('<Dialog open={catalogSpecificationsOpen} onOpenChange={(open) => { if (!open) setCatalogSpecificationsItem(null); setCatalogSpecificationsOpen(open); }}>');
    expect(source).toContain('data-testid="catalog-style-specifications-dialog"');
    expect(source).toContain('Auto-filled from manufacturer sheets');
    expect(source).toContain('Cabinet width, height, and depth remain SKU-specific and are shown on each catalog card.');
  });

  it("moves the dense blocking-conflict summary from the cart footer to a concise live drawing-surface notice with a direct review action", () => {
    expect(source).toContain('data-testid="design-conflict-canvas-notice"');
    expect(source).toContain('aria-label="Review conflict on Floor Plan"');
    expect(source).toContain('setViewMode("plan")');
    expect(source).toContain('selectCabinet(firstConflictUid)');
    expect(source).toContain('It remains in your Cart, but must be corrected before secure ordering.');

    const cartFooterStart = source.indexOf('{/* Total */}');
    const finishSummaryStart = source.indexOf('data-testid="design-finish-selection-summary"', cartFooterStart);
    expect(cartFooterStart).toBeGreaterThan(-1);
    expect(finishSummaryStart).toBeGreaterThan(cartFooterStart);
    const cartFooterBeforeSummary = source.slice(cartFooterStart, finishSummaryStart);
    expect(cartFooterBeforeSummary).not.toContain('A cabinet or filler spacing conflict must be corrected before ordering.');
    expect(cartFooterBeforeSummary).not.toContain('item{conflictUids.size > 1 ? "s" : ""} in conflict.');
  });

  it("continues to keep conflict prevention at cart handoff rather than treating the surface notice as a dismissal", () => {
    expect(source).toContain('if (hasConflicts && !window.confirm(t("dt_confirm_export_conflicts", { n: conflictUids.size, s: conflictUids.size > 1 ? "s" : "" }))) return;');
    expect(source).toContain('conflictUids={conflictUids}');
  });

  it("puts a compact non-placement Specs action beside each regular catalog card", () => {
    expect(source).toContain('data-testid={`catalog-card-specs-${c.masterCode}`}');
    expect(source).toContain('aria-label={`View specifications for ${c.displayMasterCode ?? c.masterCode}`}');
    expect(source).toContain('onClick={(event) => { event.stopPropagation(); openCatalogSpecificationsFor(c); }}');
    expect(source).toContain('title="View this catalog item’s specifications"');
  });

  it("also gives source-backed physical panel and accessory cards a separate Specs action without turning it into placement", () => {
    const accessoryStart = source.indexOf('if (paletteType === "accessory" || paletteType === "panel")');
    const accessoryEnd = source.indexOf('const placementDetail = cabinetPlacementHoverDetail(c);', accessoryStart);
    const accessoryCard = source.slice(accessoryStart, accessoryEnd);

    expect(accessoryStart).toBeGreaterThan(-1);
    expect(accessoryEnd).toBeGreaterThan(accessoryStart);
    expect(accessoryCard).toContain('data-testid={`catalog-noncabinet-card-specs-${c.masterCode}`}');
    expect(accessoryCard).toContain('aria-label={`View specifications for ${c.displayMasterCode ?? c.masterCode}`}');
    expect(accessoryCard).toContain('onClick={(event) => { event.stopPropagation(); openCatalogSpecificationsFor(c); }}');
    expect(accessoryCard).toContain('title="View this catalog item’s specifications"');
    expect(accessoryCard).toContain('onClick={() => addCabinet(c)}');
  });

  it("keeps appliance and surface Specs actions limited to cards with a real manufacturer specification sheet", () => {
    expect(source).toContain('data-testid={`catalog-appliance-card-specs-${c.masterCode}`}');
    expect(source).toContain('paletteType === "appliance" && c.specImageUrl');
    expect(source).toContain('aria-label={`View specifications for ${c.displayMasterCode ?? c.masterCode}`}');

    const surfacePicker = readFileSync(new URL("../components/design/SurfacesPickerDialog.tsx", import.meta.url), "utf8");
    expect(surfacePicker).toContain('export function verifiedSurfaceSpecificationUrl');
    expect(surfacePicker).toContain('verifiedPelicanSinkProfile(item.pelicanCode)?.specificationUrl');
    expect(surfacePicker).toContain('verifiedPelicanFaucetProfile(item.pelicanCode)?.specificationUrl');
    expect(surfacePicker).toContain('verifiedPelicanPotFillerProfile(item.pelicanCode)?.specificationUrl');
    expect(surfacePicker).toContain('verifiedPelicanBathroomFixtureProfile(item.pelicanCode)?.specificationUrl');
    expect(surfacePicker).toContain('const specificationUrl = verifiedSurfaceSpecificationUrl(item);');
    expect(surfacePicker).toContain('data-testid={`surface-card-specs-${p.id}`}');
    expect(surfacePicker).toContain('href={specificationUrl}');
    expect(surfacePicker).toContain('View manufacturer specifications');
  });
});
