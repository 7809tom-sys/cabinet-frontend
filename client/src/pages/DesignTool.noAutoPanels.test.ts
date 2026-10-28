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

describe("finished panels are only added when the user chooses one", () => {
  it("does not run the automatic exposed-side engine or show its Design check", () => {
    expect(source).not.toContain("syncExposedSidePanels(");
    expect(source).not.toContain('data-testid="design-check-panel"');
    expect(KITCHEN_RULE_PARAMETER_DEFAULTS.exposed_panels_enabled).toBe(0);
  });

  it("removes panels the engine auto-placed in older saves and keeps user-chosen panels", () => {
    const cabinet = piece("b24");
    const userPanel = piece("bep", { masterCode: "BEP24", description: "Base End Panel", width: 0.75 });
    const autoPanel = piece("auto-panel:b24:end", { masterCode: "BEP24", description: "Base End Panel", width: 0.75, autoPlacedReason: "base-open-end", autoPlacedForUid: "b24", autoPlacedSide: "end" } as Partial<PlacedCabinet>);
    expect(removeAutoExposedPanels([cabinet, userPanel, autoPanel]).map((item) => item.uid)).toEqual(["b24", "bep"]);
    const clean = [cabinet, userPanel];
    expect(removeAutoExposedPanels(clean)).toBe(clean);
    expect(source).toContain("const cleaned = removeAutoExposedPanels(placed);");
  });
});
