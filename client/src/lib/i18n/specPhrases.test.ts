import { describe, it, expect } from "vitest";
import { translateSpec } from "./specPhrases";

describe("translateSpec", () => {
  it("returns the original string for English (no-op)", () => {
    const s = "36x42 Double Door Wall Cabinet with 4 Adjustable Shelves";
    expect(translateSpec(s, "en")).toBe(s);
  });

  it("handles null/undefined/empty safely", () => {
    expect(translateSpec(null, "es")).toBe("");
    expect(translateSpec(undefined, "es")).toBe("");
    expect(translateSpec("", "es")).toBe("");
  });

  it("translates a common wall-cabinet spec", () => {
    const out = translateSpec(
      "36x42 Double Door Wall Cabinet with 4 Adjustable Shelves",
      "es",
    );
    expect(out).toBe("36x42 Gabinete de Pared de Dos Puertas con 4 Repisas Ajustables");
  });

  it("translates a three-drawer base cabinet", () => {
    expect(translateSpec('36" Three Drawer Base Cabinet', "es")).toBe(
      '36" Gabinete de Base de Tres Cajones',
    );
  });

  it("preserves dimensions and inch marks", () => {
    const out = translateSpec('24" x 96" Tall Decorative End Panel', "es");
    expect(out).toContain('24" x 96"');
    expect(out).toContain("Panel Lateral Decorativo Alto");
  });

  it("keeps the ADA acronym verbatim", () => {
    const out = translateSpec(
      '12" Three Drawer ADA Base Cabinet',
      "es",
    );
    expect(out).toContain("ADA");
    expect(out).toBe('12" de Tres Cajones ADA Gabinete de Base');
  });

  it("translates lazy susan / easy reach phrasing", () => {
    const out = translateSpec('33" Base Easy Reach with Lazy Susan Cabinet', "es");
    expect(out).toContain("Bandeja Giratoria");
    expect(out).not.toContain("Lazy Susan");
  });

  it("translates glass-door corner cabinets", () => {
    const out = translateSpec(
      "27\" Diagonal Corner Wall Cabinet with Glass Door",
      "es",
    );
    expect(out).toContain("Esquina Diagonal");
    expect(out).toContain("Puerta de Vidrio");
    expect(out).not.toContain("Glass Door");
  });

  it("translates microwave/oven combo", () => {
    const out = translateSpec('30" Microwave/Oven Combo Cabinet with Shelf', "es");
    expect(out).toContain("Combo Microondas/Horno");
    expect(out).toContain("Repisa");
  });

  it("translates waste basket / trash pull-out", () => {
    const out = translateSpec('18" Base Waste Basket Cabinet (Trash Can Pull-Out)', "es");
    expect(out).toContain("Bote de Basura");
    expect(out).not.toMatch(/\bTrash\b/);
  });

  it("does not translate inside SKU codes in parentheses", () => {
    const out = translateSpec(
      "Wall Open End Shelf (OE-6-42): mounts at the exposed end",
      "es",
    );
    expect(out).toContain("(OE-6-42)");
  });

  it("leaves unknown vocabulary in English", () => {
    const out = translateSpec("Quartz Backsplash Spline Cabinet", "es");
    // "Spline" and "Backsplash" + "Quartz" are unknown -> preserved
    expect(out).toContain("Quartz");
    expect(out).toContain("Backsplash");
    expect(out).toContain("Spline");
  });

  it("translates single door / left-right hand designations", () => {
    const out = translateSpec('33" Single Tall Door Vanity Cabinet Left', "es");
    expect(out).toContain("Izquierda");
  });
});
