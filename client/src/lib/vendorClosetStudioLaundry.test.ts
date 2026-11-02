import { describe, expect, it } from "vitest";
import { autoBuildStudio, MODE_AUTO_BUILD_DEFAULTS, restoreStudioDesign, STUDIO_LAUNDRY_APPLIANCE_IN, STUDIO_MODES, studioBays, studioCornerShelves, studioLaundryWall, studioTakeoff, type StudioLaundryWall } from "./vendorClosetStudio";

const build = (applianceWall: StudioLaundryWall, wallWidthIn = 120, roomDepthIn = 96) =>
  autoBuildStudio({ mode: "laundry", mount: "floor", finish: "Glacier White", wallWidthIn, roomDepthIn, roomHeightIn: 96, laundry: { applianceWall } });

describe("Laundry room mode", () => {
  it("is offered alongside the other modes with hanging + shelf defaults", () => {
    expect(STUDIO_MODES).toContain("laundry");
    expect(MODE_AUTO_BUILD_DEFAULTS.laundry.rods).toBeGreaterThan(0);
    expect(MODE_AUTO_BUILD_DEFAULTS.laundry.shelves).toBeGreaterThan(0);
    expect(STUDIO_LAUNDRY_APPLIANCE_IN).toEqual({ widthIn: 56, heightIn: 40, depthIn: 30 });
  });

  for (const wall of ["back", "left", "right"] as const) {
    it(`reserves the ${wall} wall for the washer & dryer and builds towers only on other walls`, () => {
      const { design, notices } = build(wall);
      expect(design.mode).toBe("laundry");
      expect(studioLaundryWall(design)).toBe(wall);
      expect(studioBays(design, wall)).toEqual([]);
      const others = (["back", "left", "right"] as const).filter((w) => w !== wall);
      const items = others.flatMap((w) => studioBays(design, w).flatMap((bay) => bay.items));
      expect(items.some((item) => item.kind === "rod")).toBe(true);
      expect(items.some((item) => item.kind === "shelf")).toBe(true);
      expect(studioCornerShelves(design).every((shelf) => !shelf.wallIds.includes(wall))).toBe(true);
      expect(notices.join(" ")).toMatch(/reserved for the washer & dryer/);
      expect(notices.join(" ")).toMatch(/No shelf is planned above the washer & dryer/);
    });
  }

  it("adds no SKU or price for the appliance block and survives restore", () => {
    const { design } = build("left");
    expect(studioTakeoff(design).lines.some((line) => /washer|dryer/i.test(line.label))).toBe(false);
    const restored = restoreStudioDesign(JSON.stringify(design));
    expect(restored?.laundry).toEqual({ applianceWall: "left" });
    expect(restoreStudioDesign(JSON.stringify({ ...design, laundry: { applianceWall: "ceiling" } }))).toBeNull();
  });

  it("reports when a reach-in laundry room has no wall left for towers", () => {
    const { design, notices } = build("back", 96, 40);
    expect(studioBays(design, "back")).toEqual([]);
    expect(notices.join(" ")).toMatch(/No other wall can take towers/);
  });
});
