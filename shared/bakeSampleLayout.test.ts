import { describe, it, expect } from "vitest";
import { bakeSampleLayout, bakeLayoutHasDoorAndDrawer, drawerFrontConstruction } from "./bakeSampleLayout";
describe("bake sample layout", () => {
  it("includes a door front and a drawer front", () => {
    expect(bakeLayoutHasDoorAndDrawer(bakeSampleLayout())).toBe(true);
    expect(bakeLayoutHasDoorAndDrawer(bakeSampleLayout({ drawerHeightIn: 10 }))).toBe(true);
  });
  it("small drawers are a slab in the door color, taller keep the 2.75in frame", () => {
    expect(drawerFrontConstruction(6)).toEqual({ construction: "slab", frameWidthIn: null });
    expect(drawerFrontConstruction(7)).toEqual({ construction: "frame", frameWidthIn: 2.75 });
    const l = bakeSampleLayout({ drawerHeightIn: 6 });
    expect(l[0]).toMatchObject({ kind: "drawer", construction: "slab", colorSource: "door" });
  });
});
