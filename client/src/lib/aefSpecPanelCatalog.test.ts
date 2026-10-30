import { describe, expect, it } from "vitest";
import { aefSpecPanelCabinet } from "./aefSpecPanelCatalog";
import { catalogItemToExposedPanelStock } from "./exposedSidePanels";

describe("AltaEuro spec end panels", () => {
  it("uses the printed 3/4 inch sheet when the catalog row stored a cabinet depth", () => {
    const panel = aefSpecPanelCabinet({
      id: 9390176,
      masterCode: "wep1542",
      description: "Wall End Panel — 15\" W x 42\" H; thickness TBD",
      category: "Wall",
      subCategory: null,
    });
    expect(panel).toMatchObject({
      id: 9390176,
      masterCode: "WEP1542",
      width: "15.25",
      height: "41.75",
      depth: "0.75",
      placement: "wall",
    });
    const stock = catalogItemToExposedPanelStock(panel!, 110.82);
    expect(stock).toMatchObject({
      id: 9390176,
      masterCode: "WEP1542",
      placement: "wall",
      panelType: "wall-end",
      stockFace: 15.25,
      stockHeight: 41.75,
      price: 110.82,
    });
  });

  it("keeps the base and tall sheets and ignores a code that is not on the spec list", () => {
    expect(aefSpecPanelCabinet({
      id: 15570001,
      masterCode: "BEP2535",
      description: "25-5/8\" W × 35-1/4\" H × 3/4\" D Base End Panel",
    })).toMatchObject({ placement: "base", width: "25.625", depth: "0.75", height: "35.25" });
    expect(aefSpecPanelCabinet({
      id: 15540001,
      masterCode: "TEP3096",
      description: "Tall End Panel for Refrigerator Bridge Cabinet",
    })).toMatchObject({ placement: "tall", height: "96", depth: "0.75" });
    expect(aefSpecPanelCabinet(null)).toBeNull();
    expect(aefSpecPanelCabinet({ id: 1, masterCode: "B24" })).toBeNull();
  });
});
