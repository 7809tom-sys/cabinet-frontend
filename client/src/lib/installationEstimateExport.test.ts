import { describe, expect, it } from "vitest";
import { installationEstimateCsv } from "./installationEstimateExport";

describe("installation estimate exports", () => {
  it("creates a spreadsheet-safe CSV with room, line, markup, and total data", () => {
    const csv = installationEstimateCsv({
      id: 42,
      roomType: "Kitchen",
      customerName: "Smith, Jane",
      customerEmail: "jane@example.com",
      lineItems: [{ description: "Sheet Rock, Mud and Tape", costType: "labor", quantity: 2, unitCost: 125, lineTotal: 250 }],
      subtotal: 250,
      markupPercent: 10,
      markupAmount: 25,
      totalAmount: 275,
      cabinetBreakdown: { base: 4, wall: 3, tall: 2, total: 9 },
    });

    expect(csv).toContain('"Smith, Jane"');
    expect(csv).toContain('"Sheet Rock, Mud and Tape",labor,2,125.00,250.00');
    expect(csv).toContain("Markup percent,,,,10.00");
    expect(csv).toContain("Installation total,,,,275.00");
    expect(csv).toContain("Saved plan cabinets,Base 4,Wall 3,Tall 2,Total 9");
  });
});
