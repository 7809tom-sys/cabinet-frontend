import { describe, expect, it } from "vitest";
import {
  TWO_LEG_CORNER_DEFAULT_IN,
  cornerOptionsInTypeOrder,
  decideAutoDesignCornerTypeOrder,
} from "./autoDesignCornerDecision";
import { LANDING_MIN_IN } from "./autoDesignFifteenRules";
import { DEFAULT_ROOM, wallPlacementAt, type DesignCabinet, type PlacedCabinet } from "./design";

const TOP_RIGHT = { x: DEFAULT_ROOM.width, y: 0 };

function option(code: string, width: string, extras: Partial<DesignCabinet> = {}): DesignCabinet {
  return {
    id: Math.abs(Array.from(code).reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) + Number(width) * 10,
    masterCode: code,
    description: code,
    placement: "base",
    width,
    height: "34.5",
    depth: "24",
    ...extras,
  } as DesignCabinet;
}

function appliance(code: string, width: number, start: number, wall: "top" | "right" = "top"): PlacedCabinet {
  const spot = wallPlacementAt(start, width, 26, wall, DEFAULT_ROOM);
  return {
    uid: `${code}-${start}`,
    cabinetId: 0,
    masterCode: code,
    description: `${width} inch appliance`,
    category: "Appliance",
    subCategory: "Appliance",
    placement: "appliance",
    ...spot,
    width,
    depth: 26,
    height: 36,
  } as PlacedCabinet;
}

const CATALOG = [option("DCB36", "36"), option("LSB36", "36"), option("BBC36", "36")];

describe("decideAutoDesignCornerTypeOrder", () => {
  it("picks a blind corner when an appliance leaves less than the two-leg width plus the 15 in landing", () => {
    // Range starts at 84 on a 144 in top wall: 30 in remains to the top-right corner.
    const decision = decideAutoDesignCornerTypeOrder({
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [appliance("RANGE-30", 30, 84)],
      options: CATALOG,
    });
    expect(decision.tightness).toBe("tight");
    expect(decision.order[0]).toBe("blind");
    expect(decision.twoLegNeedIn).toBe(36);
    expect(decision.reason).toMatch(/landing|two-leg|only/i);
  });

  it("picks a diagonal (then a lazy Susan) when both legs are open", () => {
    // Appliance far from the corner: 80 in of clear top-run remains (start at 34, width 30 → ends at 64; 144-64=80).
    const decision = decideAutoDesignCornerTypeOrder({
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [appliance("RANGE-30", 30, 34)],
      options: CATALOG,
    });
    expect(decision.tightness).toBe("open");
    expect(decision.order[0]).toBe("diagonal");
    expect(decision.order.slice(0, 3)).toEqual(["diagonal", "lazy-susan", "blind"]);
    expect(decision.twoLegNeedIn).toBe(TWO_LEG_CORNER_DEFAULT_IN);
    expect(LANDING_MIN_IN).toBe(15);
  });

  it("on an open corner, a lazy-Susan preference swaps only the two-leg order", () => {
    const decision = decideAutoDesignCornerTypeOrder({
      room: DEFAULT_ROOM,
      cornerWallIds: ["top", "right"],
      corner: TOP_RIGHT,
      placed: [],
      options: CATALOG,
      preferLazySusan: true,
    });
    expect(decision.tightness).toBe("open");
    expect(decision.order.slice(0, 3)).toEqual(["lazy-susan", "diagonal", "blind"]);
  });

  it("skips a missing family and keeps the rest of the type order", () => {
    const ordered = cornerOptionsInTypeOrder(
      [option("LSB36", "36"), option("BBC36", "36")],
      ["diagonal", "lazy-susan", "blind", "other"],
    );
    expect(ordered.map((row) => row.masterCode)).toEqual(["LSB36", "BBC36"]);
  });
});
