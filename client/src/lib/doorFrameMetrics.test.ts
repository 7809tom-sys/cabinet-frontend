import { describe, expect, it } from "vitest";
import {
  completeDoorFrameMetrics,
  designerDoorFrameMetrics,
  designerFrameCompliance,
  SLIM_SHAKER_FRAME_INCHES,
} from "./doorFrameMetrics";

describe("completeDoorFrameMetrics", () => {
  it("keeps a complete style's own rail and stile dimensions", () => {
    expect(completeDoorFrameMetrics({
      railWidth: "2.00",
      stileWidth: 2,
      sourceSpecification: "Skyline 2026 Slim Shaker catalog — exact style code SS-DW",
    })).toEqual({
      railWidth: 2,
      stileWidth: 2,
    });
  });

  it("accepts an approved measured-from-sample-door citation as a source-bound Designer profile", () => {
    expect(completeDoorFrameMetrics({
      railWidth: 2.25,
      stileWidth: 2.5,
      sourceSpecification: "Measured from sample door: Kitchen Crest KC-101, measured by A. Vendor on 2026-09-27.",
    })).toEqual({ railWidth: 2.25, stileWidth: 2.5 });
  });

  it("uses neutral fallback for a partial, unbound, or missing frame record", () => {
    expect(completeDoorFrameMetrics({ railWidth: "2.00", stileWidth: null, sourceSpecification: "Official catalog" })).toBeNull();
    expect(completeDoorFrameMetrics({ railWidth: 0, stileWidth: 2, sourceSpecification: "Official catalog" })).toBeNull();
    expect(completeDoorFrameMetrics({ railWidth: 2, stileWidth: 2, sourceSpecification: null })).toBeNull();
    expect(completeDoorFrameMetrics(null)).toBeNull();
  });

  it("uses the one-inch Slim Shaker construction rule without changing ordinary uncited Shaker", () => {
    expect(designerDoorFrameMetrics({
      doorStyle: "Slim Shaker",
      doorPanelType: "Five-piece solid wood with MDF center panel",
      railWidth: "3.00",
      stileWidth: "3.00",
      sourceSpecification: null,
    })).toEqual({ railWidth: SLIM_SHAKER_FRAME_INCHES, stileWidth: SLIM_SHAKER_FRAME_INCHES });
    expect(designerDoorFrameMetrics({
      doorStyle: "Shaker",
      railWidth: "1.00",
      stileWidth: "1.00",
      sourceSpecification: null,
    })).toBeNull();
  });

  it("marks a Featured Door Style noncompliant until measurements and its official citation are present", () => {
    expect(designerFrameCompliance({
      railWidth: 2,
      stileWidth: 2,
      sourceSpecification: "Exact manufacturer style specification",
    })).toEqual({ isCompliant: true, reason: null });
    expect(designerFrameCompliance({ railWidth: 2, stileWidth: 2, sourceSpecification: null })).toEqual({
      isCompliant: false,
      reason: "An official source citation is required.",
    });
    expect(designerFrameCompliance({ railWidth: 2, stileWidth: null, sourceSpecification: "Exact manufacturer style specification" })).toEqual({
      isCompliant: false,
      reason: "Verified rail and stile measurements are required.",
    });
    expect(designerFrameCompliance(null)).toEqual({
      isCompliant: false,
      reason: "Verified rail and stile measurements plus an official source citation are required.",
    });
  });
});
