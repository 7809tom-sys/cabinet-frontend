import { describe, expect, it } from "vitest";
import {
  APPLIANCE_ORIENTATION_LOCK,
  applianceFacingCameraPhrase,
  applianceFacingDirectionPhrase,
  buildApplianceFacingPromptBlock,
  buildApplianceFacingStatements,
  describeApplianceFacing,
  type ApplianceFacingFacts,
} from "./applianceFacing";

const backWallInward = { x: 0, y: 1 };
const cameraInFront = { x: 0, y: -1 };

function range(overrides: Partial<ApplianceFacingFacts> = {}): ApplianceFacingFacts {
  return {
    kind: "range",
    label: "slide-in range",
    wall: "the back wall",
    front: backWallInward,
    inward: backWallInward,
    cameraForward: cameraInFront,
    ...overrides,
  };
}

describe("appliance facing sentences", () => {
  it("states a range on the back wall facing out into the room toward the camera", () => {
    const sentence = describeApplianceFacing(range());
    expect(sentence).toBe(
      "The slide-in range sits in the base run against the back wall, with its back to that wall and its oven door and front controls facing out into the room and toward the camera.",
    );
  });

  it("puts a hood directly above the appliance it serves and keeps its facing", () => {
    const sentence = describeApplianceFacing({
      kind: "hood",
      label: "range hood",
      wall: "the back wall",
      front: backWallInward,
      inward: backWallInward,
      cameraForward: cameraInFront,
      above: "slide-in range",
    });
    expect(sentence).toContain("is mounted on the back wall directly above the slide-in range");
    expect(sentence).toContain("centered on it");
    expect(sentence).toContain("it faces the same way as the slide-in range");
  });

  it("keeps the cabinet above a refrigerator on the refrigerator's own wall", () => {
    const sentence = describeApplianceFacing({
      kind: "refrigerator",
      label: "french-door refrigerator",
      wall: "the left wall",
      front: { x: 1, y: 0 },
      inward: { x: 1, y: 0 },
      cameraForward: cameraInFront,
      overCabinet: "refrigerator wall cabinet",
    });
    expect(sentence).toContain("sits in its bay against the left wall");
    expect(sentence).toContain("its doors and dispenser facing out into the room");
    expect(sentence).toContain("The refrigerator wall cabinet stays on the left wall directly above the french-door refrigerator");
  });

  it("describes a sink with its faucet behind the bowl against its wall", () => {
    const sentence = describeApplianceFacing({
      kind: "sink",
      label: "farmhouse sink",
      wall: "the back wall",
      front: backWallInward,
      inward: backWallInward,
      cameraForward: cameraInFront,
    });
    expect(sentence).toContain("is set into the countertop on the back wall");
    expect(sentence).toContain("its faucet and front rim facing out into the room");
    expect(sentence).toContain("faucet behind the bowl against that wall");
  });

  it("says an appliance that really was turned across its run is along the run, not into the room", () => {
    const sentence = describeApplianceFacing(range({
      front: { x: 1, y: 0 },
      inward: backWallInward,
      cameraForward: cameraInFront,
    }));
    expect(sentence).toContain("along its cabinet run");
    expect(sentence).not.toContain("out into the room");
  });

  it("falls back to a plain direction when the camera axis is unknown", () => {
    expect(applianceFacingCameraPhrase({ front: backWallInward })).toBe("");
    expect(applianceFacingDirectionPhrase({ front: backWallInward, inward: backWallInward })).toBe("out into the room");
    expect(describeApplianceFacing(range({ cameraForward: null }))).toContain("facing out into the room.");
  });
});

describe("camera-relative facing words", () => {
  it("reads the front that points back at the camera as toward the camera", () => {
    expect(applianceFacingCameraPhrase({ front: { x: 0, y: 1 }, cameraForward: { x: 0, y: -1 } })).toBe("toward the camera");
    expect(applianceFacingCameraPhrase({ front: { x: 0, y: -1 }, cameraForward: { x: 0, y: -1 } })).toBe("away from the camera");
  });

  it("mirrors left and right against the camera, not the plan, for a perpendicular front", () => {
    // The camera looks along -y, so its own right hand is plan +x.
    expect(applianceFacingCameraPhrase({ front: { x: 1, y: 0 }, cameraForward: { x: 0, y: -1 } }))
      .toBe("across the camera's view to the right");
    expect(applianceFacingCameraPhrase({ front: { x: -1, y: 0 }, cameraForward: { x: 0, y: -1 } }))
      .toBe("across the camera's view to the left");
  });

  it("normalizes unnormalized vectors so a long direction reads the same as a unit one", () => {
    expect(applianceFacingCameraPhrase({ front: { x: 0, y: 42 }, cameraForward: { x: 0, y: -7 } })).toBe("toward the camera");
  });
});

describe("the appliance facing prompt block", () => {
  it("states the layout lock before any per-appliance sentence", () => {
    const block = buildApplianceFacingPromptBlock([range()]);
    expect(block.startsWith(APPLIANCE_ORIENTATION_LOCK)).toBe(true);
    expect(block).toContain("reference image 1 IS the layout to preserve");
    expect(block).toContain("Do not rotate, turn, flip, mirror, slide, swap, re-orient, or rearrange");
    expect(block).toContain("image 1 wins");
    expect(block.indexOf("The slide-in range sits")).toBeGreaterThan(block.indexOf("ORIENTATION LOCK"));
  });

  it("builds one sentence per appliance, generically for any mix", () => {
    const statements = buildApplianceFacingStatements([
      range(),
      { kind: "dishwasher", label: "dishwasher", wall: "the left wall", front: { x: 1, y: 0 }, inward: { x: 1, y: 0 }, cameraForward: cameraInFront },
      { kind: "cooktop", label: "gas cooktop", wall: "the peninsula", front: { x: 0, y: 1 }, inward: { x: 0, y: 1 }, cameraForward: cameraInFront },
      { kind: "microwave", label: "over-range microwave", wall: "the back wall", front: backWallInward, inward: backWallInward, cameraForward: cameraInFront, above: "slide-in range" },
    ]);
    expect(statements).toHaveLength(4);
    expect(statements[0]).toContain("The slide-in range");
    expect(statements[1]).toContain("The dishwasher");
    expect(statements[2]).toContain("against the peninsula");
    expect(statements[3]).toContain("directly above the slide-in range");
  });

  it("returns empty text when there is nothing to describe, so the prompt stays unchanged", () => {
    expect(buildApplianceFacingPromptBlock([])).toBe("");
    expect(buildApplianceFacingPromptBlock(null)).toBe("");
    expect(buildApplianceFacingPromptBlock(undefined)).toBe("");
  });

  it("never needs a hard-coded kitchen: a custom wall name is used verbatim", () => {
    const sentence = describeApplianceFacing(range({ wall: "the pantry wall" }));
    expect(sentence).toContain("against the pantry wall");
  });
});
