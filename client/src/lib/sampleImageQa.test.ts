import { describe, expect, it } from "vitest";
import { preferredDoorReferenceUrl, preferredDrawerReferenceUrl } from "./approvedDoorReference";
import {
  DOOR_SAMPLE_ASPECT,
  DRAWER_SAMPLE_ASPECT,
  SAMPLE_IMAGE_MIN_SHORT_SIDE_PX,
  assessDoorSample,
  assessDrawerSample,
  assessSampleImage,
  distinctDrawerSampleUrl,
  formatSampleImageFlag,
  sampleAspectCss,
  sampleAspectIsFarOff,
  type SampleStyleImages,
} from "./sampleImageQa";

const brochure = "/brochure/syncron-slim-cava-scn.jpg";

/** Frameless style whose door, drawer, and thumbnail slots share one cropped brochure file. */
const syncronSlimCava: SampleStyleImages = {
  doorSampleImageUrl: brochure,
  drawerSampleImageUrl: `${brochure}?cache=2`,
  thumbnailImageUrl: brochure,
};

describe("sample image display", () => {
  it("keeps a 2:3 door tile and a 4:1 drawer-front tile", () => {
    expect(DOOR_SAMPLE_ASPECT).toBeCloseTo(2 / 3);
    expect(DRAWER_SAMPLE_ASPECT).toBe(4);
    expect(sampleAspectCss("door")).toBe("2 / 3");
    expect(sampleAspectCss("drawer")).toBe("4 / 1");
    expect(sampleAspectIsFarOff("door", 800, 1200)).toBe(false);
    expect(sampleAspectIsFarOff("door", 1000, 1000)).toBe(true);
    expect(sampleAspectIsFarOff("drawer", 1600, 400)).toBe(false);
    expect(sampleAspectIsFarOff("drawer", 1600, 900)).toBe(true);
  });

  it("draws a drawer front when Syncron Slim Cava SCN repeats the door file", () => {
    expect(distinctDrawerSampleUrl(syncronSlimCava)).toBeNull();
    const decision = assessDrawerSample(syncronSlimCava);
    expect(decision.useDrawing).toBe(true);
    expect(decision.photoUrl).toBeNull();
    expect(decision.issues.map((issue) => issue.code)).toEqual(["duplicate"]);
    expect(decision.issues[0]?.detail).toContain("door");
    expect(decision.issues[0]?.detail).toContain("thumbnail");
    expect(assessDoorSample(syncronSlimCava).map((issue) => issue.code)).toEqual(["duplicate"]);
  });

  it("draws a drawer front when the drawer picture is missing", () => {
    const style: SampleStyleImages = {
      doorSampleImageUrl: "/doors/white-shaker.png",
      drawerSampleImageUrl: "  ",
      thumbnailImageUrl: "/thumbs/white-shaker.png",
    };
    const decision = assessDrawerSample(style);
    expect(decision.useDrawing).toBe(true);
    expect(decision.issues).toEqual([]);
    expect(assessDoorSample(style)).toEqual([]);
  });

  it("does not reuse an approved door render as the drawer picture", () => {
    const style: SampleStyleImages = {
      approvedReferenceImageUrl: "/approved/stainless-door.png",
      doorSampleImageUrl: "/featured/stainless-wrong-door.jpg",
      drawerSampleImageUrl: "/featured/stainless-wrong-drawer.jpg",
      thumbnailImageUrl: "/featured/stainless-thumb.jpg",
    };
    expect(preferredDoorReferenceUrl(style)).toBe("/approved/stainless-door.png");
    expect(preferredDrawerReferenceUrl(style)).toBe("/approved/stainless-door.png");
    expect(distinctDrawerSampleUrl(style)).toBeNull();
    const decision = assessDrawerSample(style);
    expect(decision.useDrawing).toBe(true);
    expect(decision.photoUrl).toBeNull();
    expect(decision.issues).toEqual([]);
  });

  it("keeps a distinct drawer photo that matches the expected shape and size", () => {
    const style: SampleStyleImages = {
      doorSampleImageUrl: "/doors/white-shaker.png",
      drawerSampleImageUrl: "/drawers/white-shaker-front.png",
      thumbnailImageUrl: "/thumbs/white-shaker.png",
    };
    expect(distinctDrawerSampleUrl(style)).toBe("/drawers/white-shaker-front.png");
    expect(assessDrawerSample(style, "pending")).toMatchObject({
      photoUrl: "/drawers/white-shaker-front.png",
      useDrawing: false,
      pending: true,
      issues: [],
    });
    const ready = assessDrawerSample(style, { width: 1600, height: 400 });
    expect(ready.useDrawing).toBe(false);
    expect(ready.photoUrl).toBe("/drawers/white-shaker-front.png");
    expect(ready.issues).toEqual([]);
  });

  it("falls back to the drawing and flags a low-resolution or stretched drawer photo", () => {
    const style: SampleStyleImages = {
      doorSampleImageUrl: "/doors/cava.png",
      drawerSampleImageUrl: "/drawers/cava-tiny.jpg",
    };
    const lowResolution = assessDrawerSample(style, { width: 200, height: 50 });
    expect(lowResolution.useDrawing).toBe(true);
    expect(lowResolution.photoUrl).toBeNull();
    expect(lowResolution.issues.map((issue) => issue.code)).toEqual(["low-resolution"]);
    expect(lowResolution.issues[0]?.detail).toContain(String(SAMPLE_IMAGE_MIN_SHORT_SIDE_PX));

    const stretched = assessDrawerSample(style, { width: 900, height: 900 });
    expect(stretched.useDrawing).toBe(true);
    expect(stretched.issues.map((issue) => issue.code)).toEqual(["stretched"]);

    const both = assessDrawerSample(style, { width: 80, height: 80 });
    expect(both.issues.map((issue) => issue.code)).toEqual(["low-resolution", "stretched"]);
    expect(formatSampleImageFlag(both.issues)).toContain("Low resolution");
    expect(formatSampleImageFlag(both.issues)).toContain("Crop doesn't match");
  });

  it("flags a door photo that is low-resolution or stretched without hiding it", () => {
    const style: SampleStyleImages = {
      doorSampleImageUrl: "/brochure/wide-kitchen.jpg",
      drawerSampleImageUrl: "/drawers/real-front.png",
    };
    const issues = assessDoorSample(style, { width: 1600, height: 900 });
    expect(issues.map((issue) => issue.code)).toEqual(["stretched"]);
    expect(preferredDoorReferenceUrl(style)).toBe("/brochure/wide-kitchen.jpg");

    const soft = assessDoorSample(
      { doorSampleImageUrl: "/doors/soft.png", drawerSampleImageUrl: "/drawers/real-front.png" },
      { width: 120, height: 180 },
    );
    expect(soft.map((issue) => issue.code)).toEqual(["low-resolution"]);
    expect(formatSampleImageFlag(soft, true)).toContain("Picture could not be loaded.");
  });

  it("treats a failed drawer load as a drawing fallback", () => {
    const style: SampleStyleImages = {
      doorSampleImageUrl: "/doors/white.png",
      drawerSampleImageUrl: "/drawers/missing.png",
    };
    const decision = assessDrawerSample(style, "error");
    expect(decision.useDrawing).toBe(true);
    expect(decision.loadFailed).toBe(true);
    expect(formatSampleImageFlag(decision.issues, decision.loadFailed)).toBe("Picture could not be loaded.");
  });

  it("flags a duplicate only from the url, ignoring query strings", () => {
    const issues = assessSampleImage({
      role: "drawer",
      url: "/door.png?v=9",
      doorUrl: "/door.png",
      thumbnailUrl: "/thumb.png",
    });
    expect(issues).toEqual([{ code: "duplicate", detail: "Same file as the door." }]);
    expect(assessSampleImage({
      role: "drawer",
      url: "/thumb.png?x=1",
      doorUrl: "/door.png",
      thumbnailUrl: "/thumb.png",
    })).toEqual([{ code: "duplicate", detail: "Same file as the thumbnail." }]);
  });
});
