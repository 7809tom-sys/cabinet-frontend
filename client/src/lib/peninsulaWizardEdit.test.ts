import { describe, expect, it } from "vitest";
import { editablePeninsulaWizard, peninsulaWizardAssemblyRunIds } from "./peninsulaWizardEdit";
import { peninsulaRunEndpoints, type RoomData } from "./design";

const recipe = {
  schemaVersion: 1 as const,
  parentWall: "top" as const,
  startOffset: 48,
  endTurn: 45 as const,
  endDirection: "right" as const,
  cabinetSide: "left" as const,
  applianceCode: "none" as const,
  seatingOverhang: 15 as const,
  waterfall: false,
  addPonyWall: true,
  ponyWallLength: 36,
  ponyWallHeight: 34.5,
  primaryCabinetIds: [30, 18],
  returnCabinetIds: [24],
  countertopTreatment: "split-level" as const,
  showBarStools: true,
};

function roomWithWizard(): RoomData {
  return {
    width: 180,
    depth: 144,
    ceilingHeight: 96,
    peninsulaRuns: [
      {
        id: "peninsula_wizard_recipe",
        parentWall: "top",
        startOffset: 48,
        turn: 90,
        direction: "right",
        length: 57,
        height: 34.5,
        cabinetSide: "left",
        wizardRecipe: recipe,
      },
      {
        id: "peninsula_wizard_recipe_45_end",
        parentRunId: "peninsula_wizard_recipe",
        startOffset: 0,
        turn: 45,
        direction: "right",
        length: 33,
        height: 34.5,
        cabinetSide: "left",
      },
    ],
  } as RoomData;
}

describe("editable Peninsula Wizard ownership", () => {
  it("opens the same exact saved recipe from a 45-degree child run", () => {
    const room = roomWithWizard();
    const { schemaVersion: _schemaVersion, ...draft } = recipe;
    expect(editablePeninsulaWizard(room, "peninsula_wizard_recipe_45_end")).toEqual({
      rootRunId: "peninsula_wizard_recipe",
      draft,
    });
  });

  it("keeps older unowned Wizard layouts non-editable instead of guessing which cabinets to replace", () => {
    const room = roomWithWizard();
    room.peninsulaRuns![0] = { ...room.peninsulaRuns![0], wizardRecipe: undefined };
    expect(editablePeninsulaWizard(room, "peninsula_wizard_recipe")).toBeNull();
  });

  it("keeps optional corbels enabled when reopening a saved Wizard recipe", () => {
    const room = roomWithWizard();
    room.peninsulaRuns![0]!.wizardRecipe = { ...recipe, corbels: true };
    expect(editablePeninsulaWizard(room, "peninsula_wizard_recipe")?.draft.corbels).toBe(true);
  });

  it("keeps legacy recipes without corbels unchanged", () => {
    expect(editablePeninsulaWizard(roomWithWizard(), "peninsula_wizard_recipe")?.draft.corbels).toBeUndefined();
  });

  it("preserves a later shared attachment move when reopening the recipe", () => {
    const room = roomWithWizard();
    room.peninsulaRuns![0] = {
      ...room.peninsulaRuns![0]!,
      parentWall: "right",
      startOffset: 72,
    };
    const editable = editablePeninsulaWizard(room, "peninsula_wizard_recipe");
    expect(editable?.draft).toMatchObject({ parentWall: "right", startOffset: 72 });
    expect(editable?.draft.primaryCabinetIds).toEqual(recipe.primaryCabinetIds);
  });

  it("preserves a measured Continuous Wall Builder parent run in the exact edit recipe", () => {
    const room = roomWithWizard();
    room.peninsulaRuns![0] = {
      ...room.peninsulaRuns![0]!,
      parentWall: "builder-back-run",
      startOffset: 72,
      wizardRecipe: { ...recipe, parentWall: "builder-back-run", startOffset: 72 },
    };
    const editable = editablePeninsulaWizard(room, "peninsula_wizard_recipe");
    expect(editable?.draft).toMatchObject({ parentWall: "builder-back-run", startOffset: 72 });
  });

  it("leaves a measured angled wall through its shared inward frame", () => {
    const room: RoomData = {
      width: 200,
      depth: 300,
      ceilingHeight: 96,
      vertices: [
        { id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 100 },
        { id: "c", x: 200, y: 100 }, { id: "d", x: 200, y: 300 }, { id: "e", x: 0, y: 300 },
      ],
      customWalls: [
        { id: "builder-angle", startVertexId: "a", endVertexId: "b", lockedAngle: 45 },
        { id: "builder-east", startVertexId: "b", endVertexId: "c" },
        { id: "builder-south-east", startVertexId: "c", endVertexId: "d" },
        { id: "builder-south", startVertexId: "d", endVertexId: "e" },
        { id: "builder-west", startVertexId: "e", endVertexId: "a" },
      ],
      peninsulaRuns: [{
        id: "wizard-on-angle", parentWall: "builder-angle", startOffset: Math.SQRT2 * 50,
        turn: 90, direction: "right", length: 24, height: 34.5,
      }],
    };
    const geometry = peninsulaRunEndpoints(room.peninsulaRuns![0]!, room);
    expect(geometry.start).toEqual({ x: 50, y: 50 });
    expect(geometry.radians).toBeCloseTo((3 * Math.PI) / 4, 6);
  });

  it("collects every connected return so a root attachment move carries the full assembly", () => {
    const room = roomWithWizard();
    room.peninsulaRuns!.push({
      id: "peninsula_wizard_recipe_45_end_90",
      parentRunId: "peninsula_wizard_recipe_45_end",
      startOffset: 0,
      turn: 90,
      direction: "left",
      length: 24,
      height: 34.5,
    });
    expect(peninsulaWizardAssemblyRunIds(room, "peninsula_wizard_recipe")).toEqual(new Set([
      "peninsula_wizard_recipe",
      "peninsula_wizard_recipe_45_end",
      "peninsula_wizard_recipe_45_end_90",
    ]));
  });
});
