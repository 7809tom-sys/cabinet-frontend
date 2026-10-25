import { isPanelItem, isPlaceableAccessory, type DesignCabinet } from "@/lib/design";

/** A subset of the existing source-priced accessory query, never new products. */
export function isPanelPaletteItem(item: Pick<DesignCabinet, "masterCode" | "description" | "subCategory">): boolean {
  // A cabinet's Looks-like wording can mention a raised/recessed door panel;
  // that is not a separate placeable end panel or skin.
  const productDescription = (item.description ?? "").split(/looks\s+like\s*:/i)[0];
  const identity = { ...item, description: productDescription };
  const explicitFlatBoard = /plywood\s+edge[-\s]?banded\s+board/i.test(`${item.subCategory ?? ""} ${productDescription}`);
  if (explicitFlatBoard) return isPanelItem(item) && isPlaceableAccessory(item);
  if (!isPanelItem(identity) || !isPlaceableAccessory(identity)) return false;
  const label = `${item.subCategory ?? ""} ${productDescription}`;
  return /\b(?:end|skin|decorative|dishwasher|refrigerator|door|finished|island|side)\s+panels?\b|\bskins?\b|flat\s+finished\s+panel/i.test(label)
    || /^(?:panels?|skins?)$/i.test((item.subCategory ?? "").trim());
}
