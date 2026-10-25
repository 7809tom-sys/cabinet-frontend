// ─── LTL freight estimator (pure, unit-testable) ───────────────────────────────
// Computes a deliverable freight quote WITHOUT a live broker/middleman by using
// admin-configured per-zone rates + weight. A live carrier API can later replace
// this math behind the same tRPC procedure (see freightProvider seam in the
// server router); the shape of `FreightQuote` stays stable for the UI either way.
//
// Money: all amounts are whole cents to avoid float drift. Rates expressed as
// "$ per 100 lbs" are stored in cents per 100 lbs (per_cwt model).

export type RateModel = "per_cwt" | "flat";

/**
 * Older cart records sometimes use 0 as an absent style or distributor ID.
 * Freight procedures require positive catalog IDs, so normalize the legacy
 * sentinel before a quote request is created or signed.
 */
export function optionalPositiveFreightId(value: number | null | undefined): number | null {
  return Number.isInteger(value) && (value ?? 0) > 0 ? value! : null;
}

export interface FreightSettings {
  enabled: boolean;
  originZip: string;
  rateModel: RateModel;
  handlingFeeCents: number;
  minChargeCents: number;
  liftgateFeeCents: number;
  residentialFeeCents: number;
  insideDeliveryFeeCents: number;
  markupBps: number; // 1500 = 15%
  damageFeeBps: number; // surcharge on freight subtotal
  freeFreightThresholdCents: number; // 0 disables
  defaultCabinetWeightLbs: number;
}

export interface FreightZoneRate {
  zoneName: string;
  zipPrefixes: string; // comma-separated leading-digit prefixes, e.g. "30,31,32"
  rateCents: number;
}

export interface FreightAccessorials {
  liftgate?: boolean;
  residential?: boolean;
  insideDelivery?: boolean;
}

export interface FreightQuoteInput {
  destinationZip: string;
  totalWeightLbs: number;
  merchandiseSubtotalCents: number;
  accessorials?: FreightAccessorials;
}

export interface FreightQuoteLine {
  label: string;
  amountCents: number;
}

export interface FreightRateGroup {
  key: string;
  label: string;
  /** Fulfillment vendor; distinct from the carrier that returns a rate. */
  vendorName?: string;
  originZip: string;
  source: "live" | "parcel" | "plan_b";
  baseAmountCents: number;
  carrier?: string | null;
  palletCount?: number;
  /** Parcel handling or oversize review flags. Live carrier rating remains final. */
  parcelReviewWarnings?: string[];
  transitDays?: number;
  estimatedDeliveryDate?: string;
}

/** Carrier-ready pallet data returned with a live freight quote for review. */
export interface FreightPalletDetail {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLbs: number;
  contentsWeightLbs: number;
  contentsCubicFt: number;
}

/** A source-verified carton and its live parcel carrier selection. */
export interface FreightParcelDetail {
  label: string | null;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLbs: number;
  carrier?: string;
  service?: string;
  amountCents?: number;
}

/** One style-origin shipment within a cart's live freight result. */
export interface FreightShipmentGroup {
  label: string;
  /** Fulfillment vendor; distinct from the carrier that returns a rate. */
  vendorName?: string;
  /** Supplier carton facts versus a clearly labeled comparable-package estimate. */
  packageEvidenceType?: "supplier_verified" | "comparable_estimate";
  /** Catalog items retained in this origin/shipment group, including unavailable groups. */
  itemLabels?: string[];
  originZip: string;
  freightClass: string;
  /** A group can be displayed before its carrier rate is available. */
  status?: "quoted" | "needs_package_data" | "carrier_error";
  statusReason?: string;
  /** LTL uses pallets; parcel is available only after carrier-rule screening. */
  transportMode?: "ltl" | "parcel";
  palletCount: number;
  totalWeightLbs: number;
  totalContentsWeightLbs: number;
  totalCubicFt: number;
  pallets: FreightPalletDetail[];
  parcelCount?: number;
  parcels?: FreightParcelDetail[];
  /** Cartons filled by the approved generic cabinet packaging rule. */
  estimatedPackageCount?: number;
  /** Carrier threshold flags; the live carrier rate remains the final authority. */
  parcelReviewWarnings?: string[];
  /** Carrier transit after pickup; warehouse processing time is separate. */
  transitDays?: number;
  /** Carrier-provided estimated arrival date for the quoted pickup date. */
  estimatedDeliveryDate?: string;
}

export interface FreightQuote {
  available: boolean;
  zoneName: string | null;
  billableWeightLbs: number;
  // Ordered breakdown of every component that makes up the total.
  lines: FreightQuoteLine[];
  freightBeforeMarkupCents: number;
  markupCents: number;
  damageFeeCents: number;
  totalCents: number;
  freeFreightApplied: boolean;
  reason?: string; // populated when available=false
  rateGroups?: FreightRateGroup[];
  /** Some origin groups are quoted, but at least one retained shipment is unavailable. Never checkout-ready. */
  partial?: boolean;
  /** Actual physical plan submitted to the live carrier for this quote. */
  shipmentGroups?: FreightShipmentGroup[];
  /** Server-signed short-lived proof used to attach this exact quote to an order. */
  quoteToken?: string;
}

export function combineStyleFreightGroups(input: {
  groups: FreightRateGroup[];
  settings: FreightSettings;
  accessorials?: FreightAccessorials;
  merchandiseSubtotalCents: number;
  billableWeightLbs: number;
}): FreightQuote {
  const groups = input.groups.filter((group) => group.baseAmountCents >= 0);
  if (groups.length === 0) {
    return {
      available: false,
      zoneName: null,
      billableWeightLbs: Math.max(0, Math.round(input.billableWeightLbs)),
      lines: [],
      freightBeforeMarkupCents: 0,
      markupCents: 0,
      damageFeeCents: 0,
      totalCents: 0,
      freeFreightApplied: false,
      reason: "No style-origin freight group returned a live rate or configured Plan B fee.",
      rateGroups: [],
    };
  }

  const lines: FreightQuoteLine[] = groups.map((group) => ({
    label: `${group.source === "parcel" ? "Live parcel" : group.source === "live" ? "Plan A live" : "Plan B fallback"} — ${group.label}`,
    amountCents: Math.round(group.baseAmountCents),
  }));

  // A live provider quote already includes requested accessorials. Plan B is a
  // distributor/style fallback amount, so Operations accessorials are added per
  // fallback shipment rather than hidden inside the configured flat fee.
  const planBShipmentCount = groups.filter((group) => group.source === "plan_b").length;
  const accessorials = input.accessorials ?? {};
  if (planBShipmentCount > 0 && accessorials.liftgate && input.settings.liftgateFeeCents > 0) {
    lines.push({
      label: `Liftgate service — ${planBShipmentCount} Plan B shipment${planBShipmentCount === 1 ? "" : "s"}`,
      amountCents: input.settings.liftgateFeeCents * planBShipmentCount,
    });
  }
  if (planBShipmentCount > 0 && accessorials.residential && input.settings.residentialFeeCents > 0) {
    lines.push({
      label: `Residential delivery — ${planBShipmentCount} Plan B shipment${planBShipmentCount === 1 ? "" : "s"}`,
      amountCents: input.settings.residentialFeeCents * planBShipmentCount,
    });
  }
  if (planBShipmentCount > 0 && accessorials.insideDelivery && input.settings.insideDeliveryFeeCents > 0) {
    lines.push({
      label: `Inside delivery — ${planBShipmentCount} Plan B shipment${planBShipmentCount === 1 ? "" : "s"}`,
      amountCents: input.settings.insideDeliveryFeeCents * planBShipmentCount,
    });
  }
  if (input.settings.handlingFeeCents > 0) {
    lines.push({ label: "Operations handling", amountCents: input.settings.handlingFeeCents });
  }

  let freightBeforeMarkupCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const markupCents = round((freightBeforeMarkupCents * input.settings.markupBps) / 10000);
  const damageFeeCents = round((freightBeforeMarkupCents * input.settings.damageFeeBps) / 10000);
  let totalCents = freightBeforeMarkupCents + markupCents + damageFeeCents;

  const freeFreightApplied =
    input.settings.freeFreightThresholdCents > 0 &&
    input.merchandiseSubtotalCents >= input.settings.freeFreightThresholdCents;
  if (freeFreightApplied) totalCents = 0;

  return {
    available: true,
    zoneName: groups.length > 1 ? "Multiple style origins" : groups[0].label,
    billableWeightLbs: Math.max(0, Math.round(input.billableWeightLbs)),
    lines,
    freightBeforeMarkupCents,
    markupCents,
    damageFeeCents,
    totalCents,
    freeFreightApplied,
    rateGroups: groups,
  };
}

// Normalize a ZIP to its 5 leading digits (strip spaces/ZIP+4).
export function normalizeZip(zip: string): string {
  return (zip || "").replace(/[^0-9]/g, "").slice(0, 5);
}

// Pick the zone whose prefix list contains the LONGEST prefix matching the ZIP.
// Longest match wins so a "303" zone beats a generic "3" zone. Returns null when
// nothing matches.
export function resolveZone(
  zip: string,
  zones: FreightZoneRate[]
): FreightZoneRate | null {
  const z = normalizeZip(zip);
  if (!z) return null;
  let best: FreightZoneRate | null = null;
  let bestLen = -1;
  for (const zone of zones) {
    const prefixes = zone.zipPrefixes
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    for (const p of prefixes) {
      if (z.startsWith(p) && p.length > bestLen) {
        best = zone;
        bestLen = p.length;
      }
    }
  }
  return best;
}

function round(n: number): number {
  return Math.round(n);
}

// Core quote. All inputs already resolved by the caller (settings + zones loaded
// from the DB, or supplied by a test).
export function estimateFreight(
  input: FreightQuoteInput,
  settings: FreightSettings,
  zones: FreightZoneRate[]
): FreightQuote {
  const billableWeightLbs = Math.max(0, Math.round(input.totalWeightLbs));

  if (!settings.enabled) {
    return {
      available: false,
      zoneName: null,
      billableWeightLbs,
      lines: [],
      freightBeforeMarkupCents: 0,
      markupCents: 0,
      damageFeeCents: 0,
      totalCents: 0,
      freeFreightApplied: false,
      reason: "Freight estimating is turned off.",
    };
  }

  const zone = resolveZone(input.destinationZip, zones);
  if (!zone) {
    return {
      available: false,
      zoneName: null,
      billableWeightLbs,
      lines: [],
      freightBeforeMarkupCents: 0,
      markupCents: 0,
      damageFeeCents: 0,
      totalCents: 0,
      freeFreightApplied: false,
      reason: "No freight zone covers that destination ZIP yet.",
    };
  }

  const lines: FreightQuoteLine[] = [];

  // Base linehaul.
  let baseCents: number;
  if (settings.rateModel === "flat") {
    baseCents = zone.rateCents;
  } else {
    // per_cwt: rate is $ per 100 lbs. cwt = weight / 100.
    baseCents = round((billableWeightLbs / 100) * zone.rateCents);
  }
  lines.push({ label: `Linehaul — ${zone.zoneName}`, amountCents: baseCents });

  // Handling.
  if (settings.handlingFeeCents > 0) {
    lines.push({ label: "Handling", amountCents: settings.handlingFeeCents });
  }

  // Accessorials.
  const acc = input.accessorials ?? {};
  if (acc.liftgate && settings.liftgateFeeCents > 0) {
    lines.push({ label: "Liftgate service", amountCents: settings.liftgateFeeCents });
  }
  if (acc.residential && settings.residentialFeeCents > 0) {
    lines.push({ label: "Residential delivery", amountCents: settings.residentialFeeCents });
  }
  if (acc.insideDelivery && settings.insideDeliveryFeeCents > 0) {
    lines.push({ label: "Inside delivery", amountCents: settings.insideDeliveryFeeCents });
  }

  let freightBeforeMarkupCents = lines.reduce((s, l) => s + l.amountCents, 0);

  // Apply the per-shipment minimum charge to the pre-markup freight.
  if (settings.minChargeCents > 0 && freightBeforeMarkupCents < settings.minChargeCents) {
    const bump = settings.minChargeCents - freightBeforeMarkupCents;
    lines.push({ label: "Minimum charge adjustment", amountCents: bump });
    freightBeforeMarkupCents = settings.minChargeCents;
  }

  // Markup (our margin instead of a broker's).
  const markupCents = round((freightBeforeMarkupCents * settings.markupBps) / 10000);

  // Optional damage-coverage surcharge.
  const damageFeeCents = round((freightBeforeMarkupCents * settings.damageFeeBps) / 10000);

  let totalCents = freightBeforeMarkupCents + markupCents + damageFeeCents;

  // Free-freight threshold on merchandise subtotal.
  const freeFreightApplied =
    settings.freeFreightThresholdCents > 0 &&
    input.merchandiseSubtotalCents >= settings.freeFreightThresholdCents;
  if (freeFreightApplied) totalCents = 0;

  return {
    available: true,
    zoneName: zone.zoneName,
    billableWeightLbs,
    lines,
    freightBeforeMarkupCents,
    markupCents,
    damageFeeCents,
    totalCents,
    freeFreightApplied,
  };
}

// Helper: total a cart's weight from per-line {weightLbs, qty}, applying the
// configured default weight when a cabinet has no stored weight.
export function totalCartWeight(
  items: { weightLbs: number | null; qty: number }[],
  defaultCabinetWeightLbs: number
): number {
  return items.reduce((sum, it) => {
    const w = it.weightLbs && it.weightLbs > 0 ? it.weightLbs : defaultCabinetWeightLbs;
    return sum + w * Math.max(0, it.qty);
  }, 0);
}
