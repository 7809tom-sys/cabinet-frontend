import { describe, expect, it } from "vitest";
import { relevantCategories, type CrossSellCartLine } from "./crossSell";

function line(partial: Partial<CrossSellCartLine> & Pick<CrossSellCartLine, "masterCode">): CrossSellCartLine {
  return { placement: "base", numberOfDoors: 1, isCornerCabinet: false, ...partial };
}

describe("relevantCategories roll-out trays", () => {
  it("does not recommend roll-out trays when the only bases are corner cabinets", () => {
    const corners: CrossSellCartLine[] = [
      line({ masterCode: "BBC36", isCornerCabinet: false }),
      line({ masterCode: "BLS36" }),
      line({ masterCode: "LSB33" }),
    ];
    expect(relevantCategories(corners)).not.toContain("rollOutTray");
  });

  it("still recommends roll-out trays when a regular door base is in the cart", () => {
    const mixed: CrossSellCartLine[] = [
      line({ masterCode: "BBC36" }),
      line({ masterCode: "B18" }),
    ];
    expect(relevantCategories(mixed)).toContain("rollOutTray");
    expect(relevantCategories([line({ masterCode: "B18" })])).toContain("rollOutTray");
  });
});
