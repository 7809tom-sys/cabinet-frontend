import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aiTilePicture, isAuditRunCapture } from "@shared/doorColorSourceSelection";
import { doorLightsForFinish } from "@shared/doorRenderLights";
import { buildFourSlots } from "./doorColorSourceSlots";
import { BLANK_PHOTO_MESSAGE, isBlankPhotoReading } from "./doorAuditDoorRender";
import { PHOTO_TILE_LIGHT_SCALE, photoTileLights } from "./doorColorSourceCabinetSnapshots";

const AUDIT = "/manus-storage/door-rendering-audit/style-540004/run-390002_db90f56e.png";

function pixels(count: number, color: readonly [number, number, number], noise = 0): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i += 1) {
    const wobble = noise ? (i % 2 === 0 ? noise : -noise) : 0;
    data[i * 4] = color[0] + wobble;
    data[i * 4 + 1] = color[1] + wobble;
    data[i * 4 + 2] = color[2] + wobble;
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe("Approved AI tile picture", () => {
  it("recognises a rendering-audit capture", () => {
    expect(isAuditRunCapture(AUDIT)).toBe(true);
    expect(isAuditRunCapture(`${AUDIT}?v=2`)).toBe(true);
    expect(isAuditRunCapture("/manus-storage/media-library/1785436538723_shaker_gray_door_6180caf3")).toBe(false);
    expect(isAuditRunCapture("/manus-storage/door-style-images/ai-generated/test.png")).toBe(false);
    expect(isAuditRunCapture(null)).toBe(false);
  });

  it("prefers the saved Gemini picture over an older approved image", () => {
    const pick = aiTilePicture({ approvedReferenceImageUrl: "/manus-storage/media-library/old.jpg", aiProfileImageUrl: " /gemini.png " });
    expect(pick).toEqual({ url: "/gemini.png", source: "gemini", auditCaptureOnly: false });
  });

  it("uses an approved render when there is no Gemini picture", () => {
    expect(aiTilePicture({ approvedReferenceImageUrl: "/manus-storage/media-library/old.jpg" })).toEqual({
      url: "/manus-storage/media-library/old.jpg",
      source: "approved-render",
      auditCaptureOnly: false,
    });
  });

  it("never treats an audit capture as a picture, and says so", () => {
    expect(aiTilePicture({ approvedReferenceImageUrl: AUDIT })).toEqual({ url: null, source: null, auditCaptureOnly: true });
    // A Gemini picture still wins when both exist.
    expect(aiTilePicture({ approvedReferenceImageUrl: AUDIT, aiProfileImageUrl: "/g.png" }).source).toBe("gemini");
    expect(aiTilePicture({})).toEqual({ url: null, source: null, auditCaptureOnly: false });
    expect(aiTilePicture(null).url).toBeNull();
  });

  it("leaves the AI slot empty with a reason when only an audit capture exists", () => {
    const slots = buildFourSlots({
      supplierPhotoUrl: "/supplier.jpg",
      aiImageUrl: null,
      aiAvailable: false,
      aiAuditCaptureOnly: true,
      stored: null,
      now: "2026-11-18T00:00:00.000Z",
    });
    const ai = slots.find((slot) => slot.source === "approved-ai-image")!;
    expect(ai.filled).toBe(false);
    expect(ai.checkable).toBe(false);
    expect(ai.reason).toMatch(/rendering-audit capture, not a Gemini picture/);
  });

  it("wires the admin dialog through aiTilePicture, not the old either-or", () => {
    const source = readFileSync(new URL("../components/admin/FeaturedStylesAdmin.tsx", import.meta.url), "utf8");
    expect(source).toContain("aiTilePicture(");
    expect(source).toContain("aiImageUrl={aiTile.url}");
    expect(source).not.toMatch(/style\.approvedReferenceImageUrl \|\| style\.aiProfileImageUrl/);
  });
});

describe("blank picture guard", () => {
  it("flags a flat, near-white picture", () => {
    expect(isBlankPhotoReading(pixels(1024, [237, 237, 237]))).toBe(true);
    expect(isBlankPhotoReading(pixels(1024, [255, 255, 255]))).toBe(true);
  });

  it("keeps a picture that has shading, color or darkness", () => {
    expect(isBlankPhotoReading(pixels(1024, [237, 237, 237], 6))).toBe(false);
    expect(isBlankPhotoReading(pixels(1024, [238, 230, 210]))).toBe(false);
    expect(isBlankPhotoReading(pixels(1024, [158, 166, 169]))).toBe(false);
    expect(isBlankPhotoReading(new Uint8ClampedArray(0))).toBe(false);
  });

  it("uses one plain sentence", () => {
    expect(BLANK_PHOTO_MESSAGE).toBe("This approved picture is a blank render; re-approve or make a Gemini picture.");
  });

  it("is a preview-only guard: the snapshot asks for it, the shared capture (Designer compare) does not", () => {
    const snapshots = readFileSync(new URL("./doorColorSourceCabinetSnapshots.ts", import.meta.url), "utf8");
    const audit = readFileSync(new URL("./doorAuditDoorRender.ts", import.meta.url), "utf8");
    expect(snapshots).toContain("loadSampleTexture(input.samplePhotoUrl, { rejectBlank: true })");
    expect(audit).toMatch(/loadSampleTexture\(input\.samplePhotoUrl\)/);
    expect(audit).not.toMatch(/rejectBlank: true/);
  });
});

describe("photo tile lights", () => {
  it("drops the environment and uses its own scale, leaving the studio rig for color tiles", () => {
    const studio = doorLightsForFinish("#d8c9b0", null);
    const photo = photoTileLights(studio);
    expect(photo.environment).toBe(0);
    expect(photo.environment).toBeLessThan(studio.environment);
    expect(photo.exposure).toBe(PHOTO_TILE_LIGHT_SCALE.exposure);
    expect(photo.hemisphere.intensity).toBeCloseTo(studio.hemisphere.intensity * PHOTO_TILE_LIGHT_SCALE.hemisphere);
    expect(photo.key.position).toEqual(studio.key.position);
    // The input rig is not changed.
    expect(studio.environment).toBe(1);
  });

  it("is applied only once a picture is loaded", () => {
    const snapshots = readFileSync(new URL("./doorColorSourceCabinetSnapshots.ts", import.meta.url), "utf8");
    expect(snapshots).toContain("if (texture) applyLights(photoTileLights(studioLights));");
  });
});
