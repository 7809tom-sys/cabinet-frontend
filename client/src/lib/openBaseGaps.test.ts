import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, type PlacedCabinet, type RoomData } from "./design";
import { findOpenBaseGaps } from "./openBaseGaps";
import { buildPreSavePlanReview } from "./preSavePlanReview";

const room = { ...DEFAULT_ROOM, width: 144, depth: 120 } as RoomData;

function cab(p: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode" | "placement" | "x" | "width">): PlacedCabinet {
  return {
    cabinetId: 1, description: p.masterCode, category: "Base", subCategory: null,
    y: 0, depth: 24, height: 34.5, rotation: 0, ...p,
  } as PlacedCabinet;
}

describe("open base gaps in an edited layout", () => {
  const range = cab({ uid: "r", masterCode: "RANGE-30", placement: "appliance", x: 0, width: 30 });
  const corner = cab({ uid: "c", masterCode: "B36", placement: "base", x: 39.5, width: 36 });

  it("flags empty floor between two cabinets that is wider than a filler", () => {
    const gaps = findOpenBaseGaps(room, [range, corner], []);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].length).toBeCloseTo(9.5, 1);
    expect(gaps[0].beforeCode).toBe("RANGE-30");
    expect(gaps[0].afterCode).toBe("B36");
  });

  it("ignores gaps a filler can close (offered as a filler finding instead)", () => {
    const tight = cab({ ...corner, uid: "t", x: 34.5 });
    expect(findOpenBaseGaps(room, [range, tight], [])).toHaveLength(0);
  });

  it("ignores open wall past the last cabinet", () => {
    expect(findOpenBaseGaps(room, [range], [])).toHaveLength(0);
  });

  it("adds an attention finding to the pre-save review", () => {
    const review = buildPreSavePlanReview({ room, placed: [range, corner], openings: [], island: null, catalogFillers: [], conflictUids: new Set() });
    const finding = review.findings.find((f) => f.id.startsWith("open-gap:"));
    expect(finding?.severity).toBe("attention");
    expect(finding?.title).toContain("9½");
  });
});
