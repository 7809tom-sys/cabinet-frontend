/**
 * Aspen Charcoal face photos in this file are synthetic.
 *
 * The repo has no Aspen Charcoal bitmap. Torino data in
 * shared/fixtures/torino/row-luminance.json is per-row averages for TWP, TGW,
 * and TDW, not a photograph, so it cannot show a crop, a shadow, or a pixel
 * size. Passing and failing RGBA buffers are built here. The Torino TWP rows
 * are read only to confirm detectHorizontalReveal still flags that combined
 * swatch, and that the synthetic door does not.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import {
  detectHorizontalReveal,
  rowLuminanceFromImageData,
} from "./doorFaceRecognition";
import {
  FACE_IMAGE_MIN_PX,
  FACE_TEXTURE_OFFSET,
  FACE_TEXTURE_REPEAT,
  FACE_VISIBLE_TEXELS,
  MARGIN_BLACK_MAX,
  MARGIN_PROBE_PX,
  MARGIN_WHITE_INTERIOR_MAX,
  MARGIN_WHITE_MIN,
  RULE_LINE_COVERAGE,
  RULE_LINE_DELTA,
  SHADOW_EDGE_DELTA,
  SHADOW_SIDE_CENTER_DELTA,
  SHADOW_SIDE_DELTA,
  validateDoorFaceImages,
  type DoorFaceQualityInput,
  type DoorFaceQualityResult,
  type FaceImagePixels,
} from "./doorFaceImageQuality";

const ASPEN_NAME = "Aspen Charcoal";
const DOOR_URL = "fixture://aspen-charcoal/door.png";
const DRAWER_URL = "fixture://aspen-charcoal/drawer.png";
/** #3a3a3a. Rec.709 luminance is 58. */
const CHARCOAL: readonly [number, number, number] = [58, 58, 58];
/** Drawer front is a different brown so the two files cannot match by accident. */
const DRAWER_BROWN: readonly [number, number, number] = [92, 78, 70];

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function fillFace(
  width: number,
  height: number,
  rgb: readonly [number, number, number],
  noise: number,
  seed: number,
): FaceImagePixels {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const random = makeRng(seed);
  for (let i = 0; i < width * height; i += 1) {
    const jitter = (random() * 2 - 1) * noise;
    const offset = i * 4;
    rgba[offset] = clampByte(rgb[0] + jitter);
    rgba[offset + 1] = clampByte(rgb[1] + jitter);
    rgba[offset + 2] = clampByte(rgb[2] + jitter);
    rgba[offset + 3] = 255;
  }
  return { width, height, rgba };
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function cloneFace(image: FaceImagePixels): FaceImagePixels {
  return {
    width: image.width,
    height: image.height,
    rgba: new Uint8ClampedArray(image.rgba),
  };
}

function paintRect(
  image: FaceImagePixels,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: readonly [number, number, number],
): void {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * image.width + x) * 4;
      image.rgba[i] = rgb[0];
      image.rgba[i + 1] = rgb[1];
      image.rgba[i + 2] = rgb[2];
      image.rgba[i + 3] = 255;
    }
  }
}

function aspenDoor(width = 640, height = 800): FaceImagePixels {
  return fillFace(width, height, CHARCOAL, 6, 0x41535045);
}

function aspenDrawer(width = 640, height = 640): FaceImagePixels {
  return fillFace(width, height, DRAWER_BROWN, 6, 0x44524157);
}

function aspenPair(
  door = aspenDoor(),
  drawer = aspenDrawer(),
): DoorFaceQualityInput {
  return {
    ourName: ASPEN_NAME,
    doorUrl: DOOR_URL,
    drawerUrl: DRAWER_URL,
    door,
    drawer,
  };
}

function issueKeys(result: DoorFaceQualityResult): string[] {
  return result.issues.map((issue) => `${issue.face}:${issue.code}`).sort();
}

/** Slim Cava gap from doorFaceRecognition.test.ts, tall enough for the 610px rule. */
function combinedSwatch(width = 640, height = 800): FaceImagePixels {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    let value = 168;
    if (y < 160) value = 150;
    else if (y < 166) value = 40;
    else if (y < 172) value = 250;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = value;
      rgba[i + 1] = value;
      rgba[i + 2] = value;
      rgba[i + 3] = 255;
    }
  }
  return { width, height, rgba };
}

describe("door face image quality thresholds", () => {
  it("sets the minimum size from the designer center crop", () => {
    assert.equal(FACE_TEXTURE_REPEAT, 0.42);
    assert.equal(FACE_TEXTURE_OFFSET, 0.29);
    assert.equal(FACE_VISIBLE_TEXELS, 256);
    assert.equal(FACE_IMAGE_MIN_PX, 610);
    assert.equal(
      FACE_IMAGE_MIN_PX,
      Math.ceil(FACE_VISIBLE_TEXELS / FACE_TEXTURE_REPEAT),
    );
    assert.ok(FACE_IMAGE_MIN_PX * FACE_TEXTURE_REPEAT >= FACE_VISIBLE_TEXELS);
    assert.equal(SHADOW_EDGE_DELTA, 28);
    assert.equal(SHADOW_SIDE_DELTA, 32);
    assert.equal(SHADOW_SIDE_CENTER_DELTA, 18);
    assert.equal(MARGIN_PROBE_PX, 3);
    assert.equal(MARGIN_WHITE_MIN, 245);
    assert.equal(MARGIN_WHITE_INTERIOR_MAX, 220);
    assert.equal(MARGIN_BLACK_MAX, 15);
    assert.equal(RULE_LINE_DELTA, 40);
    assert.equal(RULE_LINE_COVERAGE, 0.7);
  });
});

describe("synthetic Aspen Charcoal faces", () => {
  it("accepts a separate door and drawer front", () => {
    const input = aspenPair();
    const result = validateDoorFaceImages(input);
    assert.deepEqual(issueKeys(result), []);
    assert.equal(result.ok, true);
    assert.notEqual(input.doorUrl, input.drawerUrl);
    assert.equal(
      input.door.width === input.drawer.width &&
        input.door.height === input.drawer.height,
      false,
    );
    const reveal = detectHorizontalReveal(
      rowLuminanceFromImageData(
        input.door.rgba,
        input.door.width,
        input.door.height,
      ),
    );
    assert.deepEqual(reveal, { detected: false, reason: "no-dip" });
  });

  it("accepts a 610px face and rejects 609px", () => {
    const passing = validateDoorFaceImages(
      aspenPair(aspenDoor(610, 610), aspenDrawer(610, 610)),
    );
    assert.equal(passing.ok, true);
    const shortWidth = validateDoorFaceImages(
      aspenPair(aspenDoor(609, 800), aspenDrawer()),
    );
    assert.deepEqual(issueKeys(shortWidth), ["door:resolution"]);
    const shortHeight = validateDoorFaceImages(
      aspenPair(aspenDoor(800, 609), aspenDrawer()),
    );
    assert.deepEqual(issueKeys(shortHeight), ["door:resolution"]);
  });

  it("keeps a mild edge darkening under the shadow limit", () => {
    const door = aspenDoor();
    const edge = Math.round(door.width * 0.08);
    paintRect(door, 0, 0, edge, door.height, [46, 46, 46]);
    const result = validateDoorFaceImages(aspenPair(door));
    assert.equal(result.ok, true);
  });

  it("accepts a uniform white door and a uniform black door", () => {
    const white = fillFace(640, 640, [255, 255, 255], 0, 1);
    const black = fillFace(640, 640, [0, 0, 0], 0, 1);
    assert.equal(
      validateDoorFaceImages(aspenPair(white, aspenDrawer())).ok,
      true,
    );
    assert.equal(
      validateDoorFaceImages(aspenPair(black, aspenDrawer())).ok,
      true,
    );
  });

  it("rejects one URL shared by the door and the drawer front", () => {
    const input = aspenPair();
    input.drawerUrl = input.doorUrl;
    const result = validateDoorFaceImages(input);
    assert.deepEqual(issueKeys(result), ["pair:same-url"]);
    assert.match(result.issues[0]!.detail, /Aspen Charcoal/);
  });

  it("rejects identical pixels stored under two URLs", () => {
    const door = aspenDoor();
    const result = validateDoorFaceImages(aspenPair(door, cloneFace(door)));
    assert.deepEqual(issueKeys(result), ["pair:same-content"]);
  });

  it("rejects a door image that still contains a drawer reveal", () => {
    const result = validateDoorFaceImages(
      aspenPair(combinedSwatch(), aspenDrawer()),
    );
    assert.deepEqual(issueKeys(result), ["door:combined-reveal"]);
    assert.match(result.issues[0]!.detail, /reveal/);
  });

  it("rejects a drawer-front image that still contains a drawer reveal", () => {
    const result = validateDoorFaceImages(
      aspenPair(aspenDoor(), combinedSwatch(640, 640)),
    );
    assert.deepEqual(issueKeys(result), ["drawer:combined-reveal"]);
  });

  it("rejects a dark falloff along one side", () => {
    const door = aspenDoor();
    const band = Math.round(door.width * 0.12);
    paintRect(door, 0, 0, band, door.height, [18, 18, 18]);
    const result = validateDoorFaceImages(aspenPair(door));
    assert.deepEqual(issueKeys(result), ["door:shadow"]);
    assert.match(result.issues[0]!.detail, /left/);
  });

  it("rejects a white page margin", () => {
    const door = aspenDoor();
    paintRect(door, 0, 0, door.width, MARGIN_PROBE_PX, [255, 255, 255]);
    const result = validateDoorFaceImages(aspenPair(door));
    assert.deepEqual(issueKeys(result), ["door:margin"]);
    assert.match(result.issues[0]!.detail, /white margin on the top/);
  });

  it("rejects a black page margin", () => {
    const door = aspenDoor();
    paintRect(door, 0, 0, door.width, MARGIN_PROBE_PX, [0, 0, 0]);
    const result = validateDoorFaceImages(aspenPair(door));
    assert.deepEqual(issueKeys(result), ["door:margin"]);
    assert.match(result.issues[0]!.detail, /black margin on the top/);
  });

  it("rejects a one-pixel dark rule along the edge", () => {
    const door = aspenDoor();
    paintRect(door, 0, 0, door.width, 1, [0, 0, 0]);
    const result = validateDoorFaceImages(aspenPair(door));
    assert.deepEqual(issueKeys(result), ["door:rule-line"]);
    assert.match(result.issues[0]!.detail, /top/);
  });

  it("reads the committed Torino TWP rows as a combined swatch", () => {
    const fixtureRoot = path.resolve(import.meta.dirname, "fixtures");
    const luminance = JSON.parse(
      readFileSync(path.join(fixtureRoot, "torino/row-luminance.json"), "utf8"),
    ) as Record<string, number[]>;
    const torino = detectHorizontalReveal(luminance.TWP!);
    assert.equal(torino.detected, true);
    const synthetic = detectHorizontalReveal(
      rowLuminanceFromImageData(aspenDoor().rgba, 640, 800),
    );
    assert.equal(synthetic.detected, false);
  });
});
