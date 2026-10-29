import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, wallRunOffset, type DesignCabinet, type PlacedCabinet } from "./design";
import { seatAutoDesignCorner } from "./autoDesignCornerSeating";
import { evaluateAutoDesignCornerFit, planCornerBesidePlumbing } from "./cornerFit";

const fillerCatalog = [{
  id: 501,
  masterCode: "BF-3",
  description: '3" Base Filler',
  category: "Accessories & Trim",
  subCategory: "Filler",
  width: 3,
  height: 34.5,
  depth: null,
  catalogImageUrl: null,
}];

function option(id: number, masterCode: string, width: number, cornerType: string) {
  return { id, masterCode, width, description: `${width} inch ${cornerType}`, placement: "base" as const, cornerType };
}

describe("corner fit against plumbing", () => {
  const options = [
    option(36, "LSB36", 36, "lazy-susan"),
    option(33, "LSB33", 33, "lazy-susan"),
    option(1, "BBC36", 36, "blind-corner"),
    option(2, "BBC39", 39, "blind-corner"),
    option(3, "BBC42", 42, "blind-corner"),
    option(4, "BBC45", 45, "blind-corner"),
  ];

  it("rejects LSB36 at 40 inches of plumbing and places the largest BBC with the blind on the other wall", () => {
    const plan = planCornerBesidePlumbing({
      plumbingCenterFromCornerIn: 40,
      sinkWidthIn: 30,
      plumbingLegAvailableIn: 120,
      otherLegAvailableIn: 120,
      options,
    });
    expect(plan.rejected.map((entry) => entry.masterCode)).toEqual(expect.arrayContaining(["LSB36", "LSB33"]));
    expect(plan.rejected.find((entry) => entry.masterCode === "LSB36")?.reason).toMatch(/51/);
    expect(plan.blockedMessage).toBeNull();
    expect(plan.selected).toMatchObject({ masterCode: "BBC45", widthIn: 45 });
    expect(plan.blindLeg).toBe("other");
    expect(plan.sink).toMatchObject({ widthIn: 30 });
    expect(plan.sink!.centerFromCornerIn).toBeCloseTo(42, 5);
    expect(plan.sink!.shiftFromPlumbingIn).toBeLessThanOrEqual(3);
    expect(plan.fallbackNote).toMatch(/BBC45/);
  });

  it("says no corner cabinet fits when even BBC36 misses the plumbing", () => {
    const plan = planCornerBesidePlumbing({
      plumbingCenterFromCornerIn: 20,
      sinkWidthIn: 30,
      plumbingLegAvailableIn: 120,
      otherLegAvailableIn: 120,
      options,
    });
    expect(plan.selected).toBeNull();
    expect(plan.blockedMessage).toMatch(/No corner cabinet fits/);
    expect(plan.rejected.map((entry) => entry.masterCode)).toEqual(expect.arrayContaining(["LSB36", "BBC36"]));
  });

  it("auto-places the blind corner on the other wall and an SB30 over the plumbing", () => {
    const room = DEFAULT_ROOM;
    const spot = wallPlacementAt(25, 30, 24, "top", room);
    const sink = {
      uid: "sink",
      cabinetId: 30,
      masterCode: "SB30",
      description: '30" Sink Base',
      category: "Base",
      subCategory: "Sink Base",
      placement: "base",
      ...spot,
      width: 30,
      depth: 24,
      height: 34.5,
      numberOfDoors: 2,
      numberOfDrawers: 0,
    } as PlacedCabinet;
    const fit = evaluateAutoDesignCornerFit({
      options,
      room,
      placed: [sink],
      corner: { x: 0, y: 0 },
      wallIds: ["top", "left"],
      sink,
    });
    expect(fit.offeredIds).not.toContain(36);
    expect(fit.rejected.map((entry) => entry.masterCode)).toContain("LSB36");
    expect(fit.selectedId).toBe(4);
    expect(fit.placementWallById[4]).toBe("left");
    expect(fit.blockedMessage).toBeNull();

    const source = {
      id: 4,
      masterCode: "BBC45",
      description: "45 inch Blind Corner Base",
      category: "Base",
      subCategory: "Blind Corner",
      placement: "base",
      width: "45",
      height: "34.5",
      depth: "24",
      cornerType: "blind-corner",
      numberOfDoors: 1,
      numberOfDrawers: 0,
      pullMin: 3,
      pullMax: 6,
    } as DesignCabinet;
    const seated = seatAutoDesignCorner({
      source,
      slotLabel: "Corner between Wall 1 and Wall 4",
      target: { x: 0, y: 0, firstWallId: "left" },
      cornerWallIds: ["top", "left"],
      working: [],
      room,
      openings: [],
      blindPullIn: 3,
      blindRunWallId: "left",
      isBlindOption: true,
      catalogFillers: fillerCatalog,
      makeUid: (() => { let n = 0; return () => `c-${++n}`; })(),
      styleId: 1,
    });
    expect(seated.ok, seated.ok ? "" : seated.message).toBe(true);
    if (!seated.ok) return;
    expect(seated.corner.wallId).toBe("left");
    const shift = fit.sinkShiftByOptionId[4];
    expect(shift?.wallId).toBe("top");
    const moved = wallPlacementAt(shift!.start, 30, 24, "top", room);
    const center = wallRunOffset({ ...sink, ...moved, wallOffset: moved.wallOffset }, "top", room) + 15;
    expect(Math.abs(center - 40)).toBeLessThanOrEqual(3);
    expect(center).toBeCloseTo(42, 0);
  });
});
