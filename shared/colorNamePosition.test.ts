import { describe, expect, it } from "vitest";
import {
  clampMarker,
  colorNameFamily,
  colorNamePosition,
  positionForHex,
} from "./colorNamePosition";
import { PAINT_FINISH, STAIN_FINISH, wizardColorPosition, type WizardColor } from "./walzcraftWizardColor";
import { paintColorByCode } from "./sherwinWilliamsPaint";

/** A brand color: a real name and a real hex, but no published SW chip code. */
function brandColor(name: string, hex: string, finish: "paint" | "stain" = "paint"): WizardColor {
  return {
    finish: finish === "stain" ? STAIN_FINISH : PAINT_FINISH,
    hex,
    code: `BRAND-${name.replace(/\s+/g, "-").toUpperCase()}`,
    name,
    label: name,
    keepsGrain: finish === "stain",
    source: "walzcraft/brand data",
  } as WizardColor;
}

describe("color name -> marker family", () => {
  it("reads the obvious color words", () => {
    expect(colorNameFamily("Casselberry")).toBeNull();
    expect(colorNameFamily("Navy")).toBe("blue");
    expect(colorNameFamily("Aero Sage")).toBe("green");
    expect(colorNameFamily("Classic White")).toBe("white");
    expect(colorNameFamily("Midnight Black")).toBe("black");
    expect(colorNameFamily("Dove Gray")).toBe("gray");
    expect(colorNameFamily("Warm Beige")).toBe("beige");
    expect(colorNameFamily("Forest Rust")).toBe("red");
    expect(colorNameFamily("Honey Gold")).toBe("yellow");
    expect(colorNameFamily("Plum")).toBe("purple");
    expect(colorNameFamily("Espresso")).toBe("brown");
  });

  it("lets the specific neutral word beat a bare hue word", () => {
    // "Blue Gray" is a gray, and "Navy Blue" is blue.
    expect(colorNameFamily("Blue Gray")).toBe("gray");
    expect(colorNameFamily("Navy Blue")).toBe("blue");
    expect(colorNameFamily("Warm White")).toBe("white");
  });

  it("never returns an extreme for a named color", () => {
    for (const name of ["Navy", "Sage", "White", "Black", "Beige", "Gray", "Red", "Blue"]) {
      const position = colorNamePosition(name);
      expect(position).not.toBeNull();
      expect(position!).toBeGreaterThan(0);
      expect(position!).toBeLessThan(1);
    }
  });

  it("returns null when the name says nothing about color", () => {
    expect(colorNamePosition("S592 Barrington")).toBeNull();
    expect(colorNamePosition("")).toBeNull();
  });
});

describe("brand colors land somewhere sensible on the wheel", () => {
  it("uses a known hex when the brand color has one", () => {
    const navy = brandColor("Navy", "#435b77");
    const position = wizardColorPosition(navy);
    // Not an end cap, and in the blue part of the wheel rather than at the start.
    expect(position).toBeGreaterThan(0.05);
    expect(position).toBeLessThan(0.95);
    expect(position).toBeGreaterThan(colorNamePosition("White")!);
  });

  it("does not snap the marker to the far right for a named color", () => {
    for (const [name, hex] of [["Navy", "#435b77"], ["Aero Sage", "#4f5549"], ["Casselberry", "#EEEADF"], ["Rust", "#b5603a"]] as const) {
      const position = wizardColorPosition(brandColor(name, hex));
      expect(position, `${name} must not sit on an end cap`).toBeGreaterThan(0.001);
      expect(position, `${name} must not sit on an end cap`).toBeLessThan(0.999);
    }
  });

  it("falls back to the name when there is no usable hex", () => {
    const noHex = { ...brandColor("Navy", "#435b77"), hex: "not-a-hex" } as WizardColor;
    expect(wizardColorPosition(noHex)).toBe(clampMarker(colorNamePosition("Navy")!));
    const named = { ...brandColor("Sage", "#4f5549"), hex: "" } as WizardColor;
    expect(wizardColorPosition(named)).toBe(clampMarker(colorNamePosition("Sage")!));
  });

  it("keeps a published chip exactly where it belongs", () => {
    // Nothing about the fix may move a real SW chip off its own stop.
    const chip = paintColorByCode("SW7005")!;
    const position = wizardColorPosition({
      finish: PAINT_FINISH,
      hex: chip.hex,
      code: chip.code,
      name: chip.name,
      label: `SW ${chip.code.slice(2)} ${chip.name}`,
      keepsGrain: false,
      source: "published chart",
    } as WizardColor);
    expect(position).toBeGreaterThanOrEqual(0);
    expect(position).toBeLessThanOrEqual(1);
    // White sits at the light end of the wheel.
    expect(position).toBeLessThan(0.25);
  });

  it("never changes the color it was asked about", () => {
    const color = brandColor("Navy", "#435b77");
    const before = JSON.stringify(color);
    wizardColorPosition(color);
    expect(JSON.stringify(color)).toBe(before);
    expect(color.hex).toBe("#435b77");
  });

  it("clamps markers away from the end caps", () => {
    expect(clampMarker(-1)).toBe(0.03);
    expect(clampMarker(2)).toBe(0.97);
    expect(clampMarker(0.5)).toBe(0.5);
    expect(clampMarker(Number.NaN)).toBe(0.5);
  });

  it("positions a hex only when a nearest-chip lookup is available", () => {
    expect(positionForHex("#435b77", () => 0.42)).toBe(0.42);
    expect(positionForHex("nope", () => 0.42)).toBeNull();
    expect(positionForHex("#435b77", () => null)).toBeNull();
  });
});
