import { roundCents } from "./pricing";

export const HARDWARE_LINE_CODE = "HRDW";
export const HARDWARE_COMMISSION_RATE_BPS = 2500;

export type HardwareProfileFacts = {
  enabled: boolean;
  /** Legacy duplicate. The effective origin is now the vendor profile ZIP. */
  originZip?: string | null;
  packageLengthIn: number | string | null;
  packageWidthIn: number | string | null;
  packageHeightIn: number | string | null;
  packageWeightLbs: number | string | null;
  /** Legacy item-count field. Hardware is now always one consolidated package. */
  maxUnitsPerPackage?: number | null;
  standaloneShippingCents: number | null;
  sourceReference: string | null;
};

function positiveNumber(value: number | string | null | undefined): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

/** Hardware always ships from the existing vendor/distributor profile, never a browser-supplied ZIP. */
export function hardwareVendorOriginZip(warehouseZips: readonly string[] | null | undefined): string | null {
  return warehouseZips
    ?.map((zip) => zip.trim())
    .find((zip) => /^\d{5}(?:-\d{4})?$/.test(zip))
    ?? null;
}

/** A hardware profile cannot become sellable until Operations has supplied every shipping fact. */
export function hardwareProfileIsComplete(profile: HardwareProfileFacts | null | undefined): boolean {
  if (!profile?.enabled) return false;
  return Boolean(
    positiveNumber(profile.packageLengthIn)
    && positiveNumber(profile.packageWidthIn)
    && positiveNumber(profile.packageHeightIn)
    && positiveNumber(profile.packageWeightLbs)
    && Number.isInteger(profile.standaloneShippingCents)
    && (profile.standaloneShippingCents ?? -1) >= 0
    && Boolean(profile.sourceReference?.trim()),
  );
}

/** Supplier list is the default retail price. An affiliate may add—not subtract—its own hardware markup. */
export function hardwareRetailCents(listPrice: number | string | null | undefined, affiliateMarkupBps = 0): number | null {
  const listCents = roundCents(Number(listPrice) * 100);
  if (!Number.isFinite(listCents) || listCents <= 0) return null;
  const markupBps = Number.isFinite(affiliateMarkupBps)
    ? Math.max(0, Math.round(affiliateMarkupBps))
    : 0;
  return roundCents(listCents * (1 + markupBps / 10000));
}

/** Hardware affiliate commission is exactly 25% of paid hardware merchandise, never shipping or tax. */
export function hardwareAffiliateCommissionCents(hardwareMerchandiseCents: number): number {
  return roundCents(Math.max(0, hardwareMerchandiseCents) * HARDWARE_COMMISSION_RATE_BPS / 10000);
}

export function hardwareCheckoutEligibility(input: {
  profile: HardwareProfileFacts | null | undefined;
  vendorOriginZip: string | null | undefined;
  hardwareUnits: number;
  containsKitchenMerchandise: boolean;
}): {
  eligible: boolean;
  shippingCents: number | null;
  promotionApplied: boolean;
  reason: string | null;
} {
  const units = Math.max(0, Math.round(input.hardwareUnits));
  if (units === 0) return { eligible: false, shippingCents: null, promotionApplied: false, reason: "Add hardware before requesting a hardware shipping quote." };
  if (!/^\d{5}(?:-\d{4})?$/.test(input.vendorOriginZip?.trim() ?? "")) {
    return { eligible: false, shippingCents: null, promotionApplied: false, reason: "Hardware checkout is not available until the vendor profile ZIP is configured." };
  }
  if (input.containsKitchenMerchandise) {
    return { eligible: true, shippingCents: 0, promotionApplied: true, reason: "Free hardware shipping is applied because this hardware is ordered with kitchen merchandise." };
  }
  if (!hardwareProfileIsComplete(input.profile)) {
    return { eligible: false, shippingCents: null, promotionApplied: false, reason: "Hardware checkout is not available until Operations verifies one consolidated package’s dimensions and weight, a standalone shipping amount, and a source reference." };
  }
  return { eligible: true, shippingCents: input.profile!.standaloneShippingCents ?? null, promotionApplied: false, reason: null };
}
