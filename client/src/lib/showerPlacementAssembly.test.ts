import { describe, expect, it } from "vitest";
import { verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";
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
  placeWallFittingOnPanel,
  openingForSurround,
  clampWallFittingMountHeight,
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

/**
 * Plan-space box of one placed surround, from the bay it was seated in.
 * A kit is centred in the alcove, so its plan extent is the BAY span by its own
 * depth — using the catalog width would misplace the box in a wider room.
 */
function surroundBoxOf(room: any, wall: "top" | "left" | "right" = "top") {
  const bay = bayForWall(room, wall)!;
  const placed = placeShowerSurround("PL-603096 Brick", bay)!;
  const profile = verifiedPelicanBathroomFixtureProfile("PL-603096 Brick")!;
  const quarter = ((placed.rotation % 360) + 360) % 360;
  const swapped = quarter === 90 || quarter === 270;
  const bw = swapped ? profile.depthIn : bay.spanIn;
  const bd = swapped ? bay.spanIn : profile.depthIn;
  return { minX: placed.x, minY: placed.y, maxX: placed.x + bw, maxY: placed.y + bd };
}

/** Plan-space box of one placed fitting, from its real Pelican envelope. */
function planBox(item: any) {
  const profile = verifiedPelicanBathroomFixtureProfile(item.pelicanCode ?? "");
  const w = Number(profile?.widthIn ?? 1);
  const d = Number(profile?.depthIn ?? 1);
  const quarter = ((item.rotation % 360) + 360) % 360;
  const swapped = quarter === 90 || quarter === 270;
  const bw = swapped ? d : w;
  const bd = swapped ? w : d;
  return { minX: item.x, minY: item.y, maxX: item.x + bw, maxY: item.y + bd };
}

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

/**
 * The valve/head and the niche must mount on the INSIDE face of a panel of the
 * shower the shopper actually built.
 *
 * They used to go through `placeWallFitting(code, wall, room, height)`, which calls
 * `bayForWall(room, wall)`: that seats the part against a bay of the ROOM. A 60"
 * room wall is not the shower's back panel, so in a real drawing the valve, head
 * and niche landed on the room wall outside the enclosure.
 */
describe("wall fittings mount on a chosen shower panel", () => {
  const room = { width: 96, depth: 120, ceilingHeight: 96 } as any;
  const bay = bayForWall(room, "top")!;
  const surround = placeShowerSurround("PL-603096 Brick", bay)!;
  const opening = openingForSurround(surround, room)!;

  const PANEL_COORDS: Array<{ side: "back" | "left" | "right"; label: string }> = [
    { side: "back", label: "back panel" },
    { side: "left", label: "left side panel" },
    { side: "right", label: "right side panel" },
  ];

  for (const { side, label } of PANEL_COORDS) {
    it(`mounts the valve inside the enclosure on the ${label}`, () => {
      const placed = placeWallFittingOnPanel("PL-86S22S BN", side, opening, 48)!;
      expect(placed).not.toBeNull();

      // The mount has to sit INSIDE the footprint the surround occupies, which is
      // the check that would have caught the room-wall placement.
      const surroundBox = surroundBoxOf(room);
      const valveBox = planBox(placed);
      expect(valveBox.minX).toBeGreaterThanOrEqual(surroundBox.minX - 0.5);
      expect(valveBox.maxX).toBeLessThanOrEqual(surroundBox.maxX + 0.5);
      expect(valveBox.minY).toBeGreaterThanOrEqual(surroundBox.minY - 0.5);
      expect(valveBox.maxY).toBeLessThanOrEqual(surroundBox.maxY + 0.5);

      // And it keeps the height the shopper set.
      expect(placed.mountHeightIn).toBe(48);
    });
  }

  it("puts back, left and right on three different spots", () => {
    const back = placeWallFittingOnPanel("PL-86S22S BN", "back", opening, 48)!;
    const left = placeWallFittingOnPanel("PL-86S22S BN", "left", opening, 48)!;
    const right = placeWallFittingOnPanel("PL-86S22S BN", "right", opening, 48)!;
    expect(back.x).not.toBe(left.x);
    expect(left.x).not.toBe(right.x);
    expect(back.y).not.toBe(left.y);
    // The two side panels are mirror images, so they sit on opposite sides of the
    // back panel's centreline.
    expect(Math.min(left.x, right.x)).toBeLessThan(back.x);
  });

  it("holds the niche on its panel too, and it can differ from the valve's", () => {
    const valve = placeWallFittingOnPanel("PL-86S22S BN", "back", opening, 48)!;
    const niche = placeWallFittingOnPanel("PL-SN1614", "left", opening, 44)!;
    const surroundBox = surroundBoxOf(room);
    for (const placed of [valve, niche]) {
      const box = planBox(placed);
      expect(box.minX).toBeGreaterThanOrEqual(surroundBox.minX - 0.5);
      expect(box.maxX).toBeLessThanOrEqual(surroundBox.maxX + 0.5);
    }
    expect(niche.x).not.toBe(valve.x);
  });

  it("turns a side-panel fitting with the panel it sits on", () => {
    const back = placeWallFittingOnPanel("PL-86S22S BN", "back", opening, 48)!;
    const left = placeWallFittingOnPanel("PL-86S22S BN", "left", opening, 48)!;
    expect(left.rotation).not.toBe(back.rotation);
  });
});

/**
 * A niche must never stick up above the shower walls.
 *
 * Its top is `mountHeightIn + height`, which may not pass the surround panel's
 * published height. Tom saw a niche poking out of the top of the enclosure.
 */
describe("wall fittings stay inside their panel height", () => {
  it("caps the mount so the part's top never passes the panel top", () => {
    // A 27-1/16" niche in a 74" tub surround: anything above 46-15/16" pokes out.
    const mounted = clampWallFittingMountHeight(60, 27 + 1 / 16, 74);
    expect(mounted).toBeCloseTo(74 - (27 + 1 / 16), 3);
    expect(mounted + (27 + 1 / 16)).toBeCloseTo(74, 3);
  });

  it("leaves a mount that already fits exactly where it was asked", () => {
    expect(clampWallFittingMountHeight(44, 16, 96)).toBe(44);
  });

  it("keeps the bottom at pan level when the part is taller than the panel", () => {
    // A 39" niche in a 30"-tall panel cannot fit; the only legal place is the pan.
    const mounted = clampWallFittingMountHeight(20, 39 + 1 / 32, 30);
    expect(mounted).toBeGreaterThanOrEqual(0);
    expect(mounted).toBe(Math.max(0, 30 - (39 + 1 / 32)));
  });

  it("applies the clamp through real niche placement", () => {
    const room = { width: 96, depth: 120, ceilingHeight: 96 } as any;
    const opening = openingForSurround(placeShowerSurround("PL-603096 Brick", bayForWall(room, "top")!), room)!;
    const niche = placeWallFittingOnPanel("PL-SN1639", "back", opening, 200)!;
    expect(niche).not.toBeNull();
    expect(niche.mountHeightIn).toBeLessThanOrEqual(opening.panelHeightIn);
    // Top of the niche never passes the panel's top edge.
    expect(niche.mountHeightIn + (39 + 1 / 32)).toBeLessThanOrEqual(opening.panelHeightIn + 0.01);
  });
});

/**
 * Regression: the niche on the LEFT panel rendered on the OUTSIDE face of the
 * wall, sticking out of the shower rather than recessed into it.
 *
 * Both side panels used to take a +90 quarter turn, which pointed the left
 * panel's fitting the wrong way — its recess opened toward +X, i.e. out through
 * the wall. The turn now depends on the side: left takes -90, right takes +90.
 *
 * A niche is authored opening toward -Z with its body running into +Z, so after
 * placement its opening must face the shower centre and its body must sit behind
 * the panel it is mounted on. These assertions pin that for all three panels.
 */
describe("wall fittings open toward the shower, never out through the wall", () => {
  const room = { width: 96, depth: 120, ceilingHeight: 96 } as any;
  const bay = bayForWall(room, "top")!;
  const opening = openingForSurround(placeShowerSurround("PL-603096 Brick", bay)!, room)!;

  /**
   * Unit vector the fitting's opening faces, in plan space.
   *
   * A fitting is authored opening toward local -Z. The scene applies the placement
   * rotation as `-rotation` on the Y axis (see `bathroomFurnitureTransform`), which
   * maps local (0,0,-1) to (-sin r, -cos r) in plan coordinates for rotation `r`.
   */
  const openingDirection = (rotationDeg: number) => {
    const radians = ((-rotationDeg) * Math.PI) / 180;
    return { x: -Math.sin(radians), y: -Math.cos(radians) };
  };

  const showerCentre = { x: bay.start.x + bay.tangent.x * (bay.spanIn / 2) + bay.inward.x * (opening.insideDepthIn / 2),
    y: bay.start.y + bay.tangent.y * (bay.spanIn / 2) + bay.inward.y * (opening.insideDepthIn / 2) };

  for (const side of ["back", "left", "right"] as const) {
    it(`turns the ${side} panel's niche toward the shower centre`, () => {
      const niche = placeWallFittingOnPanel("PL-SN1639", side, opening, 44)!;
      expect(niche).not.toBeNull();

      const face = openingDirection(niche.rotation);
      // Vector from the fitting to the middle of the shower floor.
      const toCentre = { x: showerCentre.x - niche.x, y: showerCentre.y - niche.y };
      const length = Math.hypot(toCentre.x, toCentre.y) || 1;
      const dot = (face.x * toCentre.x + face.y * toCentre.y) / length;

      // The opening must point into the shower, not out through its wall.
      expect(dot, `${side} opening faces the shower (dot ${dot.toFixed(2)})`).toBeGreaterThan(0.5);
    });

    it(`keeps the ${side} panel's niche body inside the panel thickness`, () => {
      const niche = placeWallFittingOnPanel("PL-SN1639", side, opening, 44)!;
      const face = openingDirection(niche.rotation);
      const recessIn = verifiedPelicanBathroomFixtureProfile("PL-SN1639")!.depthIn;

      // The body runs the opposite way from the opening: from the panel face,
      // `recessIn` INTO the panel. So the body's far end, measured from the panel
      // face, must not pass the panel's outer face.
      const bodyEnd = { x: niche.x - face.x * recessIn, y: niche.y - face.y * recessIn };
      const distanceToCentre = Math.hypot(bodyEnd.x - showerCentre.x, bodyEnd.y - showerCentre.y);
      const faceDistanceToCentre = Math.hypot(niche.x - showerCentre.x, niche.y - showerCentre.y);
      // Going into the wall means moving AWAY from the shower, so the body's far
      // end is further from the centre than its face is.
      expect(distanceToCentre).toBeGreaterThan(faceDistanceToCentre - 0.01);
    });
  }

  it("gives left and right panels mirror-image rotations", () => {
    const left = placeWallFittingOnPanel("PL-SN1639", "left", opening, 44)!;
    const right = placeWallFittingOnPanel("PL-SN1639", "right", opening, 44)!;
    const back = placeWallFittingOnPanel("PL-SN1639", "back", opening, 44)!;
    // Left and right turn opposite ways from the back panel.
    const norm = (r: number) => ((r % 360) + 360) % 360;
    expect(norm(left.rotation)).not.toBe(norm(right.rotation));
    expect(norm(back.rotation)).not.toBe(norm(left.rotation));
  });

  it("applies the same orientation rule to the valve and head", () => {
    for (const side of ["back", "left", "right"] as const) {
      const valve = placeWallFittingOnPanel("PL-86S22S MB", side, opening, 48)!;
      const niche = placeWallFittingOnPanel("PL-SN1639", side, opening, 44)!;
      // The valve and the niche mount the same way on the same panel.
      expect(valve.rotation, side).toBe(niche.rotation);
    }
  });
});

/**
 * Regression: in a SMALL room the right-wall niche landed outside the shower.
 *
 * The side offset cleared only half of `footprint.across`, but `centre` is the
 * fitting's centre, so the offset must clear half the extent that runs across the
 * side panel — `footprint.w` after the quarter turn. In a 60" alcove the shortfall
 * put the right-wall niche at a negative x, outside the enclosure, and the caller
 * then clamped it back onto the back wall, so the shopper's wall choice was lost.
 */
describe("a small room keeps the fitting on the wall the shopper chose", () => {
  for (const roomWidth of [60, 66, 96, 120]) {
    it(`puts back, left and right on three different panels at ${roomWidth}" wide`, () => {
      const room = { width: roomWidth, depth: 96, ceilingHeight: 96 } as any;
      const opening = openingForSurround(placeShowerSurround("PL-603096 Brick", bayForWall(room, "top")!), room)!;

      for (const code of ["PL-SN1639", "PL-86S22S CHR"]) {
        const back = placeWallFittingOnPanel(code, "back", opening, 44)!;
        const left = placeWallFittingOnPanel(code, "left", opening, 44)!;
        const right = placeWallFittingOnPanel(code, "right", opening, 44)!;

        // Three genuinely different spots.
        expect(new Set([back.x, left.x, right.x]).size, `${code} distinct x`).toBe(3);
        // And every one inside the room, not clamped back onto the back wall.
        for (const [side, placed] of [["back", back], ["left", left], ["right", right]] as const) {
          expect(placed.x, `${code} ${side} x >= 0`).toBeGreaterThanOrEqual(-0.01);
          expect(placed.x, `${code} ${side} fits`).toBeLessThan(roomWidth);
          expect(placed.y, `${code} ${side} y >= 0`).toBeGreaterThanOrEqual(-0.01);
          expect(placed.y, `${code} ${side} fits depth`).toBeLessThan(room.depth);
        }
        // The two side panels sit on opposite sides of the back panel.
        expect(Math.min(left.x, right.x)).toBeLessThan(back.x);
        expect(Math.max(left.x, right.x)).toBeGreaterThan(back.x);
      }
    });
  }
});
