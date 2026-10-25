import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./DesignTool.toolbar.css", import.meta.url), "utf8");

describe("Designer toolbar Pelican entry point", () => {
  it("puts a labelled Pelican button right after the real-hardware picker", () => {
    const hardware = source.indexOf("<HardwareCatalogPicker");
    const pelican = source.indexOf('data-testid="designer-pelican-trigger"');
    expect(hardware).toBeGreaterThan(-1);
    expect(pelican).toBeGreaterThan(hardware);
    // Nothing else sits between the two controls, so they read as a pair.
    expect(pelican - hardware).toBeLessThan(1200);
    expect(source.slice(pelican, pelican + 1600)).toContain(">Pelican</span>");
  });

  it("opens the same Surfaces & Fixtures catalog as the lower-right rail button", () => {
    expect(source).toContain("const openPelicanCatalog = () => {");
    const handler = source.indexOf("const openPelicanCatalog = () => {");
    const body = source.slice(handler, handler + 400);
    expect(body).toContain("setSurfacesOpen(true)");
    expect(body).toContain('setBathroomCatalogMode(roomType === "bathroom" && paletteType === "surfaces" ? "surfaces" : "fixtures")');
    expect(source).toContain("onClick={openPelicanCatalog}");
  });

  it("shows how many Pelican products are already in the design", () => {
    const pelican = source.indexOf('data-testid="designer-pelican-trigger"');
    const block = source.slice(pelican, pelican + 1800);
    expect(block).toContain("selectedSurfaces.length > 0");
    expect(block).toContain("{selectedSurfaces.length}");
  });

  it("is hidden for closets, where Pelican surfaces do not apply", () => {
    const pelican = source.indexOf('data-testid="designer-pelican-trigger"');
    expect(source.slice(pelican - 200, pelican)).toContain('roomType !== "closet"');
  });

  it("gets the same compact desktop sizing as the hardware picker so Save stays on screen", () => {
    expect(css).toContain('[data-testid="designer-pelican-trigger"]');
    const hardwareRule = css.indexOf('[data-testid="designer-real-hardware-trigger"],');
    const pelicanRule = css.indexOf('[data-testid="designer-pelican-trigger"]');
    expect(pelicanRule).toBeGreaterThan(hardwareRule);
    expect(pelicanRule - hardwareRule).toBeLessThan(300);
  });

  it("keeps the scrolling desktop rail as the containing block so sr-only labels cannot widen the page", () => {
    // Measured in the real Designer at 1440-1500px: adding one more toolbar button
    // let the buttons' absolutely positioned sr-only spans escape the rail's clip
    // and push the document 16px wider than the window. Hidden: no overflow.
    const rail = css.indexOf("@media (min-width: 1280px)");
    expect(rail).toBeGreaterThan(-1);
    const block = css.slice(rail, css.indexOf("flex-shrink: 0;", rail));
    expect(block).toContain("overflow-x: auto;");
    expect(block).toContain("position: relative;");
  });
});
