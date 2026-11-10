import { describe, expect, it } from "vitest";
import { nicheShelfCount } from "@/components/design/showerFixtureGeometry";
import { showerSurroundPanelFinish } from "@/components/design/InteractiveRoom3D";

/**
 * Tom's reference bathrooms show real surround finishes and a niche with a visible
 * shelf. These lock the two facts the 3D reads.
 */
describe("niche shelves match what Pelican sells", () => {
  it("reads the published shelf count from the product name", () => {
    // Pelican's own niche names.
    expect(nicheShelfCount("PL-SN1614 Single Shelf Shower Niche")).toBe(1);
    expect(nicheShelfCount("PL-SN1627 Double Shelf Shower Niche")).toBe(2);
    expect(nicheShelfCount("PL-SN1639 Triple Shelf Shower Niche")).toBe(3);
  });

  it("also reads a digit form", () => {
    expect(nicheShelfCount("SMC Shower Niche with 2 Shelves")).toBe(2);
    expect(nicheShelfCount("niche 3 shelf")).toBe(3);
  });

  it("does not invent shelves for an unstated niche", () => {
    expect(nicheShelfCount("Shower Niche")).toBe(0);
    expect(nicheShelfCount(null)).toBe(0);
  });

  it("caps at three, which is the deepest product Pelican sells", () => {
    expect(nicheShelfCount("niche with 9 shelves")).toBe(3);
  });
});

describe("shower surround finishes are real and light", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return (r! * 0.2126 + g! * 0.7152 + b! * 0.0722) / 255;
  };

  it("gives the published finishes a light stone colour, never a dark panel", () => {
    for (const code of ["PL-603074 White Brick", "PL-603096 White Wood", "PL-603696 Marble", "PL-603274 Grey Wood"]) {
      const finish = showerSurroundPanelFinish(code);
      expect(luminance(finish.color), code).toBeGreaterThan(0.72);
    }
  });

  it("distinguishes marble from white from grey", () => {
    const marble = showerSurroundPanelFinish("PL-603696 Marble");
    const white = showerSurroundPanelFinish("PL-603096 White Wood");
    const grey = showerSurroundPanelFinish("PL-603274 Grey Wood");
    expect(marble.color).not.toBe(white.color);
    expect(grey.color).not.toBe(white.color);
    expect(luminance(grey.color)).toBeLessThan(luminance(white.color));
  });

  it("falls back to a light neutral for an unknown code", () => {
    expect(luminance(showerSurroundPanelFinish("PL-99999").color)).toBeGreaterThan(0.72);
    expect(luminance(showerSurroundPanelFinish(null).color)).toBeGreaterThan(0.72);
  });
});
