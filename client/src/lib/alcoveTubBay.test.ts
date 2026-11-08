import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, makeFurniture, type PlacedFurniture } from "./design";
import {
  ALCOVE_BAY_TOLERANCE_IN,
  ALCOVE_MIN_BAY_IN,
  alcoveDrainEnd,
  alcoveRotationForInward,
  alcoveTubFit,
  alcoveTubInBay,
  findAlcoveTubBays,
  isAlcoveTubFurniture,
  seatedAlcoveTubBay,
} from "./alcoveTubBay";
import { placeAlcoveTubInBay, placeBathroomTubSelection } from "./bathroomPlanning";

/**
 * Alcove tubs install in a three-wall alcove: the back and BOTH ends sit against
 * walls and only the front apron is exposed, so the only correct plan position is
 * a bay whose opening matches the tub's length.
 *
 * Every check below is advisory about the tub alone. Nothing here is allowed to
 * move another floor item, and a test asserts that.
 */

const ALCOVE_CODES = [
  "pelican-tub-pl-02849-left",
  "pelican-tub-pl-02849-right",
  "pelican-tub-pl-02850-left",
  "pelican-tub-pl-02850-right",
  "pelican-tub-pl-02851-left",
  "pelican-tub-pl-02851-right",
];

/** A bathroom whose back wall is a 60" alcove 36" deep — the PL-02851's own bay. */
const ALCOVE_ROOM = { width: 60, depth: 36 } as const;

function tub(id: string, x = 0, y = 0): PlacedFurniture {
  return makeFurniture(id, x, y);
}

function definitionOf(item: PlacedFurniture) {
  return FURNITURE_CATALOG.find((entry) => entry.id === item.defId)!;
}

describe("Alcove tubs are three-wall fixtures", () => {
  it("classifies exactly the six alcove SKUs and no freestanding tub", () => {
    for (const id of ALCOVE_CODES) expect(isAlcoveTubFurniture(tub(id)), id).toBe(true);
    expect(isAlcoveTubFurniture(tub("pelican-tub-pl-02146-59"))).toBe(false);
    expect(isAlcoveTubFurniture(tub("pelican-tub-pl-02563-59"))).toBe(false);
    expect(isAlcoveTubFurniture(tub("pelican-toilet-pl-12005"))).toBe(false);
  });

  it("finds a bay only where a wall is closed at both ends AND long enough", () => {
    // In a 60 x 36 room only the two 60" walls can hold an alcove tub. The 36"
    // ends are closed at both ends too, but no alcove tub Pelican sells is that
    // short, so seating a 60" tub across the room's depth would be wrong.
    const bays = findAlcoveTubBays({ width: 60, depth: 36 });
    expect(bays.map((bay) => bay.id).sort()).toEqual(["bottom", "top"]);
    expect(bays.every((bay) => bay.spanIn >= ALCOVE_MIN_BAY_IN)).toBe(true);
  });

  it("rejects a closed wall that is shorter than the shortest alcove tub", () => {
    // 48" between the returns: closed at both ends, but too short for a 60" tub.
    const shortBay = { width: 48, depth: 36 };
    expect(findAlcoveTubBays(shortBay).map((bay) => bay.id)).not.toContain("top");
  });

  it("refuses a run that is open at one end, so it is not a bay", () => {
    // An open wall path is a free-standing run, not a closed room.
    const openRoom = {
      width: 120,
      depth: 96,
      vertices: [
        { id: "v0", x: 0, y: 0 },
        { id: "v1", x: 120, y: 0 },
        { id: "v2", x: 120, y: 96 },
      ],
      customWalls: [
        { id: "w0", startVertexId: "v0", endVertexId: "v1" },
        { id: "w1", startVertexId: "v1", endVertexId: "v2" },
      ],
      openWallPath: true,
    };
    // w1 ends at v2, which no other wall meets, so it cannot be a bay.
    const bays = findAlcoveTubBays(openRoom);
    expect(bays.map((bay) => bay.id)).not.toContain("w1");
  });

  it.each(ALCOVE_CODES)("%s seats flat on the back wall with its apron facing in", (id) => {
    const item = tub(id);
    const definition = definitionOf(item);
    const bays = findAlcoveTubBays(ALCOVE_ROOM);
    const bay = bays.find((entry) => entry.id === "top")!;
    const seated = alcoveTubInBay(item, bay);

    expect(seated.rotation).toBe(bay.rotation);
    // Back flush on the wall: the box starts at the wall it sits on.
    expect(seated.y).toBeCloseTo(0, 3);
    // Centred across the 60" opening, with the tub's length spanning it.
    expect(seated.x).toBeCloseTo((60 - definition.d) / 2, 3);

    const fit = alcoveTubFit(seated, ALCOVE_ROOM);
    expect(fit.warnings).toEqual([]);
    expect(fit.lengthMatches).toBe(true);
    expect(fit.endsMeetWalls).toBe(true);
    expect(fit.depthFits).toBe(true);
  });

  it("warns when the alcove is not the tub's length", () => {
    // 66" between the end walls, a 60" tub: a 6" gap.
    const wideRoom = { width: 66, depth: 36 };
    const seated = alcoveTubInBay(tub("pelican-tub-pl-02851-left"), findAlcoveTubBays(wideRoom).find((bay) => bay.id === "top")!);
    const fit = alcoveTubFit(seated, wideRoom);
    expect(fit.lengthMatches).toBe(false);
    expect(fit.warnings.join(" ")).toMatch(/66.*60|gap/i);
    // It is still measured as placed — the geometry is never silently resized.
    expect(definitionOf(seated).d).toBeCloseTo(60, 3);
  });

  it("warns when the tub has been dropped outside the room", () => {
    // A tub hanging through a wall is not installed in an alcove at all.
    const outside = { ...tub("pelican-tub-pl-02851-left"), rotation: 270 as const, x: -20, y: 0 };
    const fit = alcoveTubFit(outside, ALCOVE_ROOM);
    expect(fit.warnings.join(" ")).toMatch(/past a room wall/i);
  });

  it("warns when the tub is not tight between the end walls", () => {
    // Right length for the bay, but slid 8" off centre so one end is short.
    const seated = alcoveTubInBay(tub("pelican-tub-pl-02851-left"), findAlcoveTubBays(ALCOVE_ROOM).find((bay) => bay.id === "top")!);
    const slid = { ...seated, x: seated.x + 8 };
    const fit = alcoveTubFit(slid, ALCOVE_ROOM);
    expect(fit.endsMeetWalls).toBe(false);
    expect(fit.warnings.join(" ")).toMatch(/not tight|not seated/i);
  });

  it("warns when the tub's depth will not fit in front of the wall", () => {
    // A 60 x 30 alcove cannot take a 36"-deep tub.
    const shallow = { width: 60, depth: 30 };
    const seated = alcoveTubInBay(tub("pelican-tub-pl-02851-left"), findAlcoveTubBays(shallow).find((bay) => bay.id === "top")!);
    const fit = alcoveTubFit(seated, shallow);
    expect(fit.depthFits).toBe(false);
    expect(fit.warnings.join(" ")).toMatch(/deep/i);
  });

  it("warns, without moving anything, when another item overlaps the tub", () => {
    const seated = alcoveTubInBay(tub("pelican-tub-pl-02851-left"), findAlcoveTubBays(ALCOVE_ROOM).find((bay) => bay.id === "top")!);
    const intruder = makeFurniture("pelican-toilet-pl-12005", 24, 6);
    const fit = alcoveTubFit(seated, ALCOVE_ROOM, { furniture: [seated, intruder] });
    expect(fit.warnings.join(" ")).toMatch(/overlaps/i);
    // The intruder is untouched: no function here returns or edits other items.
    expect(intruder.x).toBe(24);
    expect(intruder.y).toBe(6);
  });

  it("warns when the tub is floating away from every wall", () => {
    const floating = { ...tub("pelican-tub-pl-02851-left", 0, 0), rotation: 270 as const };
    const fit = alcoveTubFit({ ...floating, x: -20, y: -40 }, ALCOVE_ROOM);
    expect(fit.warnings.length).toBeGreaterThan(0);
    expect(fit.warnings.join(" ")).toMatch(/not seated against a wall/i);
  });

  it.each(ALCOVE_CODES)("%s lands in a bay when it is placed", (id) => {
    const result = placeBathroomTubSelection([], tub(id), ALCOVE_ROOM);
    expect(result).not.toBeNull();
    const placed = result!.furniture[0]!;
    const fit = alcoveTubFit(placed, ALCOVE_ROOM);
    expect(fit.applies).toBe(true);
    expect(fit.bay).not.toBeNull();
    expect(fit.warnings).toEqual([]);
    // Rotation puts the apron into the room, and it is one of the four turns.
    expect([0, 90, 180, 270]).toContain(placed.rotation);
  });

  it("keeps every other item exactly where it was when a tub is placed", () => {
    const toilet = makeFurniture("pelican-toilet-pl-12005", 4, 4);
    const result = placeBathroomTubSelection([toilet], tub("pelican-tub-pl-02851-left"), ALCOVE_ROOM);
    expect(result).not.toBeNull();
    const survivor = result!.furniture.find((entry) => entry.uid === toilet.uid)!;
    expect(survivor.x).toBe(toilet.x);
    expect(survivor.y).toBe(toilet.y);
    expect(survivor.rotation).toBe(toilet.rotation);
  });

  it("replaces the tub already in the room instead of adding a second one", () => {
    const existing = tub("pelican-tub-pl-02849-left");
    const first = placeBathroomTubSelection([], existing, ALCOVE_ROOM);
    const replacement = tub("pelican-tub-pl-02851-right");
    const second = placeBathroomTubSelection(first!.furniture, replacement, ALCOVE_ROOM);
    expect(second!.replaced).toBe(true);
    const tubs = second!.furniture.filter((entry) => isAlcoveTubFurniture(entry));
    expect(tubs).toHaveLength(1);
    expect(tubs[0]!.defId).toBe(replacement.defId);
  });

  it("still places the tub when the room has no bay, and says so", () => {
    // A single 60" wall with nothing at either end is not an alcove.
    const noBayRoom = {
      width: 140,
      depth: 100,
      vertices: [
        { id: "v0", x: 0, y: 0 },
        { id: "v1", x: 140, y: 0 },
      ] as Array<{ id: string; x: number; y: number }>,
      customWalls: [{ id: "only", startVertexId: "v0", endVertexId: "v1" }],
      openWallPath: true,
    };
    expect(findAlcoveTubBays(noBayRoom)).toHaveLength(0);
    // No bay means no bay placement, so the caller falls back to free placement.
    expect(placeAlcoveTubInBay(tub("pelican-tub-pl-02851-left"), [], noBayRoom)).toBeNull();
    // And the fit check explains why rather than silently accepting it.
    const fit = alcoveTubFit(tub("pelican-tub-pl-02851-left"), noBayRoom);
    expect(fit.bay).toBeNull();
    expect(fit.warnings.join(" ")).toMatch(/three walls/i);
  });

  it("prefers a bay that matches the tub over a nearer one that does not", () => {
    // 30" deep, 60" wide: only the 60" walls can take the tub, and both are the
    // same distance from the centre, so the fit has to decide.
    const bays = findAlcoveTubBays({ width: 60, depth: 30 });
    const candidates = bays.map((bay) => ({ bay, span: bay.spanIn }));
    expect(candidates.filter((entry) => Math.abs(entry.span - 60) <= ALCOVE_BAY_TOLERANCE_IN)).toHaveLength(2);
    const seated = placeAlcoveTubInBay(tub("pelican-tub-pl-02851-left"), [], { width: 60, depth: 30 });
    expect(seated).not.toBeNull();
    expect(seated!.fit.lengthMatches).toBe(true);
  });

  it("reports which end the drain faces, and mirrors it for the other drain hand", () => {
    const bay = findAlcoveTubBays(ALCOVE_ROOM).find((entry) => entry.id === "top")!;
    const leftDrain = alcoveDrainEnd(alcoveTubInBay(tub("pelican-tub-pl-02851-left"), bay), bay);
    const rightDrain = alcoveDrainEnd(alcoveTubInBay(tub("pelican-tub-pl-02851-right"), bay), bay);
    // Both L and R models have a drain; they must point opposite ways.
    expect(leftDrain).not.toBe("center");
    expect(rightDrain).not.toBe("center");
    expect(leftDrain).not.toBe(rightDrain);
  });

  it.each([
    [{ x: 0, y: 1 }, 270],
    [{ x: 0, y: -1 }, 90],
    [{ x: -1, y: 0 }, 0],
    [{ x: 1, y: 0 }, 180],
  ] as const)("maps an inward-facing wall to %o as quarter turn %i", (inward, rotation) => {
    expect(alcoveRotationForInward(inward)).toBe(rotation);
  });

  it("resolves the bay a tub is actually seated in, not merely the nearest centre", () => {
    // Seated against the 60" top wall of a 60 x 36 room, a 36"-deep tub's centre
    // is 18" from that wall and 18" from its opposite, so centre-distance alone
    // would be ambiguous. The seated-bay resolver must still find "top".
    const bays = findAlcoveTubBays(ALCOVE_ROOM);
    const top = bays.find((bay) => bay.id === "top")!;
    const seated = alcoveTubInBay(tub("pelican-tub-pl-02851-left"), top);
    const resolved = seatedAlcoveTubBay(bays, seated, definitionOf(seated));
    expect(resolved?.id).toBe("top");
  });

  it.each(ALCOVE_CODES)("%s exposes only its apron across the full opening", (id) => {
    // Tom's installed-view references: the apron spans wall to wall, sits flush
    // with both end walls, and no tub end is left exposed.
    const item = tub(id);
    const definition = definitionOf(item);
    const seated = placeBathroomTubSelection([], item, ALCOVE_ROOM)!.furniture[0]!;
    const bays = findAlcoveTubBays(ALCOVE_ROOM);
    const bay = bays.find((entry) => entry.id === "top")!;
    // Reconstruct the world footprint the way the 3D scene builds it: the plan
    // rotation is applied to the placed record.
    const quarterTurn = ((seated.rotation % 360) + 360) % 360;
    const footprint = quarterTurn === 90 || quarterTurn === 270
      ? { w: definition.d, d: definition.w }
      : { w: definition.w, d: definition.d };
    // The apron, not the tub's short width, is what spans the bay.
    expect(footprint.w, `${id} apron does not span the opening`).toBeCloseTo(bay.spanIn, 2);
    // And the two end walls are flush, so neither end is exposed.
    expect(seated.x - bay.start.x).toBeCloseTo(0, 2);
    expect((bay.start.x + bay.spanIn) - (seated.x + footprint.w)).toBeCloseTo(0, 2);
    // The back edge is on the back wall and the apron faces into the room.
    expect(seated.y - bay.start.y).toBeCloseTo(0, 2);
    expect(seated.y + footprint.d).toBeCloseTo(bay.start.y + definition.w, 1);
  });

  it("centres a tub that is slightly short for its bay instead of jamming a return", () => {
    // A 64" opening takes the 60" tub with 2" of slack each side. Centring keeps
    // both ends an equal 2" off, so neither return looks wrong, and the warning
    // is about the gap rather than about one end being tight.
    const wideBay = { width: 64, depth: 36 };
    const seated = alcoveTubInBay(tub("pelican-tub-pl-02851-left"), findAlcoveTubBays(wideBay).find((bay) => bay.id === "top")!);
    const definition = definitionOf(seated);
    expect(seated.x).toBeCloseTo((64 - definition.d) / 2, 2);
    const fit = alcoveTubFit(seated, wideBay);
    // 4" of slack over a 2" tolerance, so the length warning fires and names the
    // gap rather than blaming one end.
    expect(fit.lengthMatches).toBe(false);
    expect(fit.warnings.join(" ")).toMatch(/gap/i);
    // Symmetric, so neither end is singled out as the problem.
    expect(fit.warnings.join(" ")).not.toMatch(/not tight/i);
  });

  it("does not apply its bay rules to a freestanding tub", () => {
    const freestanding = tub("pelican-tub-pl-02563-59");
    const fit = alcoveTubFit(freestanding, ALCOVE_ROOM);
    expect(fit.applies).toBe(false);
    expect(fit.warnings).toEqual([]);
    expect(placeAlcoveTubInBay(freestanding, [], ALCOVE_ROOM)).toBeNull();
  });
});
