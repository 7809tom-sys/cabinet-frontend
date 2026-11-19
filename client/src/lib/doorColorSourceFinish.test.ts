import { describe, expect, it } from "vitest";
import { runBestEffortColorGate, runColorGate, ColorGateBlock } from "@shared/colorGate";
import { hasAcceptedAiRender, hasApprovedAiImage, styleWithChosenColorHex } from "@shared/doorColorSourceSelection";
import { doorStyleFinishColors } from "./doorStyleAppearance";
import { resolveKitchenDoorColor } from "./acceptedDoorAppearance";
import { designerFacePlan } from "./designerFacePlan";

const SW = { finish: "paint", code: "SW 6244", label: "Naval", hex: "#2f3d4c", woodSpecies: null, grainDirection: "none", profileImageUrl: null };
const classicCream = {
  id: 330002, ourName: "Classic Cream", doorStyle: "Shaker", color: "f9f7eb", finish: "Painted", renderHex: "#eae5d6",
  doorSampleImageUrl: "/manus-storage/door.jpg", approvedVersionId: null, approvedReferenceImageUrl: null,
};
const withHex = { ...classicCream, doorColorSource: "hex", doorColorSourceValue: { hex: "#3a6ea5" }, doorColorSourceUpdatedAt: "2026-11-18T20:00:00.000Z" };
const withSherwin = { ...classicCream, doorColorSource: "sherwin-williams", doorColorSourceValue: SW, doorColorSourceUpdatedAt: "2026-11-18T20:00:00.000Z" };
const withOriginal = { ...classicCream, doorColorSource: "original-image", doorColorSourceUpdatedAt: "2026-11-18T20:00:00.000Z" };

describe("the cabinet finish follows the Sherwin-Williams or hex choice", () => {
  it("styleWithChosenColorHex makes a confirmed pick the render hex and clears an accepted-run flag", () => {
    expect(styleWithChosenColorHex(withHex)).toMatchObject({ renderHex: "#3a6ea5", approvedVersionId: null });
    expect(styleWithChosenColorHex(withSherwin)).toMatchObject({ renderHex: "#2f3d4c", approvedVersionId: null });
    expect(styleWithChosenColorHex({ ...withHex, approvedVersionId: 9 })).toMatchObject({ renderHex: "#3a6ea5", approvedVersionId: null });
  });

  it("any other choice, or none, leaves the style exactly as it was", () => {
    expect(styleWithChosenColorHex(withOriginal)).toBe(withOriginal);
    expect(styleWithChosenColorHex(classicCream)).toBe(classicCream);
    const ai = { ...classicCream, doorColorSource: "approved-ai-image", approvedVersionId: 4, approvedReferenceImageUrl: "/x.png" };
    expect(styleWithChosenColorHex(ai)).toBe(ai);
  });

  it("doorStyleFinishColors paints the finish in the picked hex, matching the door face", () => {
    const plain = doorStyleFinishColors(classicCream as never).face.toLowerCase();
    expect(plain).not.toBe("#3a6ea5");
    expect(doorStyleFinishColors(withHex as never).face.toLowerCase()).toBe("#3a6ea5");
    expect(doorStyleFinishColors(withSherwin as never).face.toLowerCase()).toBe("#2f3d4c");
    // Original and no choice keep today's finish.
    expect(doorStyleFinishColors(withOriginal as never).face.toLowerCase()).toBe(plain);
  });

  it("resolveKitchenDoorColor follows the pick and says it came from a hand-set render hex", () => {
    const decision = resolveKitchenDoorColor(withHex as never);
    expect(decision.appliedHex).toBe("#3a6ea5");
    expect(decision.candidateSource).toBe("render-hex");
    expect(resolveKitchenDoorColor(withSherwin as never).appliedHex).toBe("#2f3d4c");
    expect(resolveKitchenDoorColor(classicCream as never).appliedHex).toBe("#eae5d6");
  });

  it("the Designer's face plan paints the same hex the finish uses", () => {
    const plan = designerFacePlan(withHex as never, "base");
    expect(plan?.dlcCrop?.solidColor?.toLowerCase()).toBe("#3a6ea5");
    expect(doorStyleFinishColors(withHex as never).face.toLowerCase()).toBe("#3a6ea5");
  });
});

describe("a saved Gemini picture counts for 3D", () => {
  it("hasApprovedAiImage is true for an accepted render or a saved Gemini picture; hasAcceptedAiRender only for a render", () => {
    expect(hasApprovedAiImage({})).toBe(false);
    expect(hasApprovedAiImage({ aiProfileImageUrl: "  " })).toBe(false);
    expect(hasApprovedAiImage({ aiProfileImageUrl: "/gemini.png" })).toBe(true);
    expect(hasApprovedAiImage({ approvedVersionId: 3, approvedReferenceImageUrl: "/run.png" })).toBe(true);
    expect(hasAcceptedAiRender({ aiProfileImageUrl: "/gemini.png" })).toBe(false);
    expect(hasAcceptedAiRender({ approvedVersionId: 3, approvedReferenceImageUrl: "/run.png" })).toBe(true);
  });

  it("an Approved AI choice with only a saved Gemini picture uses that picture in the Designer", () => {
    const style = { ...classicCream, doorColorSource: "approved-ai-image", doorColorSourceUpdatedAt: "2026-11-18T20:00:00.000Z", aiProfileImageUrl: "/uploads/gemini.png" };
    expect(designerFacePlan(style as never, "base")).toMatchObject({ doorUrl: "/uploads/gemini.png", drawerUrl: "/uploads/gemini.png" });
    expect(designerFacePlan(style as never, "wall")).toMatchObject({ doorUrl: "/uploads/gemini.png", drawerUrl: null });
  });

  it("without any AI picture the choice still falls back to the supplier photo", () => {
    const style = { ...classicCream, doorColorSource: "approved-ai-image", doorColorSourceUpdatedAt: "2026-11-18T20:00:00.000Z" };
    expect(designerFacePlan(style as never, "base")?.doorUrl).not.toBe("/uploads/gemini.png");
  });
});

describe("best-effort color gate", () => {
  // A lit patch always comes out lighter than asked: the strict gate refuses, best effort does not.
  const lighter = async () => "#a0c0dd";

  it("the strict gate refuses a color it cannot reach", async () => {
    const strict = await runColorGate({ baseHex: "#3a6ea5", renderHex: "#3a6ea5", threshold: 3, measure: lighter });
    expect(strict.status).toBe("color-mismatch");
    expect(new ColorGateBlock(strict).gateStatus).toBe("color-mismatch");
  });

  it("best effort returns the closest color it reached and never refuses", async () => {
    const result = await runBestEffortColorGate({ baseHex: "#3a6ea5", renderHex: "#3a6ea5", threshold: 3, measure: lighter });
    expect(result.closest).toBe(true);
    expect(result.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("nudges the paint toward the pick when the lights shift it", async () => {
    // The patch reads back 30% lighter than the paint: the nudged paint must be darker than the pick.
    const lit = async (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.min(255, Math.round(c * 1.3)));
      return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    };
    const result = await runBestEffortColorGate({ baseHex: "#406080", renderHex: "#406080", threshold: 3, measure: lit });
    const channel = (hex: string) => parseInt(hex.slice(1, 3), 16);
    expect(channel(result.hex)).toBeLessThan(channel("#406080"));
  });

  it("a measurement that throws falls back to the base color instead of throwing", async () => {
    const result = await runBestEffortColorGate({
      baseHex: "#3A6EA5",
      renderHex: "#3a6ea5",
      measure: async () => {
        throw new Error("The color patch could not be read.");
      },
    });
    expect(result).toMatchObject({ hex: "#3a6ea5", closest: true, status: "pass" });
  });

  it("with no render hex it passes at once", async () => {
    const result = await runBestEffortColorGate({ baseHex: "#efe6cf", renderHex: null, measure: lighter });
    expect(result).toMatchObject({ status: "pass", closest: false, hex: "#efe6cf" });
  });
});
