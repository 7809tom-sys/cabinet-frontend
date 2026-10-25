import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pickerSource = readFileSync(new URL("./SurfacesPickerDialog.tsx", import.meta.url), "utf8");
const designerSource = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");

describe("Surfaces picker backsplash On Off control", () => {
  it("keeps a touch-safe, explicit On Off option in the Tile & Mosaic panel", () => {
    expect(pickerSource).toContain('data-testid="backsplash-enabled-control"');
    expect(pickerSource).toContain('data-testid="backsplash-selected-swatch"');
    expect(pickerSource).toContain('data-testid="backsplash-selected-swatch-empty"');
    expect(pickerSource).toContain('aria-label="Backsplash option"');
    expect(pickerSource).toContain("onBacksplashEnabledChange(true)");
    expect(pickerSource).toContain("onBacksplashEnabledChange(false)");
    expect(pickerSource).toContain("stays selected while Off removes it from this plan");
  });

  it("persists the selected tile while excluding it from the current plan when Off", () => {
    expect(designerSource).toContain("const [backsplashEnabled, setBacksplashEnabled] = useState(true)");
    expect(designerSource).toContain("const selectedPlanSurfaces = useMemo");
    expect(designerSource).toContain('surfaceRole(surface) !== "backsplash"');
    expect(designerSource).toContain("buildSurfaceCartLines(selectedPlanSurfaces");
    expect(designerSource).toContain("backsplashEnabled");
  });

  it("gates elevation and both 3D canvases without changing the selected source product", () => {
    expect(designerSource).toContain("backsplashMaterialId={backsplashEnabled ? backsplashMaterialId : null}");
    expect(designerSource).toContain("catalogBacksplashName={backsplashEnabled ? threeDSurfaceProductNames.backsplash : null}");
    expect(designerSource).toContain("catalogBacksplashImageUrl={backsplashEnabled ? threeDSurfaceTextureUrls.backsplash : null}");
    expect(designerSource).toContain("backsplashEnabled");
  });
});
