import { describe, expect, it } from "vitest";
import { existingCabinetSku, threeDRenderPlacements } from "./InteractiveRoom3D";
import type { PlacedCabinet, RoomData } from "@/lib/design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

const refrigerator: PlacedCabinet = {
  uid: "legacy-fridge",
  cabinetId: 82,
  masterCode: "FRIDGE-36",
  description: "36 inch refrigerator",
  placement: "appliance",
  x: 20,
  y: 0,
  width: 36,
  depth: 30,
  height: 70,
  mountBottom: 0,
  rotation: 0,
};

const bridge: PlacedCabinet = {
  uid: "legacy-refrigerator-bridge",
  cabinetId: 84,
  masterCode: "WR3612",
  description: "Refrigerator cabinet above",
  placement: "wall",
  x: 20,
  y: 0,
  width: 36,
  depth: 24,
  height: 12,
  mountBottom: 72,
  rotation: 0,
  refrigeratorAssemblyId: refrigerator.uid,
  refrigeratorAssemblyRole: "bridge",
};

describe("3D refrigerator cap-filler render input", () => {
  it("renders a pre-role bridge-linked cap filler at the over-fridge bridge envelope without mutating the saved record", () => {
    const legacyCapFiller: PlacedCabinet = {
      uid: "legacy-cap-filler",
      cabinetId: 85,
      masterCode: "F342",
      description: "Filler — cut to 1/2 inch",
      category: "Filler",
      subCategory: "Filler",
      placement: "base",
      x: 19.5,
      y: 0,
      width: 0.5,
      depth: 24,
      height: 70,
      mountBottom: 0,
      rotation: 0,
      fillerForCabinetUid: bridge.uid,
    };

    const rendered = threeDRenderPlacements([refrigerator, bridge, legacyCapFiller], room);
    const renderedCap = rendered[2]!;

    expect(renderedCap).toMatchObject({
      uid: legacyCapFiller.uid,
      placement: "wall",
      height: 12,
      depth: 24,
      mountBottom: 72,
      fillerForCabinetUid: bridge.uid,
      fillerMatchesFullOwnerEnvelope: false,
    });
    expect(existingCabinetSku(renderedCap, room)).toMatchObject({
      placementType: "wall",
      height: 12,
      depth: 24,
      mountBottom: 72,
    });
    expect(legacyCapFiller).toMatchObject({ placement: "base", height: 70, mountBottom: 0 });
  });
});
