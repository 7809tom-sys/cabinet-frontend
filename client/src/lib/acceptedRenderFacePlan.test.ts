/**
 * The accepted render is the source of truth for a door's APPEARANCE, not just its
 * color: the signed-off texture goes on the door, and the color derived from that
 * render goes on every surface.
 *
 * Tom's report was that Shaker Honey showed a flat gold `#c8a040` with no grain
 * while the accepted audit render — a light natural tan birch with grain, scored
 * 10.0 — looked right. So the texture matters as much as the hex.
 */
import { describe, expect, it } from "vitest";
import { acceptedRenderFacePlan, designerFacePlan } from "./designerFacePlan";

const ACCEPTED_TEXTURE = "/manus-storage/door-rendering-audit/sh-accepted-2517.png";

const SH = {
  id: 330021,
  styleCode: "SH",
  ourName: "Shaker Honey",
  aliasName: "Honey Core (Madison)",
  doorStyle: "Shaker",
  woodSpecies: "Solid Birch frame / veneered center panel",
  color: "#c8a040",
  doorSampleImageUrl: "/manus-storage/sh-sample.jpg",
};

const ACCEPTED_SH = {
  ...SH,
  renderHex: "#d6bb92",
  approvedVersionId: 2517,
  approvedReferenceImageUrl: ACCEPTED_TEXTURE,
};

describe("the accepted render is the door's texture", () => {
  it("draws the accepted render on the door and names its color", () => {
    const plan = acceptedRenderFacePlan(ACCEPTED_SH, "base");
    expect(plan).not.toBeNull();
    expect(plan!.doorUrl).toBe(ACCEPTED_TEXTURE);
    expect(plan!.acceptedColorHex).toBe("#d6bb92");
    expect(plan!.acceptedColorHex).not.toBe("#c8a040");
  });

  it("gives a base cabinet an accepted drawer texture, and a wall cabinet none", () => {
    const base = acceptedRenderFacePlan(ACCEPTED_SH, "base")!;
    expect(base.drawerUrl).toBe(ACCEPTED_TEXTURE);
    expect(base.drawerTextureApplied).toBe(true);
    const wall = acceptedRenderFacePlan(ACCEPTED_SH, "wall")!;
    expect(wall.drawerUrl).toBeNull();
    expect(wall.sections).toBe(1);
  });

  it("outranks the DL shaker blueprint, which used to paint a flat hex", () => {
    const plan = designerFacePlan(ACCEPTED_SH, "base");
    expect(plan?.doorUrl).toBe(ACCEPTED_TEXTURE);
    expect(plan?.acceptedColorHex).toBe("#d6bb92");
    // No DL crop and no flat solid: the approved render is the appearance.
    expect(plan?.dlcCrop).toBeUndefined();
  });

  it("does not claim an acceptance when no run was approved", () => {
    // A photo sitting on the style is not an accepted render.
    expect(acceptedRenderFacePlan({ ...SH, approvedReferenceImageUrl: ACCEPTED_TEXTURE }, "base")).toBeNull();
    expect(acceptedRenderFacePlan({ ...SH, approvedVersionId: 2517 }, "base")).toBeNull();
    expect(acceptedRenderFacePlan(null, "base")).toBeNull();
  });

  it("leaves a style with no accepted run on the ordinary path", () => {
    const plan = designerFacePlan(SH, "base");
    expect(plan?.acceptedColorHex ?? null).toBeNull();
    expect(plan?.doorUrl).not.toBe(ACCEPTED_TEXTURE);
  });
});
