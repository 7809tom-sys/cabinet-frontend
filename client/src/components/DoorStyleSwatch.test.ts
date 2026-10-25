import { describe, it, expect } from "vitest";
import { resolveSwatch } from "./DoorStyleSwatch";

describe("resolveSwatch color resolution", () => {
  it("maps a white SW color to a near-white face with dark label", () => {
    const sw = resolveSwatch({ color: "SW 7004 Snowbound", doorStyle: "Shaker" });
    expect(sw.face.toLowerCase()).toBe("#f4f2ec");
    expect(sw.label).toBe("#3a3a3a"); // dark text on light door
  });

  it("maps tricorn black to a near-black face with light label", () => {
    const sw = resolveSwatch({ color: "SW 6258 Tricorn Black", doorStyle: "Slab" });
    expect(sw.face.toLowerCase()).toBe("#2a2a2c");
    expect(sw.label).toBe("#f5f5f5"); // light text on dark door
  });

  it("maps a navy color to a blue face", () => {
    const sw = resolveSwatch({ color: "SW 6244 Naval", doorStyle: "Shaker" });
    expect(sw.face.toLowerCase()).toBe("#36465c");
  });

  it("uses an exact stored finish hex before name-based fallback matching", () => {
    const sw = resolveSwatch({ ourName: "Oxford Mist", color: "#B8C8D0", finish: "Oxford Mist (OM)" });
    expect(sw.face.toLowerCase()).toBe("#b8c8d0");
  });

  it("keeps named Cashmere, Harbor, and black finishes out of the generic wood fallback", () => {
    expect(resolveSwatch({ ourName: "Oxford Cashmere", color: "Cashmere" }).face.toLowerCase()).toBe("#e3dacd");
    expect(resolveSwatch({ ourName: "Haven Harbor", color: "Harbor" }).face.toLowerCase()).toBe("#9aa0a6");
    expect(resolveSwatch({ ourName: "Iron Black", color: "Black" }).face.toLowerCase()).toBe("#2a2a2c");
  });

  it("falls back to warm wood when no color keyword matches", () => {
    const sw = resolveSwatch({ color: "Unknown Mystery Tone", doorStyle: "Shaker" });
    expect(sw.face.toLowerCase()).toBe("#c79a63");
  });

  it("derives color from ourName/finish when color is null", () => {
    const sw = resolveSwatch({ color: null, ourName: "Aura Cream Shaker", finish: null });
    expect(sw.face.toLowerCase()).toBe("#e6dcc6"); // "cream" -> cream/linen/sand bucket
  });

  it("edge is always darker than the face", () => {
    const sw = resolveSwatch({ color: "SW White Oak", doorStyle: "Slab" });
    const lum = (h: string) => {
      const n = parseInt(h.replace("#", ""), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(lum(sw.edge)).toBeLessThan(lum(sw.face));
  });

  it("handles empty/missing fields without throwing", () => {
    expect(() => resolveSwatch({})).not.toThrow();
    const sw = resolveSwatch({});
    expect(sw.face).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
