import { describe, expect, it } from "vitest";
import {
  SAMPLE_DOOR_COMPARE_GRID_CLASS,
  SAMPLE_DOOR_COMPARE_PANE_LABELS,
  SAMPLE_DOOR_COMPARE_RENDER_PANE_CLASS,
  sampleDoorComparisonErrorText,
  sampleDoorComparisonPhotoUrl,
  sampleDoorComparisonRenderInput,
} from "./sampleDoorCompare";
import type { DoorAuditDoorProfile } from "@/lib/doorRenderingAudit";

const PROFILE: DoorAuditDoorProfile = {
  doorStyle: "Shaker",
  doorPanelType: "flat",
  railWidth: 2.25,
  stileWidth: 2.25,
  panelConstruction: "flat",
  bevelWidth: null,
  bevelDepth: null,
  insideEdgeProfile: null,
  drawerFrontType: null,
  grainDirection: "vertical-stiles-horizontal-rails",
  finishSheen: "satin",
};

describe("sample door comparison", () => {
  it("uses the existing sample-door image source, in the app's own order", () => {
    // The finish swatch is what the Designer already shows (accepted render,
    // then the door record's sample, then the catalog thumbnail).
    expect(sampleDoorComparisonPhotoUrl({
      paletteSwatchUrl: "/approved/shaker-white.png",
      threeDDoorSampleUrl: "/three-d/door-face.jpg",
    })).toBe("/approved/shaker-white.png");
    // Then the 3D viewer's own door texture.
    expect(sampleDoorComparisonPhotoUrl({
      paletteSwatchUrl: null,
      threeDDoorSampleUrl: "/three-d/door-face.jpg",
    })).toBe("/three-d/door-face.jpg");
    expect(sampleDoorComparisonPhotoUrl({ paletteSwatchUrl: "  ", threeDDoorSampleUrl: " /three-d/door-face.jpg " }))
      .toBe("/three-d/door-face.jpg");
    // No photograph at all is a real state the pane has to describe, not a crash.
    expect(sampleDoorComparisonPhotoUrl({})).toBeNull();
  });

  it("labels both panes and makes them equal, large, and responsive", () => {
    expect(SAMPLE_DOOR_COMPARE_PANE_LABELS).toEqual({ sample: "Sample door", design: "Your design" });
    // Two equal panes on a desktop, stacked on a phone instead of squashed.
    expect(SAMPLE_DOOR_COMPARE_GRID_CLASS).toContain("md:grid-cols-2");
    expect(SAMPLE_DOOR_COMPARE_GRID_CLASS).toContain("grid");
    // Neither pane collapses below a readable height.
    expect(SAMPLE_DOOR_COMPARE_RENDER_PANE_CLASS).toContain("min-h-[min(38dvh,22rem)]");
    expect(SAMPLE_DOOR_COMPARE_RENDER_PANE_CLASS).toContain("flex-col");
  });

  it("renders the door rather than leaving the pane empty", () => {
    const input = sampleDoorComparisonRenderInput({
      style: {
        styleId: 330014,
        name: "Shaker White",
        code: "SH",
        distributorName: "WalzCraft",
        identity: { color: "#f2efe7", finish: "Painted", woodSpecies: null },
      },
      doorProfile: PROFILE,
      samplePhotoUrl: "/approved/shaker-white.png",
      renderExposure: 1.05,
    });
    expect(input).not.toBeNull();
    expect(input!.doorProfile).toBe(PROFILE);
    expect(input!.samplePhotoUrl).toBe("/approved/shaker-white.png");
    expect(input!.name).toBe("Shaker White");
    expect(input!.styleId).toBe(330014);
    // The finish resolver reads these off the row.
    expect((input as unknown as Record<string, unknown>).color).toBe("#f2efe7");
    expect((input as unknown as Record<string, unknown>).finish).toBe("Painted");
    // Same light level as the Designer's own door.
    expect(input!.renderExposure).toBe(1.05);
  });

  it("never colour-gates a customer comparison, so the pane cannot be refused", () => {
    const input = sampleDoorComparisonRenderInput({
      style: { styleId: 1, name: "Door", identity: { renderHex: "#c0c0c0" } },
      doorProfile: PROFILE,
      samplePhotoUrl: null,
    });
    // A stored render hex makes the audit path throw on a mismatch. The
    // comparison paints the resolved finish hex instead.
    expect(input!.renderHex).toBeNull();
    expect(input!.colorDeltaEMax).toBeNull();
  });

  it("returns null profile-free styles instead of throwing inside the dialog", () => {
    expect(sampleDoorComparisonRenderInput({
      style: { styleId: 1, name: "Door" },
      doorProfile: null,
      samplePhotoUrl: "/x.png",
    })).toBeNull();
  });

  it("always has wording for a failed capture", () => {
    expect(sampleDoorComparisonErrorText(new Error("The door render produced an empty image.")))
      .toBe("The door render produced an empty image.");
    expect(sampleDoorComparisonErrorText(new Error("   ")))
      .toBe("The door render could not be created in this browser.");
    expect(sampleDoorComparisonErrorText("offline"))
      .toBe("The door render could not be created in this browser.");
  });
});
