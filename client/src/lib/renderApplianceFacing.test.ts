import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, type PlacedCabinet, type RoomData, type SinkFixture } from "@/lib/design";
import {
  applianceLabel,
  appliancePlanFacing,
  buildRenderApplianceFacing,
  cameraPlanForward,
  hasRenderApplianceFacing,
  isRenderAppliance,
  renderWallPhrase,
} from "./renderApplianceFacing";

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 };

function placed(overrides: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode" | "placement">): PlacedCabinet {
  return {
    cabinetId: 0,
    description: "",
    x: 0,
    y: 0,
    width: 30,
    depth: 24,
    height: 36,
    rotation: 0,
    ...overrides,
  } as PlacedCabinet;
}

// A range seated on the back wall with its front into the room: the 3D body
// therefore turns 0 radians, because its own front is modelled on +Z.
const backWallRange = placed({
  uid: "range",
  masterCode: "RANGE-30",
  description: '30" Black Gas Range',
  placement: "appliance",
  x: 54,
  y: 0,
  wallId: "top",
  wallOffset: 54,
  rotation: 0,
});
const backWallHood = placed({
  uid: "hood",
  masterCode: "HOOD-30",
  description: '30" Glass Stainless Range Hood',
  placement: "appliance",
  x: 54,
  y: 0,
  wallId: "top",
  wallOffset: 54,
  mountBottom: 66,
});
const leftWallDishwasher = placed({
  uid: "dw",
  masterCode: "DW-24",
  description: 'Dishwasher 24"',
  placement: "appliance",
  x: 0,
  y: 40,
  width: 24,
  wallId: "left",
  wallOffset: 40,
  rotation: 270,
});
const fridge = placed({
  uid: "fridge",
  masterCode: "FRIDGE-36",
  description: "36″ Refrigerator",
  placement: "appliance",
  x: 3,
  y: 0,
  width: 36,
  depth: 30,
  height: 70,
  wallId: "top",
  wallOffset: 3,
});
const fridgeCap = placed({
  uid: "fridge-cap",
  masterCode: "WR3612",
  description: '36" x 12" Refrigerator Wall Cabinet',
  placement: "wall",
  x: 3,
  y: 0,
  width: 36,
  depth: 12,
  height: 12,
  mountBottom: 72,
  wallId: "top",
  wallOffset: 3,
});

describe("appliance facing read from the 3D placement", () => {
  it("takes the facing from the rendered body rotation, not from the wall alone", () => {
    // A body turned 90° in three.js looks along plan +x, whichever wall it is on.
    const facing = appliancePlanFacing(Math.PI / 2);
    expect(facing.x).toBeCloseTo(1, 6);
    expect(facing.y).toBeCloseTo(0, 6);
    expect(appliancePlanFacing(0)).toEqual({ x: 0, y: 1 });
  });

  it("describes the range on its own wall facing out into the room, with the hood above it", () => {
    const camera = { position: [72, 60, 260] as [number, number, number], target: [72, 20, 0] as [number, number, number] };
    const facts = buildRenderApplianceFacing({ placed: [backWallRange, backWallHood], room: ROOM, camera });
    expect(facts).toHaveLength(2);

    const rangeFact = facts.find((entry) => entry.kind === "range");
    expect(rangeFact).toMatchObject({ label: "Black Gas Range", wall: "the back wall" });
    expect(rangeFact?.front.x).toBeCloseTo(0, 6);
    expect(rangeFact?.front.y).toBeCloseTo(1, 6);
    expect(rangeFact?.cameraForward?.y).toBeLessThan(0);

    const hoodFact = facts.find((entry) => entry.kind === "hood");
    expect(hoodFact?.above).toBe("Black Gas Range");
    expect(hoodFact?.wall).toBe("the back wall");
    expect(hoodFact?.front).toEqual(rangeFact?.front);
  });

  it("keeps every appliance on its own wall instead of one shared direction", () => {
    const facts = buildRenderApplianceFacing({ placed: [backWallRange, leftWallDishwasher], room: ROOM });
    const dishwasher = facts.find((entry) => entry.kind === "dishwasher");
    expect(dishwasher?.wall).toBe("the left wall");
    // Saved plan rotation 270 means the body faces into the room from the left wall: plan +x.
    expect(dishwasher?.front.x).toBeCloseTo(1, 6);
    expect(dishwasher?.front.y).toBeCloseTo(0, 6);
    expect(dishwasher?.inward?.x).toBeCloseTo(1, 6);
  });

  it("pairs the cabinet above a refrigerator with that refrigerator on the same wall", () => {
    const facts = buildRenderApplianceFacing({ placed: [fridge, fridgeCap], room: ROOM });
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      kind: "refrigerator",
      wall: "the back wall",
      overCabinet: "wall cabinet",
    });
  });

  it("carries the sink's own wall with its faucet behind the bowl", () => {
    const sink: SinkFixture = {
      uid: "sink",
      type: "single",
      x: 60,
      y: 2,
      width: 30,
      depth: 20,
      faucet: true,
      wallSide: "top",
      pelicanProductName: "Stainless farmhouse sink",
    };
    const facts = buildRenderApplianceFacing({ placed: [], sinks: [sink], room: ROOM });
    expect(facts).toEqual([
      expect.objectContaining({
        kind: "sink",
        label: "Stainless farmhouse sink",
        wall: "the back wall",
        front: { x: 0, y: 1 },
      }),
    ]);  });

  it("reads the camera axis from the locked capture so 'toward the camera' is not a guess", () => {
    expect(cameraPlanForward(null)).toBeNull();
    expect(cameraPlanForward({ position: [1, 2, 3], target: [1, 2, 3] })).toBeNull();
    const forward = cameraPlanForward({ position: [0, 40, 200], target: [0, 20, 0] });
    expect(forward).toEqual({ x: 0, y: -200 });
  });
});

describe("naming and appliance selection", () => {
  it("names a wall from the run it belongs to, generically", () => {
    expect(renderWallPhrase("top", ROOM)).toBe("the back wall");
    expect(renderWallPhrase("bottom", ROOM)).toBe("the front wall");
    expect(renderWallPhrase("left", ROOM)).toBe("the left wall");
    expect(renderWallPhrase("right", ROOM)).toBe("the right wall");
    expect(renderWallPhrase("pen-1", { ...ROOM, peninsulaRuns: [{ id: "pen-1" }] } as RoomData)).toBe("the peninsula");
    expect(renderWallPhrase("w-1", { ...ROOM, customWalls: [{ id: "w-1", label: "Pantry Wall" }] } as unknown as RoomData)).toBe("the pantry wall");
    expect(renderWallPhrase(null, ROOM)).toBe("its wall");
  });

  it("drops the trailing catalog size from an appliance name", () => {
    expect(applianceLabel({ masterCode: "HOOD-30", description: '30" Glass Stainless Range Hood', width: 30 }, "hood")).toBe("Glass Stainless Range Hood");
    expect(applianceLabel({ masterCode: "DW-24", description: "Dishwasher", width: 24 }, "dishwasher")).toBe("Dishwasher");
    expect(applianceLabel({ masterCode: "DW-24", description: null, width: 24 }, "dishwasher")).toBe("24 inch dishwasher");
  });

  it("takes exactly the placed appliances, never a name match on a cabinet", () => {
    expect(isRenderAppliance(backWallRange)).toBe(true);
    expect(isRenderAppliance({ masterCode: "B36", description: "36\" Base Cabinet", placement: "base" })).toBe(false);
    expect(isRenderAppliance({ masterCode: "RANGE-30", description: "Range", placement: "base" })).toBe(true);
  });

  it("reports whether there is anything to state", () => {
    expect(hasRenderApplianceFacing(buildRenderApplianceFacing({ placed: [backWallRange], room: ROOM }))).toBe(true);
    expect(hasRenderApplianceFacing(buildRenderApplianceFacing({ placed: [], room: ROOM }))).toBe(false);
    expect(hasRenderApplianceFacing(null)).toBe(false);
  });
});
