import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("InstallationEstimatesPanel room and cost controls", () => {
  it("keeps the four room types and the Kitchen-first cost workflow visible", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/affiliate/InstallationEstimatesPanel.tsx"), "utf8");

    expect(source).toContain('id="installation-room-type"');
    expect(source).toContain("INSTALLATION_ROOM_TYPES.map");
    expect(source).toContain('setRoomType(event.target.value as InstallationRoomType)');
    expect(source).toContain("Kitchen Cost Sheet Cabinets");
    expect(source).toContain("KITCHEN_COST_SHEET_DESCRIPTIONS.map");
    expect(source).toContain("materialQuantity");
    expect(source).toContain("laborQuantity");
    expect(source).toContain('<KitchenCostSheet rows={kitchenRows} onChange={updateKitchenRow} />');
    expect(source).not.toContain("min-w-[760px]");
    expect(source).toContain('"Mark Up"');
    expect(source).toContain('id="installation-markup"');
    expect(source).toContain('value={line.costType}');
    expect(source).toContain('value="material"');
    expect(source).toContain("kitchenCostDefaults.useQuery");
    expect(source).toContain("saveKitchenCostDefaults.useMutation");
    expect(source).toContain("Save rates as defaults");
    expect(source).toContain("downloadInstallationEstimateCsv");
    expect(source).toContain("downloadInstallationEstimatePdf");
    expect(source).toContain("kitchenPlans.useQuery");
    expect(source).toContain('id="installation-kitchen-plan"');
    expect(source).toContain("cabinetBreakdown.base");
    expect(source).toContain("kitchenDesignId: roomType === \"Kitchen\"");
  });
});
