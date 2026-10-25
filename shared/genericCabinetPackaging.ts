export type GenericCabinetPackageInput = {
  widthIn: number | null | undefined;
  heightIn: number | null | undefined;
  depthIn: number | null | undefined;
  assembledWeightLbs?: number | null;
  category?: string | null;
  description?: string | null;
};

export type GenericCabinetPackage = {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLbs: number;
  cubicFt: number;
  densityLbsPerCubicFt: number;
  freightClass: string;
  isTrim: boolean;
};

const HALF_INCH_PLYWOOD_LBS_PER_SQ_FT = 1.5;
const THREE_QUARTER_INCH_PLYWOOD_LBS_PER_SQ_FT = 2.1;
const HARDWARE_AND_PACKAGING_LBS = 4;
const FLAT_PACK_THICKNESS_IN = 7;
const BASE_PACKED_HEIGHT_IN = 35;
const DEFAULT_ACCESSORY_PACKAGE = [12, 12, 6] as const;

function positive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function roundUp(value: number): number {
  return Math.max(1, Math.ceil(value));
}

function descriptionDimensions(description: string): number[] {
  return Array.from(description.matchAll(/(\d+(?:\.\d+)?)\s*(?:"|in\b)/gi))
    .map((match) => Number(match[1]))
    .filter(positive);
}

/** Density-based LTL class table used by the cabinet fallback rule. */
export function freightClassFromDensity(densityLbsPerCubicFt: number): string | null {
  if (!Number.isFinite(densityLbsPerCubicFt) || densityLbsPerCubicFt <= 0) return null;
  if (densityLbsPerCubicFt >= 50) return "50";
  if (densityLbsPerCubicFt >= 35) return "55";
  if (densityLbsPerCubicFt >= 30) return "60";
  if (densityLbsPerCubicFt >= 22.5) return "65";
  if (densityLbsPerCubicFt >= 15) return "70";
  if (densityLbsPerCubicFt >= 13.5) return "77.5";
  if (densityLbsPerCubicFt >= 12) return "85";
  if (densityLbsPerCubicFt >= 10.5) return "92.5";
  if (densityLbsPerCubicFt >= 9) return "100";
  if (densityLbsPerCubicFt >= 8) return "110";
  if (densityLbsPerCubicFt >= 7) return "125";
  if (densityLbsPerCubicFt >= 6) return "150";
  if (densityLbsPerCubicFt >= 5) return "175";
  if (densityLbsPerCubicFt >= 4) return "200";
  if (densityLbsPerCubicFt >= 3) return "250";
  if (densityLbsPerCubicFt >= 2) return "300";
  if (densityLbsPerCubicFt >= 1) return "400";
  return "500";
}

function finalize(lengthIn: number, widthIn: number, heightIn: number, weightLbs: number, isTrim: boolean): GenericCabinetPackage {
  const cubicFt = (lengthIn * widthIn * heightIn) / 1728;
  const densityLbsPerCubicFt = weightLbs / cubicFt;
  return {
    lengthIn,
    widthIn,
    heightIn,
    weightLbs,
    cubicFt,
    densityLbsPerCubicFt,
    freightClass: freightClassFromDensity(densityLbsPerCubicFt) ?? "175",
    isTrim,
  };
}

/**
 * Approved generic RTA package rule. Exact supplier package data remains first
 * priority; this rule fills only missing package fields.
 *
 * Cabinet boxes:
 * - Base/ADA/vanity/corner: max(24 in, cabinet width) × 35 in × 7 in.
 * - Wall: max(12 in, cabinet width) × cabinet height × 7 in.
 * - Tall: max(24 in, cabinet width) × cabinet height × 7 in.
 *
 * Cabinet weight uses 1/2-in box material at 1.5 lb/ft², a 3/4-in front at
 * 2.1 lb/ft², and 4 lb for hardware/packaging. Trim/molding/fillers weigh 2 lb
 * per piece and ride with the rest of the shipment. Panels use face area;
 * remaining accessories use their stored size/weight when present and a small,
 * disclosed generic carton only when the catalog has no measurements.
 */
export function genericCabinetPackage(input: GenericCabinetPackageInput): GenericCabinetPackage {
  const category = (input.category ?? "").trim().toLowerCase();
  const description = (input.description ?? "").trim();
  const combined = `${category} ${description}`;
  const isTrim = /trim|molding|moulding|crown|valance|toe.?kick|filler|scribe/i.test(combined);
  const isPanel = /panel|skin|veneer/i.test(combined);
  const isWall = category.includes("wall") && !isPanel;
  const isTall = (category.includes("tall") || category.includes("pantry") || category.includes("oven")) && !isPanel;
  const isBase = category.includes("base") || category.includes("vanity") || category.includes("ada") || category.includes("corner") || category.includes("sink");

  const descriptionDims = descriptionDimensions(description);
  const availableDims = [input.widthIn, input.heightIn, input.depthIn, ...descriptionDims]
    .filter(positive)
    .sort((a, b) => b - a);

  if (isTrim) {
    const trimDims = Array.from(new Set(availableDims));
    const lengthIn = roundUp(trimDims[0] ?? 96);
    const widthIn = roundUp(trimDims[1] ?? 3);
    return finalize(lengthIn, widthIn, 2, 2, true);
  }

  const width = positive(input.widthIn) ? input.widthIn : descriptionDims[0];
  const height = positive(input.heightIn) ? input.heightIn : descriptionDims[1];
  const depth = positive(input.depthIn) ? input.depthIn : descriptionDims[2];

  if ((isBase || isWall || isTall) && positive(width) && positive(height)) {
    const referenceDepth = isWall ? 12 : 24;
    const workingDepth = positive(depth) ? depth : referenceDepth;
    const cartonLength = roundUp(Math.max(referenceDepth, width));
    const cartonWidth = roundUp(isBase ? BASE_PACKED_HEIGHT_IN : height);
    const cartonHeight = FLAT_PACK_THICKNESS_IN;
    const sideAreaSqFt = (2 * workingDepth * height) / 144;
    const backAreaSqFt = (width * height) / 144;
    const bottomAreaSqFt = (width * workingDepth) / 144;
    const topAreaSqFt = isWall || isTall ? bottomAreaSqFt : 0;
    const shelfDepth = Math.min(workingDepth, 14);
    const shelfCount = isTall ? Math.max(2, Math.round(height / 30)) : 1;
    const shelfAreaSqFt = (width * shelfDepth * shelfCount) / 144;
    const boxAreaSqFt = sideAreaSqFt + backAreaSqFt + bottomAreaSqFt + topAreaSqFt + shelfAreaSqFt;
    const frontAreaSqFt = (width * height) / 144;
    const weightLbs = Math.max(1, Math.round(
      (boxAreaSqFt * HALF_INCH_PLYWOOD_LBS_PER_SQ_FT)
        + (frontAreaSqFt * THREE_QUARTER_INCH_PLYWOOD_LBS_PER_SQ_FT)
        + HARDWARE_AND_PACKAGING_LBS,
    ));
    return finalize(cartonLength, cartonWidth, cartonHeight, weightLbs, false);
  }

  if (isPanel && availableDims.length >= 2) {
    const lengthIn = roundUp(availableDims[0]);
    const widthIn = roundUp(availableDims[1]);
    const heightIn = 2;
    const faceAreaSqFt = (lengthIn * widthIn) / 144;
    return finalize(lengthIn, widthIn, heightIn, Math.max(4, Math.ceil(faceAreaSqFt * THREE_QUARTER_INCH_PLYWOOD_LBS_PER_SQ_FT + 2)), false);
  }

  const [defaultLength, defaultWidth, defaultHeight] = DEFAULT_ACCESSORY_PACKAGE;
  const lengthIn = roundUp(availableDims[0] ?? defaultLength);
  const widthIn = roundUp(availableDims[1] ?? defaultWidth);
  const heightIn = roundUp(Math.min(availableDims[2] ?? defaultHeight, FLAT_PACK_THICKNESS_IN));
  const cubicFt = (lengthIn * widthIn * heightIn) / 1728;
  const storedWeight = positive(input.assembledWeightLbs) ? Math.ceil(input.assembledWeightLbs) : null;
  const weightLbs = storedWeight ?? Math.max(4, Math.ceil(cubicFt * 10));
  return finalize(lengthIn, widthIn, heightIn, weightLbs, false);
}
