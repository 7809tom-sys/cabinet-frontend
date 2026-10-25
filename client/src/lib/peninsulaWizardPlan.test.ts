import { describe, expect, it } from "vitest";
import {
  selectedPeninsulaCabinetSequencePlan,
  selectedPeninsulaCabinetTotalIn,
  wizardEligibleBaseCabinets,
  type PeninsulaWizardCabinet,
} from "./peninsulaWizardPlan";

const B24: PeninsulaWizardCabinet = {
  id: 24,
  masterCode: "B24",
  description: '24" base cabinet',
  category: "Base",
  subCategory: "Base Cabinet",
  width: 24,
  height: 34.5,
  depth: 24,
  placement: "base",
  catalogImageUrl: null,
};

const F342: PeninsulaWizardCabinet = {
  id: 342,
  masterCode: "F342",
  description: '3" filler',
  category: "Filler",
  subCategory: "Filler",
  width: 3,
  height: 42,
  depth: 24,
  placement: "base",
  catalogImageUrl: null,
};

describe("selected Peninsula Wizard cabinet planning", () => {
  it("reports only the selected catalog cabinets in the pre-build total", () => {
    const total = selectedPeninsulaCabinetTotalIn([
      { ...B24, id: 30, masterCode: "B30", width: 30 },
      { ...B24, id: 18, masterCode: "B18", width: 18 },
    ]);
    expect(total).toBe(48);
  });

  it("uses the exact requested cabinet sequence and a real stock filler for a 1½-inch remainder", () => {
    const plan = selectedPeninsulaCabinetSequencePlan(49.5, [B24, B24], [F342]);
    expect(plan.message).toBeNull();
    expect(plan.items.map((item) => [item.cabinet.masterCode, item.width, item.isFiller])).toEqual([
      ["B24", 24, false],
      ["B24", 24, false],
      ["F342", 1.5, true],
    ]);
  });

  it("does not add or substitute a cabinet when the selected sequence leaves a large opening", () => {
    const plan = selectedPeninsulaCabinetSequencePlan(60, [B24, B24], [F342]);
    expect(plan.items).toEqual([]);
    expect(plan.remainderIn).toBe(12);
    expect(plan.message).toContain("selected cabinet sequence");
  });

  it("keeps the user's mixed cabinet order rather than repeating a box to fill the run", () => {
    const plan = selectedPeninsulaCabinetSequencePlan(66, [B24, { ...B24, id: 18, masterCode: "B18", width: 18 }, B24], [F342]);
    expect(plan.message).toBeNull();
    expect(plan.items.map((item) => [item.cabinet.masterCode, item.width, item.isFiller])).toEqual([
      ["B24", 24, false],
      ["B18", 18, false],
      ["B24", 24, false],
    ]);
  });

  it("requires a cabinet sequence for each leg", () => {
    const plan = selectedPeninsulaCabinetSequencePlan(48, [], [F342]);
    expect(plan.items).toEqual([]);
    expect(plan.message).toContain("Choose every cabinet");
  });

  it("only offers actual base-sized cabinet candidates, not fillers or wall cabinets", () => {
    const options = wizardEligibleBaseCabinets([
      B24,
      F342,
      { ...B24, id: 30, masterCode: "W2430", description: '24" wall cabinet', height: 30, depth: 12, category: "Wall", subCategory: "Wall Cabinet" },
      { ...B24, id: 36, masterCode: "V3621", description: '36" vanity sink base', category: "Vanity", subCategory: "Vanity Sink", depth: 21 },
      { ...B24, id: 37, masterCode: "ADA-VA30", description: '30" ADA vanity', category: "ADA", subCategory: "ADA Vanity", depth: 24 },
    ]);
    expect(options.map((item) => item.masterCode)).toEqual(["B24"]);
  });
});
