// ─── Live LTL freight helpers (pure, unit-testable) ─────────────────────────────
// Cabinets ship flat-pack (RTA / not assembled). For a live LTL carrier quote we
// cube the order by PACKAGED weight + PACKAGED cubic feet, pack it onto 8 ft
// freight pallets using admin-configured caps, and hand the resulting pallet list
// to a carrier API (EasyPost/Shippo). The carrier returns a real rate; we then
// apply our handling markup and the kitchen freight floor ($800 by default).
//
// Everything here is pure math so it can be tested without the network. The
// actual carrier HTTP call lives in server/_core/easypost.ts and is the ONLY part
// that is not unit-testable offline.
//
// Money: whole cents. Dimensions: inches. Weight: pounds. Volume: cubic feet.

export interface PalletCaps {
  // Standard cabinet pallet and long-item pallet footprints used for carrier dimensions.
  standardPalletLengthIn?: number; // 48 in default for ordinary cabinet cartons
  palletLengthIn: number; // 96 in long pallet for trim and other 7–8 ft cartons
  palletWidthIn: number;
  palletHeightIn: number;
  // Packing caps — a pallet is "full" when EITHER weight or cube cap is hit.
  palletMaxWeightLbs: number;
  palletMaxCubicFt: number;
  // Empty pallet + packaging tare added to each pallet's billable weight.
  palletTareLbs: number;
}

export interface FreightItemPackage {
  // PACKAGED (flat-pack) weight + cubic feet for ONE unit, already resolved from
  // the catalog (with fallbacks) by the caller.
  weightLbs: number;
  cubicFt: number;
  qty: number;
  // Longest authoritative packaged dimension (or physical fallback) for one unit.
  maxPackageLengthIn?: number | null;
  // Trim rides with an existing complete-kitchen load and contributes weight/cube,
  // but does not by itself force every kitchen pallet to an 8-foot footprint.
  isTrim?: boolean;
}

export interface BuiltPallet {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  // Billable weight = packed contents + pallet tare, rounded up to a whole lb.
  weightLbs: number;
  contentsWeightLbs: number;
  contentsCubicFt: number;
}

export interface PalletPlan {
  pallets: BuiltPallet[];
  palletCount: number;
  totalWeightLbs: number; // includes tare
  totalContentsWeightLbs: number;
  totalCubicFt: number;
}

// Sum the packaged weight + cube of all order lines.
export function totalPackagedLoad(items: FreightItemPackage[]): {
  weightLbs: number;
  cubicFt: number;
  units: number;
} {
  let weightLbs = 0;
  let cubicFt = 0;
  let units = 0;
  for (const it of items) {
    const q = Math.max(0, Math.floor(it.qty));
    weightLbs += Math.max(0, it.weightLbs) * q;
    cubicFt += Math.max(0, it.cubicFt) * q;
    units += q;
  }
  return { weightLbs, cubicFt, units };
}

// Determine how many pallets the order needs. We do NOT bin-pack individual
// boxes (the carrier bills by total weight + handling units); instead we compute
// the pallet count as the max of the weight-driven and cube-driven counts, then
// distribute the load evenly across that many pallets so each pallet reports a
// realistic billable weight (contents share + tare).
export function buildPallets(
  items: FreightItemPackage[],
  caps: PalletCaps,
): PalletPlan {
  const { weightLbs, cubicFt } = totalPackagedLoad(items);

  if (weightLbs <= 0 && cubicFt <= 0) {
    return {
      pallets: [],
      palletCount: 0,
      totalWeightLbs: 0,
      totalContentsWeightLbs: 0,
      totalCubicFt: 0,
    };
  }

  const maxW = caps.palletMaxWeightLbs > 0 ? caps.palletMaxWeightLbs : 1200;
  const maxC = caps.palletMaxCubicFt > 0 ? caps.palletMaxCubicFt : 100;

  const byWeight = Math.ceil(weightLbs / maxW);
  const byCube = Math.ceil(cubicFt / maxC);
  const palletCount = Math.max(1, byWeight, byCube);

  const perContentsWeight = weightLbs / palletCount;
  const perContentsCube = cubicFt / palletCount;
  const longestRequiredIn = items.reduce(
    (longest, item) => Math.max(
      longest,
      Math.max(0, Math.floor(item.qty)) > 0 ? Math.max(0, item.maxPackageLengthIn ?? 0) : 0,
    ),
    0,
  );
  const requiresLongPallet = longestRequiredIn >= 84;
  const standardPalletLengthIn = Math.max(caps.standardPalletLengthIn ?? 48, longestRequiredIn);
  const palletLengthIn = requiresLongPallet
    ? caps.palletLengthIn
    : Math.min(standardPalletLengthIn, caps.palletLengthIn);

  const pallets: BuiltPallet[] = [];
  for (let i = 0; i < palletCount; i++) {
    const contentsWeightLbs = Math.round(perContentsWeight);
    const weightWithTare = Math.ceil(contentsWeightLbs + caps.palletTareLbs);
    pallets.push({
      lengthIn: palletLengthIn,
      widthIn: caps.palletWidthIn,
      heightIn: caps.palletHeightIn,
      weightLbs: weightWithTare,
      contentsWeightLbs,
      contentsCubicFt: Math.round(perContentsCube * 100) / 100,
    });
  }

  const totalWeightLbs = pallets.reduce((s, p) => s + p.weightLbs, 0);

  return {
    pallets,
    palletCount,
    totalWeightLbs,
    totalContentsWeightLbs: Math.round(weightLbs),
    totalCubicFt: Math.round(cubicFt * 100) / 100,
  };
}

// Resolve packaged cubic feet for a single cabinet from its packaging dimensions
// (inches). Falls back to the configured default when dims are missing/zero.
export function packagedCubicFt(
  pkgLengthIn: number | null,
  pkgWidthIn: number | null,
  pkgHeightIn: number | null,
  fallbackCubicFt: number
): number {
  const l = pkgLengthIn ?? 0;
  const w = pkgWidthIn ?? 0;
  const h = pkgHeightIn ?? 0;
  if (l > 0 && w > 0 && h > 0) {
    return (l * w * h) / 1728; // cubic inches → cubic feet
  }
  return Math.max(0, fallbackCubicFt);
}
