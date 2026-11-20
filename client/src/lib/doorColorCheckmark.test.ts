/**
 * The checkmark decides the door color (Tom, Nov 20 2026, voice):
 * "Whichever image the user checkmarked as their pick wins ... the blue-gray swatch
 * never overrides a checkmarked or existing image."
 */
import { afterEach, describe, expect, it } from "vitest";
import { resolveDoorColor, SWATCH_HEX_TABLE } from "@shared/doorColorResolve";
import {
  designerGateRenderHex,
  resolveKitchenDoorColor,
  withAcceptedAppearance,
  type AcceptedAppearanceRow,
} from "@/lib/acceptedDoorAppearance";
import { designerFacePlan } from "@/lib/designerFacePlan";
import { designerThreeDAssignments } from "@/lib/designerThreeDStyles";
import { doorStyleFinishColors } from "@/lib/doorStyleAppearance";
import { __setDoorImageSamplerForTests, cachedDoorImageHex, primeDoorImageHexes } from "@/lib/doorImageHexCache";

const SAMPLE_URL = "/manus-storage/media-library/1785508648171_oxford_mist_door_089b8d4d";
const DRAWER_URL = "/manus-storage/media-library/1785508655897_oxford_mist_full_drawer_bd729c64";
const GEMINI_URL = "/manus-storage/door-ai/330029-gemini.png";

/** Slate Gray (Madison) exactly as cabinet-backend doorStyles.list answered it on Nov 20 2026 (~9:55 AM CT). */
const SLATE_GRAY_LIVE = {
  id: 330029,
  distributorId: 210002,
  styleCode: "OM",
  ourName: "Oxford Mist",
  aliasName: "Slate Gray (Madison)",
  doorStyle: "Shaker",
  woodSpecies: "Birch",
  finish: "Slate Gray (Madison)",
  color: "#B8C8D0",
  renderHex: "#d6dada",
  doorSampleImageUrl: SAMPLE_URL,
  drawerSampleImageUrl: DRAWER_URL,
  thumbnailImageUrl: SAMPLE_URL,
  doorColorSource: "approved-ai-image",
  doorColorSourceUpdatedAt: "2026-11-20T15:08:15.000Z",
  approvedVersionId: null,
};

/** doorStyles.acceptedAppearance for 330029, live on Nov 20 2026: note `renderHex`, not `colorHex`. */
const SLATE_GRAY_ACCEPTED_ROW: AcceptedAppearanceRow = {
  styleId: 330029,
  renderHex: "#aaa8a4",
  approvedReferenceImageUrl: SAMPLE_URL,
  approvedVersionId: 750002,
} as AcceptedAppearanceRow;

const BLUE_GRAY = "#b8c8d0";

afterEach(() => __setDoorImageSamplerForTests(null));

describe("the unapproved pale blue-gray door (root cause, live Slate Gray row)", () => {
  it("the saved catalog color #b8c8d0 (the superseded paint chip) is no longer trusted as a decision", () => {
    // On main this exact input returned #b8c8d0 via "catalog-color" (savedCatalogColor):
    // the checkmark fell back (no AI picture in the list response), the accepted row was
    // dropped (field names), and the saved paint-chip color painted the doors.
    const old = resolveDoorColor({ ...SLATE_GRAY_LIVE, renderHex: null, color: "#B8C8D0", checkedDoorSource: null });
    expect(old.appliedHex).not.toBe(BLUE_GRAY);
    expect(old.layers.catalogColor).toBeNull();
  });

  it("the accepted row in the backend's own spelling is read, so the checkmark reaches the kitchen", () => {
    const merged = withAcceptedAppearance(SLATE_GRAY_LIVE, SLATE_GRAY_ACCEPTED_ROW)!;
    expect(merged.approvedVersionId).toBe(750002);
    expect(merged.approvedReferenceImageUrl).toBe(SAMPLE_URL);
    expect(merged.checkedDoorSource).toBe("ai-image");
    // The checkmarked AI tile shows the accepted render (no Gemini picture), so that
    // render's derived color is the door color.
    const decision = resolveKitchenDoorColor(merged);
    expect(decision.appliedSource).toBe("accepted-render");
    expect(decision.appliedHex).toBe("#aaa8a4");
    expect(decision.appliedHex).not.toBe(BLUE_GRAY);
  });

  it("end to end: the doors show the official door photo, not a #b8c8d0 painted substitute", () => {
    // On main (e32f604) this exact input gave: face = the "grey-shaker" substitute
    // painted solid #b8c8d0, cabinet body #d6dada (an unaccepted render hex).
    const merged = withAcceptedAppearance(SLATE_GRAY_LIVE, SLATE_GRAY_ACCEPTED_ROW)!;
    const plan = designerFacePlan(merged as never, "base")!;
    expect(plan.doorUrl).toBe(SAMPLE_URL);
    expect(plan.dlcCrop?.solidColor).toBeUndefined();
    expect(plan.acceptedColorHex).toBe("#aaa8a4");
  });

  it("the finish (plan, elevation, 3D cabinet body) is the checked image's color, not the swatch", () => {
    const merged = withAcceptedAppearance(SLATE_GRAY_LIVE, SLATE_GRAY_ACCEPTED_ROW)!;
    expect(doorStyleFinishColors(merged as never).face.toLowerCase()).toBe("#aaa8a4");
  });

  it("the swatch row is corrected from the official door image and keeps the old value for audit", () => {
    const row = SWATCH_HEX_TABLE.find((entry) => entry.id === 330029)!;
    expect(row.hex).toBe("#a4a19e");
    expect((row as { previousHex?: string }).previousHex).toBe(BLUE_GRAY);
  });

  it("with no image color at all the door is still never pale blue", () => {
    const decision = resolveDoorColor({ ...SLATE_GRAY_LIVE, renderHex: null, doorColorSource: null });
    expect(decision.appliedHex).not.toBe(BLUE_GRAY);
    expect(decision.review.hueChosen).toBe("neutral");
  });
});

describe("tiers: checkmark, then uploaded sample, then AI image, then swatch", () => {
  const base = { ...SLATE_GRAY_LIVE, renderHex: null, doorColorSource: null };

  it("a checkmarked AI image wins over an uploaded sample", () => {
    const d = resolveDoorColor({ ...base, checkedDoorSource: "ai-image", uploadedSampleHex: "#a4a19e", aiImageHex: "#7d7b78" });
    expect([d.appliedSource, d.appliedHex]).toEqual(["checked-image", "#7d7b78"]);
  });

  it("a checkmarked uploaded sample wins over an AI image", () => {
    const d = resolveDoorColor({ ...base, checkedDoorSource: "uploaded-sample", uploadedSampleHex: "#a4a19e", aiImageHex: "#7d7b78" });
    expect([d.appliedSource, d.appliedHex]).toEqual(["checked-image", "#a4a19e"]);
  });

  it("no checkmark: the uploaded sample, then the AI image", () => {
    expect(resolveDoorColor({ ...base, uploadedSampleHex: "#a4a19e", aiImageHex: "#7d7b78" }).appliedHex).toBe("#a4a19e");
    const aiOnly = resolveDoorColor({ ...base, aiImageHex: "#7d7b78" });
    expect([aiOnly.appliedSource, aiOnly.appliedHex]).toEqual(["ai-image", "#7d7b78"]);
  });

  it("swatch only: the corrected swatch (or the estimator), never the superseded blue-gray", () => {
    const d = resolveDoorColor(base);
    expect(["swatch-table", "pre-209", "estimator"]).toContain(d.appliedSource);
    expect(d.appliedHex).not.toBe(BLUE_GRAY);
  });

  it("an image never loses to the swatch, a saved color, a render hex or the estimator", () => {
    // A deliberately blue sample on a style whose name says gray: the estimator objects,
    // and is ignored, because the image is the door.
    const d = resolveDoorColor({ ...base, color: "#B8C8D0", renderHex: "#d6dada", approvedVersionId: 1, uploadedSampleHex: "#3a6ea5" });
    expect(d.appliedHex).toBe("#3a6ea5");
    expect(d.review.keptBecause).toBe("door-image");
  });

  it("a confirmed Hex checkmark switches the image layers off", () => {
    const d = resolveDoorColor({ ...base, checkedDoorSource: "hex", renderHex: "#123456", uploadedSampleHex: "#a4a19e", aiImageHex: "#7d7b78" });
    expect(d.appliedHex).toBe("#123456");
  });

  it("the color gate never adjusts a door image's color", () => {
    const d = resolveDoorColor({ ...base, checkedDoorSource: "uploaded-sample", uploadedSampleHex: "#a4a19e" });
    expect(designerGateRenderHex(d, base as never)).toBeNull();
  });
});

describe("the checkmarked image reaches the face and the finish unchanged in every Designer path", () => {
  it("checkmarked AI picture: the picture is the face and its color rides with it", async () => {
    __setDoorImageSamplerForTests(async (url) => (url === GEMINI_URL ? "#7d7b78" : url === SAMPLE_URL ? "#a4a19e" : null));
    await primeDoorImageHexes([GEMINI_URL, SAMPLE_URL]);
    const style = { ...SLATE_GRAY_LIVE, aiProfileImageUrl: GEMINI_URL };
    const merged = withAcceptedAppearance(style, SLATE_GRAY_ACCEPTED_ROW)!;
    const plan = designerFacePlan(merged as never, "base")!;
    expect(plan.doorUrl).toBe(GEMINI_URL);
    expect(plan.acceptedColorHex).toBe("#7d7b78");
    expect(resolveKitchenDoorColor(merged).appliedHex).toBe("#7d7b78");
    expect(doorStyleFinishColors(merged as never).face.toLowerCase()).toBe("#7d7b78");
    const [assignment] = designerThreeDAssignments({
      placed: [{ uid: "a", styleId: 330029, placement: "wall" }],
      defaultStyleId: 330029,
      doorStyles: [style as never],
      acceptedRows: [SLATE_GRAY_ACCEPTED_ROW],
    });
    expect(assignment!.facePlan!.doorUrl).toBe(GEMINI_URL);
  });

  it("checkmarked uploaded sample: the sample photo is the face, its sampled color the finish", async () => {
    __setDoorImageSamplerForTests(async (url) => (url === GEMINI_URL ? "#7d7b78" : url === SAMPLE_URL ? "#a4a19e" : null));
    await primeDoorImageHexes([GEMINI_URL, SAMPLE_URL]);
    expect(cachedDoorImageHex(SAMPLE_URL)).toBe("#a4a19e");
    const style = { ...SLATE_GRAY_LIVE, aiProfileImageUrl: GEMINI_URL, doorColorSource: "original-image" };
    const merged = withAcceptedAppearance(style, null)!;
    const plan = designerFacePlan(merged as never, "base")!;
    expect(plan.doorUrl).toBe(SAMPLE_URL);
    expect(resolveKitchenDoorColor(merged).appliedHex).toBe("#a4a19e");
    expect(doorStyleFinishColors(merged as never).face.toLowerCase()).toBe("#a4a19e");
    const [assignment] = designerThreeDAssignments({
      placed: [{ uid: "b", styleId: 330029, placement: "base" }],
      defaultStyleId: 330029,
      doorStyles: [style as never],
      acceptedRows: [],
    });
    expect(assignment!.facePlan!.doorUrl).toBe(SAMPLE_URL);
  });

  it("an image that cannot be read stays unknown: nothing is invented", async () => {
    __setDoorImageSamplerForTests(async () => null);
    await primeDoorImageHexes([SAMPLE_URL]);
    expect(cachedDoorImageHex(SAMPLE_URL)).toBeNull();
    const merged = withAcceptedAppearance({ ...SLATE_GRAY_LIVE, renderHex: null, doorColorSource: null }, null)!;
    expect(merged.uploadedSampleHex ?? null).toBeNull();
    expect(resolveKitchenDoorColor(merged).appliedHex).not.toBe(BLUE_GRAY);
  });
});

describe("other blue-tinted gray swatch rows, corrected from their official door images", () => {
  it.each([
    [330009, "#8f877c", "#8a9ba8"],
    [330012, "#6f6f6f", "#9aa8b0"],
  ])("row %i", (id, hex, previous) => {
    const row = SWATCH_HEX_TABLE.find((entry) => entry.id === id) as { hex: string; previousHex?: string };
    expect(row.hex).toBe(hex);
    expect(row.previousHex).toBe(previous);
  });
});
