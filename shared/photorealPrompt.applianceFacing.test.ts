import { describe, expect, it } from "vitest";
import { buildPhotorealPrompt, type PhotorealPromptInput } from "./photorealPrompt";
import { APPLIANCE_ORIENTATION_LOCK } from "./applianceFacing";

const base: PhotorealPromptInput = {
  roomWidthFt: 12,
  roomDepthFt: 10,
  finishName: "Aspen White",
  doorStyle: "Shaker",
  appliances: ["a range", "a refrigerator"],
};

const backWall = { x: 0, y: 1 };
const cameraInFront = { x: 0, y: -1 };

describe("buildPhotorealPrompt appliance orientation", () => {
  it("states the layout lock and every appliance's wall and facing", () => {
    const prompt = buildPhotorealPrompt({
      ...base,
      applianceFacing: [
        { kind: "range", label: "slide-in range", wall: "the back wall", front: backWall, inward: backWall, cameraForward: cameraInFront },
        { kind: "hood", label: "range hood", wall: "the back wall", front: backWall, inward: backWall, cameraForward: cameraInFront, above: "slide-in range" },
        { kind: "sink", label: "farmhouse sink", wall: "the back wall", front: backWall, inward: backWall, cameraForward: cameraInFront },
      ],
    });
    expect(prompt).toContain(APPLIANCE_ORIENTATION_LOCK);
    expect(prompt).toContain("The slide-in range sits in the base run against the back wall");
    expect(prompt).toContain("facing out into the room and toward the camera");
    expect(prompt).toContain("The range hood is mounted on the back wall directly above the slide-in range");
    expect(prompt).toContain("The farmhouse sink is set into the countertop on the back wall");
  });

  it("keeps the appliance list and the facing block together, layout lock after the plan rules", () => {
    const prompt = buildPhotorealPrompt({
      ...base,
      applianceFacing: [{ kind: "range", label: "range", wall: "the back wall", front: backWall, inward: backWall }],
    });
    expect(prompt.indexOf("Do not add any other appliances")).toBeLessThan(prompt.indexOf("ORIENTATION LOCK"));
    expect(prompt.indexOf("ORIENTATION LOCK")).toBeLessThan(prompt.indexOf("Tastefully but minimally staged"));
  });

  it("leaves the prompt unchanged when no facing data is supplied", () => {
    const withoutFacing = buildPhotorealPrompt(base);
    expect(withoutFacing).not.toContain("ORIENTATION LOCK");
    expect(buildPhotorealPrompt({ ...base, applianceFacing: [] })).toBe(withoutFacing);
  });
});
