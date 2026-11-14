/**
 * Tom, Nov 14 2026: "most is a slab door with a solid color" - the altaeuro Studio
 * Series. A slab in a solid colour renders flat, the same way a painted face does,
 * without anybody writing "paint" in the finish text.
 */
import { describe, expect, it } from "vitest";
import { isSolidSlabFace } from "./solidSlabFace";

describe("solid slab face", () => {
  it("takes the flat path for a slab with a hex colour", () => {
    expect(isSolidSlabFace({ panelConstruction: "slab", color: "#E0E0E0", finish: "Zenit", woodSpecies: "HDF" })).toBe(true);
    expect(isSolidSlabFace({ doorStyle: "Slab", color: "#4E4946", finish: "Torino" })).toBe(true);
    expect(isSolidSlabFace({ doorShape: "slab", color: "#9B969C" })).toBe(true);
  });

  it("keeps a wood-look slab on its grain", () => {
    expect(isSolidSlabFace({ panelConstruction: "slab", color: "#BAA280", woodSpecies: "White Oak", finish: "Slim White Oak" })).toBe(false);
    expect(isSolidSlabFace({ panelConstruction: "slab", color: "#5A5046", finish: "Rustic Wood" })).toBe(false);
  });

  it("never turns a framed door, a glass door or a worded colour flat", () => {
    expect(isSolidSlabFace({ panelConstruction: "raised", color: "#F1F1F3" })).toBe(false);
    expect(isSolidSlabFace({ panelConstruction: "glass", color: "#E0DFDD" })).toBe(false);
    expect(isSolidSlabFace({ doorStyle: "Shaker", color: "#F5F5F5" })).toBe(false);
    // A style code stored as the colour is not a colour.
    expect(isSolidSlabFace({ panelConstruction: "slab", color: "ZSA" })).toBe(false);
    expect(isSolidSlabFace({ panelConstruction: "slab", color: null })).toBe(false);
  });
});
