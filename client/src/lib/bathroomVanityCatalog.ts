import type { DesignCabinet } from "./design";

/** The Bathroom Vanity tab contains only source-categorized, placeable vanity items.
 * A reference to a vanity in an accessory's description is not enough to make
 * that accessory a vanity, and a decorative valance is never a vanity.
 */
export function isBathroomVanityCabinet(
  cabinet: Pick<DesignCabinet, "category" | "subCategory" | "description" | "placement">,
): boolean {
  if (cabinet.category?.trim().toLowerCase() !== "vanity") return false;
  if (cabinet.placement !== "base") return false;
  return !/\bvalance\b/i.test(`${cabinet.subCategory ?? ""} ${cabinet.description ?? ""}`);
}
