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

import { beforeEach } from "vitest";
import { syncExposedSidePanels, type ExposedPanelStock } from "./exposedSidePanels";
import { wallPlacementAt } from "./design";
import { resetKitchenRuleParameters, setKitchenRuleParameters } from "./kitchenRuleParameters";

describe("end to end: the panels Auto-Design adds beside a hood leave no warning", () => {
  beforeEach(() => { resetKitchenRuleParameters(); setKitchenRuleParameters({ exposed_panels_enabled: 1 }); });
  const stock: ExposedPanelStock[] = [
    { id: 12, masterCode: "WEP1530", description: "Wall end panel", placement: "wall", stockFace: 15.25, stockHeight: 30.25, price: 42 },
    { id: 11, masterCode: "BEP2535", description: "Base end panel", placement: "base", stockFace: 25.625, stockHeight: 35.25, price: 86 },
  ];
  const at = (uid: string, masterCode: string, placement: PlacedCabinet["placement"], offset: number, width: number, depth: number, height: number, extra: Partial<PlacedCabinet> = {}) => {
    const spot = wallPlacementAt(offset, width, depth, "top", DEFAULT_ROOM);
    return { uid, cabinetId: 1, masterCode, description: extra.description ?? masterCode, placement, ...spot, width, depth, height, wallId: spot.wallId ?? "top", wallOffset: spot.wallOffset ?? offset, constructionMethod: "frameless", ...extra } as PlacedCabinet;
  };
  it("W2130 | HOOD-30 over RANGE | W1212 gets panels on both facing sides and conflictingUids stays empty", () => {
    const placed = [
      at("range", "RANGE-30", "appliance", 45, 30, 26, 36, { description: "Range" }),
      at("hood", "HOOD-30", "appliance", 45, 30, 18, 18, { description: '30" Glass Stainless Range Hood', mountBottom: 66 }),
      at("w-left", "W2130", "wall", 24, 21, 12, 30, { mountBottom: 54 }),
      at("w-right", "W1230", "wall", 75, 12, 12, 30, { mountBottom: 54 }),
    ];
    const framelessStyle = { styleCode: "LSA", ourName: "Luxe Classic LSA", color: "LSA", doorStyle: "Slab", finish: "Luxe Classic", boxConstruction: "18mm plywood composite cabinet box; standard altaeuro frameless box", distributorName: "Frameless" };
    const result = syncExposedSidePanels({ placed, room: DEFAULT_ROOM, catalog: stock, qualifiedOnly: true, doorStyleFor: () => framelessStyle });
    const beside = result.placed.filter((item) => item.autoPlacedReason === "wall-beside-range");
    expect(beside.length).toBeGreaterThan(0);
    expect([...conflictingUids(result.placed, DEFAULT_ROOM)]).toEqual([]);
  });
});
