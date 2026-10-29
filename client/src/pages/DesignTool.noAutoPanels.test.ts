import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet } from "@/lib/design";
import { KITCHEN_RULE_PARAMETER_DEFAULTS } from "@/lib/kitchenRuleParameters";
import { removeAutoExposedPanels } from "@/lib/exposedSidePanels";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

function piece(uid: string, extra: Partial<PlacedCabinet> = {}): PlacedCabinet {
  const spot = wallPlacementAt(0, 24, 24, "top", DEFAULT_ROOM);
  return { uid, cabinetId: 1, masterCode: "B24", description: "Base", placement: "base", ...spot, width: 24, depth: 24, height: 34.5, ...extra };
}

describe("automatic panels stay limited to frameless and Hickory", () => {
  it("runs only the narrow frameless and Hickory pass, and leaves the broad engine off", () => {
    expect(source).toContain("qualifiedOnly: true");
    expect(source).toContain("syncExposedSidePanels(");
    expect(KITCHEN_RULE_PARAMETER_DEFAULTS.exposed_panels_enabled).toBe(0);
    expect(source).not.toContain("const cleaned = removeAutoExposedPanels(placed);");
  });

  it("keeps frameless and Hickory auto panels, and still strips every other auto panel", () => {
    const cabinet = piece("b24");
    const userPanel = piece("bep", { masterCode: "BEP24", description: "Base End Panel", width: 0.75 });
    const oldAuto = piece("auto-panel:b24:end", { masterCode: "BEP24", description: "Base End Panel", width: 0.75, autoPlacedReason: "base-open-end", autoPlacedForUid: "b24", autoPlacedSide: "end" } as Partial<PlacedCabinet>);
    const qualified = piece("auto-panel:b24:start", { masterCode: "BEP2535", description: "Base end panel", width: 0.75, autoPlacedReason: "open-end-of-run", autoPlacedForUid: "b24", autoPlacedSide: "start" } as Partial<PlacedCabinet>);
    expect(removeAutoExposedPanels([cabinet, userPanel, oldAuto]).map((item) => item.uid)).toEqual(["b24", "bep"]);
    const clean = [cabinet, userPanel];
    expect(removeAutoExposedPanels(clean)).toBe(clean);

    const hickory = removeAutoExposedPanels([cabinet, userPanel, qualified], () => ({ woodSpecies: "Hickory", ourName: "Hickory skin" }));
    expect(hickory.map((item) => item.uid)).toEqual(["b24", "bep", "auto-panel:b24:start"]);
    const frameless = removeAutoExposedPanels([cabinet, qualified], () => ({ boxConstruction: "altaeuro frameless box" }));
    expect(frameless.map((item) => item.uid)).toEqual(["b24", "auto-panel:b24:start"]);
    const framed = removeAutoExposedPanels([cabinet, userPanel, qualified], () => ({ woodSpecies: "Maple", ourName: "White Shaker", boxConstruction: "plywood face frame" }));
    expect(framed.map((item) => item.uid)).toEqual(["b24", "bep"]);
  });
});
