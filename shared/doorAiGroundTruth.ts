/**
 * The GROUND TRUTH block for every AI prompt that describes or draws a door.
 *
 * This is the frontend's source of truth for it: the blueprint facts come straight
 * from `shakerDoorBlueprint.ts` (DL_SHAKER_FIRM_RULE, STANDARD_SHAKER_RAIL_IN,
 * shakerDoorFamily, effectiveShakerRailIn, isHickoryDoor) rather than copies. The
 * backend mirrors the same wording in cabinet-backend `server/lib/doorBlueprintFacts.ts`.
 * The first line is a marker; the backend does not append a second block to a
 * prompt that already carries one.
 */
import {
  DL_SHAKER_FIRM_RULE,
  effectiveShakerRailIn,
  isHickoryDoor,
  shakerDoorFamily,
  type ShakerStyleInput,
} from "./shakerDoorBlueprint";

export const DOOR_GROUND_TRUTH_MARKER = "GROUND TRUTH (from our catalog";

export type DoorGroundTruthStyle = ShakerStyleInput & {
  ourName?: string | null;
  distributorName?: string | null;
};

const clean = (value: string | number | null | undefined): string => (value == null ? "" : String(value).trim());

function blueprintLine(style: DoorGroundTruthStyle): string {
  if (isHickoryDoor(style) && shakerDoorFamily(style) !== "other") {
    return "Blueprint: a hickory door that keeps its own catalog photo. It is not the DL Shaker blueprint. Describe the construction only as seen in the photo.";
  }
  const family = shakerDoorFamily(style);
  if (family === "shaker") {
    const rail = effectiveShakerRailIn(style);
    return `Blueprint: this door uses the DL Shaker blueprint (${DL_SHAKER_FIRM_RULE}). It is a five-piece shaker door: one single recessed flat center panel, two stiles and two rails, square corners and a square inside edge, with the standard ${rail} inch rail and stile width.`;
  }
  if (family === "slim-shaker") {
    return "Blueprint: a slim shaker with its own narrow frame. It is not the DL Shaker blueprint and not the standard 2.75/3 inch rail. Describe the frame width only as seen in the photo.";
  }
  if (family === "double-shaker") {
    return "Blueprint: a double shaker with two panels. It is not the DL Shaker blueprint (which has one flat center panel).";
  }
  return "Blueprint: this is not a plain shaker, so the DL Shaker blueprint does not apply. Describe its construction only as seen in the photo, and do not call it a shaker.";
}

function mustNotContradict(style: DoorGroundTruthStyle): string {
  if (shakerDoorFamily(style) === "shaker" && !isHickoryDoor(style)) {
    return "You must not contradict this ground truth. Do not add or remove panels, and do not describe a raised panel, a two-panel door, a bevel, a bead or any other profile that the blueprint does not have. Within it, describe only the color, the grain and the finish as you see them.";
  }
  return "You must not contradict this ground truth. Do not call the door a different profile than the catalog says, and do not add panels or profile features that the photo does not show. Within it, describe only what you see.";
}

export function doorGroundTruthBlock(style: DoorGroundTruthStyle): string {
  const ourName = clean(style.ourName);
  const distributorName = clean(style.distributorName);
  const names = [ourName, distributorName && distributorName !== ourName ? `distributor name: ${distributorName}` : ""]
    .filter(Boolean)
    .join(" / ");
  return [
    `${DOOR_GROUND_TRUTH_MARKER}; this is fact, not a guess):`,
    `- Door style name: ${names || "not supplied"}`,
    `- Door style (profile): ${clean(style.doorStyle) || "not supplied"}`,
    `- Wood species: ${clean(style.woodSpecies) || "not supplied"}`,
    `- Color: ${clean(style.color) || "not supplied"}`,
    `- Finish: ${clean(style.finish) || "not supplied"}`,
    `- ${blueprintLine(style)}`,
    mustNotContradict(style),
  ].join("\n");
}

/** A column's prompt followed by the ground truth for this style. Not repeated if already present. */
export function promptWithDoorGroundTruth(prompt: string, style: DoorGroundTruthStyle): string {
  const base = prompt.trim();
  return base.includes(DOOR_GROUND_TRUTH_MARKER) ? base : `${base}\n\n${doorGroundTruthBlock(style)}`;
}
