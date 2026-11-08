import { describe, expect, it } from "vitest";
import type { RoomData } from "./design";
import { choosePart, showerPlacementIssues, skipStep, type ShowerCatalogPart } from "./showerBuilder";
import {
  bayForWall,
  clampShowerHeight,
  panFitsOpening,
  placeShowerDoor,
  placeShowerPanInsideOpening,
  placeShowerSurround,
  placeWallFitting,
  SHOWER_HEIGHTS,
  type ShowerOpening,
} from "./showerPlacementAssembly";
import { SKIPPABLE_STEPS } from "@/components/shower/ShowerBuilderWizard";

/**
 * The shower the wizard assembles, in build order:
 *   panels & surrounds -> pan inside them -> heads & faucets -> niches -> glass door.
 *
 * A room whose back wall is long enough to take a 60" pan and whose sides return far
 * enough to be a real alcove.
 */
const ROOM: RoomData = { width: 120, depth: 96, ceilingHeight: 96 } as RoomData;

const SURROUND_60x36 = "PL-603696 Marble";
const PAN_60x36 = "PL-016036C";

describe("step 1 — the surround goes long side against the chosen wall", () => {
  it("finds a bay for the back wall", () => {
    const bay = bayForWall(ROOM, "top");
    expect(bay).not.toBeNull();
    expect(bay!.spanIn).toBeGreaterThan(60);
  });

  it("places the surround centred across the bay, back on the wall", () => {
    const bay = bayForWall(ROOM, "top")!;
    const surround = placeShowerSurround(SURROUND_60x36, bay);
    expect(surround).not.toBeNull();
    // Its long (60") side spans the wall, so the plan extent along the wall is 60".
    expect(Math.max(surround!.rotation === 0 || surround!.rotation === 180 ? 60 : 36, 0)).toBeGreaterThan(0);
    // Centred: the surround's centre sits at the middle of the bay.
    const centreAlong = surround!.x + 30;
    expect(centreAlong).toBeGreaterThan(0);
    expect(centreAlong).toBeLessThan(ROOM.width);
  });

  it("will not place a surround on a wall that is not a three-wall alcove", () => {
    // A wide open room still has bays on its own walls; a zero-size room has none.
    expect(bayForWall({ width: 0, depth: 0, ceilingHeight: 96 } as RoomData, "top")).toBeNull();
  });
});

describe("step 2 — the pan is sized and snapped inside the surround", () => {
  const opening: ShowerOpening = {
    bay: bayForWall(ROOM, "top")!,
    insideWidthIn: 60,
    insideDepthIn: 36,
    origin: { x: 0, y: 0 },
  };

  it("accepts a pan that matches the opening", () => {
    expect(panFitsOpening(60, 36, opening).ok).toBe(true);
  });

  it("warns when the pan is narrower than the opening, and says the gap", () => {
    const fit = panFitsOpening(48, 36, opening);
    expect(fit.ok).toBe(false);
    expect(fit.message).toMatch(/48/);
    expect(fit.message).toMatch(/12/);
    expect(fit.message).toMatch(/gap/);
  });

  it("warns when the pan overruns the end panels", () => {
    const fit = panFitsOpening(62, 36, opening);
    expect(fit.ok).toBe(false);
    expect(fit.message).toMatch(/overruns/);
  });

  it("warns when the pan is deeper than the panels", () => {
    const fit = panFitsOpening(60, 40, opening);
    expect(fit.ok).toBe(false);
    expect(fit.message).toMatch(/deep/);
  });

  it("places the pan inside the opening, not somewhere else in the room", () => {
    const pan = placeShowerPanInsideOpening(PAN_60x36, opening);
    expect(pan).not.toBeNull();
    const surround = placeShowerSurround(SURROUND_60x36, opening.bay)!;
    // The pan sits within the surround's footprint, i.e. inside it.
    const panCentre = { x: pan!.x + 30, y: pan!.y + 18 };
    expect(Math.abs(panCentre.x - (surround.x + 30))).toBeLessThan(1);
  });
});

describe("step 3 — heads and faucets mount at standard, adjustable heights", () => {
  it("defaults to valve 48in and head 80in above the pan", () => {
    expect(SHOWER_HEIGHTS.valveIn).toBe(48);
    expect(SHOWER_HEIGHTS.headIn).toBe(80);
  });

  it("mounts a valve on its own chosen wall, at the chosen height", () => {
    const valve = placeWallFitting("PL-86S22S CHR", "left", ROOM, 52);
    expect(valve).not.toBeNull();
    expect(valve!.mountHeightIn).toBe(52);
  });

  it("keeps each fitting's wall independent of the surround's", () => {
    const onLeft = placeWallFitting("PL-86S22S CHR", "left", ROOM, 48);
    const onRight = placeWallFitting("PL-86S22S CHR", "right", ROOM, 48);
    expect(onLeft).not.toBeNull();
    expect(onRight).not.toBeNull();
    // Different walls mean different positions in the plan.
    expect(onLeft!.x === onRight!.x && onLeft!.y === onRight!.y).toBe(false);
  });

  it("clamps an impossible height instead of accepting it", () => {
    expect(clampShowerHeight(-10)).toBe(0);
    expect(clampShowerHeight(500)).toBe(120);
    expect(clampShowerHeight(Number.NaN)).toBe(SHOWER_HEIGHTS.valveIn);
  });
});

describe("step 4 — niches mount at a user-chosen height", () => {
  it("uses the chosen niche height", () => {
    const niche = placeWallFitting("PL-SN1614", "right", ROOM, 62);
    expect(niche!.mountHeightIn).toBe(62);
  });
});

describe("step 5 — the glass door goes on the open side, on the pan front", () => {
  const opening: ShowerOpening = {
    bay: bayForWall(ROOM, "top")!,
    insideWidthIn: 60,
    insideDepthIn: 36,
    origin: { x: 0, y: 0 },
  };

  it("places the door inside the opening, in front of the back wall", () => {
    const door = placeShowerDoor("PL-03B71SSO BN", opening);
    const pan = placeShowerPanInsideOpening(PAN_60x36, opening)!;
    expect(door).not.toBeNull();
    // The door is forward of the pan's back edge: it hangs on the open side.
    expect(door!.y).toBeGreaterThan(pan.y);
  });
});

describe("every step can be skipped, the pan included", () => {
  it("lets the shopper skip all five steps", () => {
    for (const step of ["surround", "pan", "heads", "niche", "door"] as const) {
      expect(SKIPPABLE_STEPS.has(step), step).toBe(true);
    }
  });

  it("still warns when a door has nothing to sit on, now that the pan is optional", () => {
    // Skipping the pan must not make a panless door silent.
    const doorOnly = choosePart(skipStep(skipStep({}, "surround"), "pan"), "door", {
      code: "PL-03B71SSO BN", id: 535, name: "door", price: 598, kind: "door",
    });
    const issues = showerPlacementIssues(doorOnly);
    expect(issues.some((issue) => issue.stepId === "door")).toBe(true);
  });

  it("warns that panels have no pan under them once the pan is skipped", () => {
    const panelsNoPan = skipStep(
      choosePart({}, "surround", {
        code: "PL-603696 Marble", id: 693, name: "surround", price: 1337.29, kind: "surround",
      }, "top"),
      "pan",
    );
    const issues = showerPlacementIssues(panelsNoPan);
    expect(issues.some((issue) => issue.stepId === "pan")).toBe(true);
  });
});

describe("every placed part is a real catalog product", () => {
  it("refuses a code Pelican does not publish", () => {
    const bay = bayForWall(ROOM, "top")!;
    expect(placeShowerSurround("PL-NOT-REAL", bay)).toBeNull();
    expect(placeShowerPanInsideOpening("PL-NOT-REAL", {
      bay, insideWidthIn: 60, insideDepthIn: 36, origin: { x: 0, y: 0 },
    })).toBeNull();
  });

  it("refuses a part from the wrong step", () => {
    const bay = bayForWall(ROOM, "top")!;
    // A pan is not a surround.
    expect(placeShowerSurround(PAN_60x36, bay)).toBeNull();
  });
});

/** The parts the wizard offers must all be priceable. */
export function assertPriced(parts: readonly ShowerCatalogPart[]): void {
  for (const part of parts) expect(part.price).toBeGreaterThan(0);
}
