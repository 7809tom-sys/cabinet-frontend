import catalog from "@shared/fixtures/doorStyleSideCatalog.json";
import { findDlcFinishForStyle } from "@shared/dlcFr26Mapping";
import { resolveCabinetFaceImages } from "@shared/doorFaceRecognition";
import {
  matchStandardShakerToDl,
  shakerDoorFamily,
  standardShakerDlFacePlan,
  type ShakerStyleInput,
} from "@shared/shakerDoorBlueprint";

export const storeDoorStyles = catalog as ShakerStyleInput[];

export function doorsForDlReference(slug: string) {
  return storeDoorStyles.flatMap((style) => {
    if (shakerDoorFamily(style.doorStyle) !== "shaker") return [];
    const native = findDlcFinishForStyle(style);
    if (native) {
      if (native.slug !== slug) return [];
      const plan = resolveCabinetFaceImages(style, "wall");
      return [{ name: style.ourName ?? native.names[0], color: plan.dlcCrop?.solidColor ?? native.solidColor, plan }];
    }
    const match = matchStandardShakerToDl(style);
    if (!match.adopted || match.reference.slug !== slug) return [];
    const plan = standardShakerDlFacePlan(style, "wall");
    if (!plan) return [];
    return [{ name: style.aliasName || style.ourName || slug, color: match.ownColor, plan }];
  });
}
