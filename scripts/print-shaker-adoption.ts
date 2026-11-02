import catalog from "../shared/fixtures/doorStyleSideCatalog.json";
import { findDlcFinishForStyle } from "../shared/dlcFr26Mapping";
import {
  distributorLabel,
  matchStandardShakerToDl,
  shakerDoorFamily,
  shakerSrgbLuminance,
  standardDlShakerReferences,
  styleOwnColor,
  type ShakerStyleInput,
} from "../shared/shakerDoorBlueprint";

const styles = catalog as ShakerStyleInput[];
console.log("REFERENCES");
for (const reference of standardDlShakerReferences()) {
  console.log([reference.name, reference.color, reference.family, reference.grainPaleSoftened ? "near-flat" : "grain", reference.grain].join("\t"));
}
console.log("ADOPTED");
for (const style of styles) {
  if (shakerDoorFamily(style.doorStyle) !== "shaker") continue;
  const native = findDlcFinishForStyle(style);
  if (native) {
    console.log([
      distributorLabel(style.distributorId),
      style.ourName,
      style.aliasName ?? "",
      "3",
      native.solidColor,
      shakerSrgbLuminance(native.solidColor).toFixed(3),
      "native",
      native.names[0],
      "0.0",
      "own-grain",
      native.faceDoor,
    ].join("\t"));
    continue;
  }
  const match = matchStandardShakerToDl(style);
  if (!match.adopted) {
    console.log(["SKIP", style.ourName, match.reason].join("\t"));
    continue;
  }
  const color = styleOwnColor(style);
  console.log([
    distributorLabel(style.distributorId),
    style.ourName,
    style.aliasName ?? "",
    match.railIn,
    color,
    shakerSrgbLuminance(color).toFixed(3),
    match.family,
    match.reference.name,
    match.deltaE.toFixed(1),
    match.tintClamped ? "clamped" : "tint-ok",
    match.grain,
  ].join("\t"));
}
console.log("NOT_CONVERTED");
for (const style of styles) {
  const family = shakerDoorFamily(style.doorStyle);
  if (family !== "slim-shaker" && family !== "double-shaker") continue;
  console.log([distributorLabel(style.distributorId), style.ourName, family, matchStandardShakerToDl(style).reason].join("\t"));
}
