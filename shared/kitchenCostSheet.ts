export const KITCHEN_COST_SHEET_DESCRIPTIONS = [
  "Demo", "Dump Fee", "Framing", "Insulation", "Sheet Rock, Mud and Tape", "Spray Texture",
  "Cabinet Assembly", "Cabinet Installation", "Pantry Cabinet", "Fridge Panel", "Dishwasher Panel",
  "Deco Doors", "Light Rail", "Roll Outs", "Lazy Susan Insert", "Trash Can Pull Out", "Handles",
  "Knobs", "Fillers", "Crown Molding", "Toe kick", "1/4 Round", "Modify Cabinet", "Polly Wall",
  "Floor Protection", "Counter top", "Plumbing", "Electrical", "Paint", "Glass",
] as const;

export type KitchenCostSheetDescription = (typeof KITCHEN_COST_SHEET_DESCRIPTIONS)[number];

export type KitchenCostDefault = {
  description: KitchenCostSheetDescription;
  materialUnitCost: number;
  laborUnitCost: number;
};

export function createBlankKitchenCostDefaults(): KitchenCostDefault[] {
  return KITCHEN_COST_SHEET_DESCRIPTIONS.map((description) => ({
    description,
    materialUnitCost: 0,
    laborUnitCost: 0,
  }));
}
