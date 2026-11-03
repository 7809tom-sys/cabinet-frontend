import { describe, expect, it } from "vitest";
import ovenRows from "./__fixtures__/ovenCabinetRows.json";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import type { DesignCabinet } from "./design";
import {
  accessoryReason,
  autoBuilderPath,
  boxCoverageRow,
  boxMissingReason,
  isTallOvenPantryBox,
  summarizeBoxCoverage,
  threeDDesignerCanDraw,
} from "./pelicanBoxCoverage";

const TALL = ovenRows as unknown as DesignCabinet[];
const REAL = realCatalog as unknown as Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;

function row(partial: Partial<DesignCabinet>): DesignCabinet {
  return {
    id: 1, masterCode: "B24", description: '24" Base Cabinet', category: "Base", subCategory: "Standard Base",
    width: "24", height: "34.5", depth: "24", placement: "base", numberOfDoors: 2, numberOfDrawers: 0,
    ...partial,
  } as DesignCabinet;
}

describe("box coverage audit", () => {
  it("marks a real base cabinet available in both the auto builder and the 3D Designer", () => {
    const audited = boxCoverageRow(row({}), "330011");
    expect(audited).toMatchObject({ status: "available", autoBuilder: true, threeDDesigner: true });
    expect(audited.autoBuilderPath).toMatch(/base run/i);
  });

  it("marks the oven pantry available through the tall pop-up", () => {
    const uoc = TALL.find((entry) => entry.masterCode === "UOC3390(O339024)")!;
    const audited = boxCoverageRow(uoc, "330011");
    expect(isTallOvenPantryBox(uoc)).toBe(true);
    expect(audited.status).toBe("available");
    expect(audited.autoBuilderPath).toMatch(/tall pop-up/i);
  });

  it("keeps valances and roll-out trays as accessories, never boxes", () => {
    const valance = boxCoverageRow(row({ masterCode: "VA-48", description: '48" Arched Valance', category: "Accessory", subCategory: "Accessory", width: "48", height: "6", depth: "0.75" }), "330011");
    expect(valance.status).toBe("accessory");
    expect(valance.reason).toMatch(/valance/i);
    const tray = boxCoverageRow(row({ masterCode: "UNIV-ROT24", description: '24" Roll-Out Tray', category: "Accessory", subCategory: "Rollout Tray" }), "330011");
    expect(tray.status).toBe("accessory");
    expect(tray.reason).toMatch(/roll-out/i);
  });

  it("names a box with no complete geometry as missing", () => {
    const audited = boxCoverageRow(row({ masterCode: "B99", width: null }), "330011");
    expect(audited.status).toBe("missing");
    expect(audited.threeDDesigner).toBe(false);
    expect(audited.reason).toMatch(/width, height, and depth/i);
  });

  it("explains a vanity box as outside the kitchen auto build", () => {
    const vanity = row({ masterCode: "VS24", description: '24" Vanity Sink Base', category: "Vanity", subCategory: "Vanity Sink", width: "24", depth: "21" });
    expect(autoBuilderPath(vanity)).toBeNull();
    expect(threeDDesignerCanDraw(vanity)).toBe(true);
    expect(boxMissingReason(vanity)).toMatch(/vanity/i);
  });

  it("gives every accessory row a plain reason", () => {
    const rows = [...(REAL["330011"]!.accessory as DesignCabinet[]), ...(REAL["540005"]!.accessory as DesignCabinet[])];
    for (const entry of rows) expect(accessoryReason(entry).length).toBeGreaterThan(10);
  });

  it("summarizes sorted rows and keeps the three groups separate", () => {
    const summary = summarizeBoxCoverage([
      boxCoverageRow(row({ masterCode: "B24" }), "330011"),
      boxCoverageRow(row({ masterCode: "VA-48", description: '48" Arched Valance', category: "Accessory", subCategory: "Accessory" }), "330011"),
      boxCoverageRow(row({ masterCode: "B99", width: null }), "330011"),
    ]);
    expect(summary.available).toHaveLength(1);
    expect(summary.accessories).toHaveLength(1);
    expect(summary.missing).toHaveLength(1);
    expect(summary.rows).toHaveLength(3);
  });
});
