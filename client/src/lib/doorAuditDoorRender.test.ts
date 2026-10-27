import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  auditDoorConstruction,
  buildAuditDoor,
  configureDoorAuditSampleTexture,
} from "./doorAuditDoorRender";
import { normalizeDoorAuditStartRun, type DoorAuditRenderInput } from "./doorRenderingAudit";

function input(profile: DoorAuditRenderInput["doorProfile"]): Pick<DoorAuditRenderInput, "doorProfile" | "color" | "samplePhotoUrl"> {
  return { doorProfile: profile, color: "#f7f4ee", samplePhotoUrl: null };
}

const shaker: DoorAuditRenderInput["doorProfile"] = {
  doorStyle: "Shaker",
  doorPanelType: null,
  railWidth: "3",
  stileWidth: "3",
  panelConstruction: "flat",
  bevelWidth: null,
  bevelDepth: null,
  insideEdgeProfile: "square",
  drawerFrontType: "five-piece-flat",
  grainDirection: "vertical",
  finishSheen: "satin",
};

describe("audit door construction", () => {
  it("builds a 3-inch shaker frame with the designer rail helper", () => {
    const plan = auditDoorConstruction(shaker);
    expect(plan).toMatchObject({ kind: "shaker", framed: true, widthIn: 18, heightIn: 30, railIn: 3, stileIn: 3 });
    const door = buildAuditDoor(input(shaker), null);
    const rails = door.children.flatMap((child) => child.children ?? []).filter((child) => child.userData.physicalRail);
    expect(rails).toHaveLength(4);
    expect(door.userData.auditDoorKind).toBe("shaker");
  });

  it("honors a slim stile and stays identical across calls", () => {
    const slim = { ...shaker, railWidth: "2.5", stileWidth: "1" };
    expect(auditDoorConstruction(slim).stileIn).toBeCloseTo(1);
    expect(auditDoorConstruction(slim).railIn).toBeCloseTo(2.5);
    expect(auditDoorConstruction(slim)).toEqual(auditDoorConstruction(slim));
  });

  it("leaves a slab door without rails and raises a center panel for raised profiles", () => {
    const slab = buildAuditDoor(input({ ...shaker, doorStyle: "Slab", panelConstruction: "slab" }), null);
    expect(slab.userData.auditDoorKind).toBe("flat");
    expect(JSON.stringify(slab.userData)).not.toContain("physicalRail");
    const raised = buildAuditDoor(input({
      ...shaker,
      doorStyle: "Raised",
      panelConstruction: "raised",
      bevelWidth: "0.5",
      bevelDepth: "0.18",
    }), null);
    const center = raised.children.flatMap((child) => child.children ?? []).find((child) => child.userData.raisedCenterPanel);
    expect(center).toBeTruthy();
    expect(auditDoorConstruction({
      ...shaker,
      doorStyle: "Raised",
      panelConstruction: "raised",
      bevelWidth: "0.5",
      bevelDepth: "0.18",
    }).bevelWidthIn).toBeCloseTo(0.5);
  });

  it("frames a glass door with a glass center instead of an opaque slab", () => {
    const glass = buildAuditDoor(input({ ...shaker, panelConstruction: "glass" }), null);
    expect(glass.userData.auditDoorKind).toBe("glass");
    expect(glass.children.some((child) => child.userData.glassCenter)).toBe(true);
    expect(glass.children.some((child) => child.userData.auditDoorSlab)).toBe(false);
  });

  it("renders a selected-run style from the backend profile field", () => {
    const run = normalizeDoorAuditStartRun({
      runId: 15,
      status: "awaiting_renders",
      scope: "selected",
      styles: [{
        styleId: 41,
        styleCode: "SW-41",
        ourName: "Summit White Shaker",
        distributorName: "Summit Cabinets",
        samplePhotoUrl: null,
        color: "#f4f1ea",
        profile: {
          doorStyle: "Shaker",
          doorPanelType: null,
          railWidth: "3",
          stileWidth: "3",
          panelConstruction: "flat",
          bevelWidth: null,
          bevelDepth: null,
          insideEdgeProfile: null,
          drawerFrontType: null,
          grainDirection: "vertical",
          finishSheen: "satin",
        },
      }],
    });
    const door = buildAuditDoor(run.styles[0], null);
    expect(door.userData.auditDoorKind).toBe("shaker");
    expect(run.styles[0]?.doorProfile.finishSheen).toBe("satin");
  });

  it("reports a missing profile instead of reading a property of undefined", () => {
    expect(() => buildAuditDoor({ color: "#fff", samplePhotoUrl: null, name: "Summit White Shaker" }, null))
      .toThrow(/Summit White Shaker is missing its door profile/);
  });

  it("crops a sample photo to the designer center grain", () => {
    const texture = new THREE.Texture();
    configureDoorAuditSampleTexture(texture, "https://cdn.example/door.jpg");
    expect(texture.repeat.x).toBeCloseTo(0.42);
    expect(texture.repeat.y).toBeCloseTo(0.42);
    expect(texture.offset.x).toBeCloseTo(0.29);
    expect(texture.offset.y).toBeCloseTo(0.29);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });
});
