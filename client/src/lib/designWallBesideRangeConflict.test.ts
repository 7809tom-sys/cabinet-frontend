import { describe, expect, it } from "vitest";
import { conflictingUids, DEFAULT_ROOM, type PlacedCabinet } from "./design";

const item = (over: Partial<PlacedCabinet>) => ({
  uid: "x", cabinetId: 1, masterCode: "X", description: "x", placement: "wall", x: 0, y: 0, width: 30, height: 30, depth: 12, rotation: 0, mountBottom: 54, ...over,
}) as PlacedCabinet;

describe("Auto-Design's wall end panel beside a hood or range is not an appliance conflict", () => {
  const hood = item({ uid: "hood", masterCode: "HOOD-30", description: '30" Glass Stainless Range Hood', placement: "appliance", x: 30, width: 30, depth: 18, height: 18, mountBottom: 66 });
  const panel = (reason: string | null) => item({ uid: "auto-panel:w:end", masterCode: "WEP1530", description: "Wall end panel", x: 29.5, width: 0.75, depth: 12, height: 30, mountBottom: 54, autoPlacedReason: reason, autoPlacedForUid: "w" } as Partial<PlacedCabinet>);

  it("is exempt when Auto-Design placed it as wall-beside-range", () => {
    expect([...conflictingUids([hood, panel("wall-beside-range")], DEFAULT_ROOM)]).toEqual([]);
  });

  it("is still a conflict for a hand-placed panel, or an auto panel of another reason, overlapping the hood", () => {
    expect(conflictingUids([hood, panel(null)], DEFAULT_ROOM).size).toBe(2);
    expect(conflictingUids([hood, panel("open-end-of-run")], DEFAULT_ROOM).size).toBe(2);
  });

  it("a real wall cabinet overlapping the hood is still flagged", () => {
    const cabinet = item({ uid: "w", masterCode: "W3030", x: 15, width: 30, autoPlacedReason: null });
    expect(conflictingUids([hood, cabinet], DEFAULT_ROOM).size).toBe(2);
  });
});
