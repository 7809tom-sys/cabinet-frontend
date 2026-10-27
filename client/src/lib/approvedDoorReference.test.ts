import { describe, expect, it } from "vitest";
import {
  FEATURED_IMAGE_MISMATCH_REASON,
  NO_APPROVED_SOURCE_LABEL,
  STAINLESS_DOOR_STYLE_FIXTURE,
  comparisonBaseline,
  featuredImagesAudit,
  preferredDoorReferenceUrl,
  preferredDrawerReferenceUrl,
} from "./approvedDoorReference";

describe("approved door reference", () => {
  it("compares new renders to the approved reference and falls back to the sample photo", () => {
    expect(comparisonBaseline({
      approvedReferenceImageUrl: "/approved.png",
      samplePhotoUrl: "/sample.png",
    })).toEqual({ imageUrl: "/approved.png", source: "approved-reference" });
    expect(comparisonBaseline({
      approvedReferenceImageUrl: "  ",
      samplePhotoUrl: "/sample.png",
    })).toEqual({ imageUrl: "/sample.png", source: "sample-photo" });
    expect(comparisonBaseline({ samplePhotoUrl: null })).toEqual({ imageUrl: null, source: "none" });
  });

  it("flags a style with no approved reference instead of passing it", () => {
    const audit = featuredImagesAudit({
      approvedReferenceImageUrl: null,
      doorSampleImageUrl: "/sample.png",
      drawerSampleImageUrl: "/drawer.png",
    });
    expect(audit.sourceStatus).toBe("no-approved-source");
    expect(audit.failures).toEqual([]);
    expect(NO_APPROVED_SOURCE_LABEL).toBe("No approved source");
  });

  it("fails the door and the drawer separately when both featured images differ from the approved source", () => {
    const audit = featuredImagesAudit({
      approvedReferenceImageUrl: "/approved.png?v=1",
      doorSampleImageUrl: "/featured-door.png",
      drawerSampleImageUrl: "/featured-drawer.png",
    });
    expect(audit.sourceStatus).toBe("featured-mismatch");
    expect(audit.failures).toEqual([
      { image: "door", reason: FEATURED_IMAGE_MISMATCH_REASON },
      { image: "drawer", reason: FEATURED_IMAGE_MISMATCH_REASON },
    ]);
    expect(FEATURED_IMAGE_MISMATCH_REASON).toBe("Featured image doesn't match approved source");
  });

  it("leaves a missing drawer photo out of the check and accepts a featured photo that is the approved file", () => {
    expect(featuredImagesAudit({
      approvedReferenceImageUrl: "/approved.png",
      doorSampleImageUrl: "/approved.png?cache=1",
      drawerSampleImageUrl: null,
    })).toEqual({ sourceStatus: "approved", failures: [] });
  });

  it("prefers the approved reference over a mismatched featured image in the Designer", () => {
    expect(preferredDoorReferenceUrl({
      approvedReferenceImageUrl: "/approved.png",
      doorSampleImageUrl: "/wrong.png",
      thumbnailImageUrl: "/thumb.png",
    })).toBe("/approved.png");
    expect(preferredDoorReferenceUrl({
      approvedReferenceImageUrl: null,
      doorSampleImageUrl: "/sample.png",
      thumbnailImageUrl: "/thumb.png",
    })).toBe("/sample.png");
    expect(preferredDrawerReferenceUrl({
      approvedReferenceImageUrl: "/approved.png",
      drawerSampleImageUrl: "/wrong-drawer.png",
    })).toBe("/approved.png");
    expect(preferredDrawerReferenceUrl({
      approvedReferenceImageUrl: null,
      drawerSampleImageUrl: "/drawer.png",
    })).toBe("/drawer.png");
  });

  it("fails the Stainless door style when its featured door and drawer photos are not the approved reference", () => {
    const style = STAINLESS_DOOR_STYLE_FIXTURE;
    expect(style.styleName).toBe("Stainless");
    const audit = featuredImagesAudit(style);
    expect(audit.sourceStatus).toBe("featured-mismatch");
    expect(audit.failures.map((failure) => failure.image)).toEqual(["door", "drawer"]);
    expect(audit.failures.every((failure) => failure.reason === FEATURED_IMAGE_MISMATCH_REASON)).toBe(true);
    expect(comparisonBaseline(style).imageUrl).toBe(style.approvedReferenceImageUrl);
    expect(preferredDoorReferenceUrl(style)).toBe(style.approvedReferenceImageUrl);
    expect(preferredDrawerReferenceUrl(style)).toBe(style.approvedReferenceImageUrl);
    expect(preferredDoorReferenceUrl(style)).not.toBe(style.doorSampleImageUrl);
    expect(preferredDrawerReferenceUrl(style)).not.toBe(style.drawerSampleImageUrl);
  });
});
