/**
 * Source-verified Pelican toilet, bidet, and bathtub envelopes for the regular
 * Bathroom Designer. Product photos are catalog evidence only; these profiles
 * come from Pelican's official technical sheets and define the physical plan / 
 * 3D exterior envelope. Fine styling (bowls, tank curves, tub well shape) is an
 * illustrative visual inside that measured envelope, never an installation guide.
 *
 * Evidence snapshot: /home/ubuntu/pelican-official-audit-2026-10-07/
 * - toilets-PL-*.txt
 * - bathtubs-PL-*.txt
 */

export type PelicanBathroomFixtureKind = "toilet" | "bidet" | "freestanding-tub" | "alcove-tub" | "shower-door" | "tub-door" | "shower-wall" | "floor-tub-filler";

export type VerifiedPelicanBathroomFixtureProfile = {
  /** Stable browser-safe furniture definition identity. */
  id: string;
  /** Exact purchasable catalog SKU, preserving finish and drain-side variants. */
  pelicanCode: string;
  name: string;
  kind: PelicanBathroomFixtureKind;
  /** Source nominal side-to-side exterior width in inches. */
  widthIn: number;
  /** Source nominal front-to-back exterior depth/length in inches. */
  depthIn: number;
  /** Source nominal overall height in inches. */
  heightIn: number;
  /** Published seating height when the supplier sheet provides one. */
  seatHeightIn?: number;
  finish: "vitreous-china-white" | "vitreous-china-matte-black" | "acrylic-white" | "clear-tempered-glass" | "shower-panel" | "brushed-nickel" | "chrome" | "matte-black" | "brushed-gold";
  drain: "center" | "left" | "right" | null;
  toiletStyle?: "one-piece" | "two-piece" | "smart";
  /** Tub-filler footprint is an illustrative occupancy, not source outer dimensions or required clearance. */
  footprintBasis?: "illustrative-occupancy";
  mounting?: "floor";
  tubFillerStyle?: "gooseneck-single-column" | "telephone-double-column" | "square-single-column";
  tubFillerSpoutHeightIn?: number;
  tubFillerSpoutReachIn?: number;
  /** Exterior silhouette from the official sheet; freestanding does not imply oval. */
  tubShape?: "oval" | "rectangular" | "rounded-rectangular";
  /** Exact operating-control type stated by the official toilet technical sheet. */
  toiletFlushControl?: "dual-button" | "single-button" | "touchless" | "touchless-auto";
  /** Supplier's stated flush system; retained as product identity, not an installation claim. */
  toiletFlushTechnology?: "multi-jet-siphonic" | "vortex-siphonic-rimless" | "tornado-rimless";
  /** Supplier-stated glass/panel height when it is distinct from the full assembly height. */
  visiblePanelHeightIn?: number;
  /** Technical sheets label these as nominal; this stays a planning envelope, not an install opening. */
  planningOnly?: boolean;
  /** Official technical sheet, not a catalog image. */
  specificationUrl: string;
};

const OFFICIAL_SPEC_BASE = "https://buildpelican.com";
const spec = (filename: string) => `${OFFICIAL_SPEC_BASE}/products/${filename}`;

/**
 * Exact current Pelican models whose source sheets state all three external
 * dimensions. Values retain the published fractional measurements rather than
 * relying on catalog thumbnail labels or product photography.
 */
export const VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES: readonly VerifiedPelicanBathroomFixtureProfile[] = [
  { id: "pelican-toilet-pl-12005", pelicanCode: "PL-12005", name: "PL-12005 Vortex Smart Toilet", kind: "toilet", widthIn: 15 + 15 / 32, depthIn: 26 + 31 / 32, heightIn: 17 + 63 / 64, seatHeightIn: 15 + 5 / 8, finish: "vitreous-china-white", drain: null, toiletStyle: "smart", toiletFlushControl: "touchless-auto", toiletFlushTechnology: "multi-jet-siphonic", specificationUrl: spec("pl-12005") },
  { id: "pelican-toilet-pl-12005-mb", pelicanCode: "PL-12005 MB", name: "PL-12005 MB Vortex Smart Toilet", kind: "toilet", widthIn: 15 + 15 / 32, depthIn: 26 + 31 / 32, heightIn: 17 + 63 / 64, seatHeightIn: 15 + 5 / 8, finish: "vitreous-china-matte-black", drain: null, toiletStyle: "smart", toiletFlushControl: "touchless-auto", toiletFlushTechnology: "multi-jet-siphonic", specificationUrl: spec("pl-12005-mb") },
  { id: "pelican-toilet-pl-12011", pelicanCode: "PL-12011", name: "PL-12011 Vortex Toilet", kind: "toilet", widthIn: 14 + 61 / 64, depthIn: 26 + 31 / 32, heightIn: 30 + 45 / 64, seatHeightIn: 15.75, finish: "vitreous-china-white", drain: null, toiletStyle: "one-piece", toiletFlushControl: "dual-button", toiletFlushTechnology: "vortex-siphonic-rimless", specificationUrl: spec("pl-12011") },
  { id: "pelican-toilet-pl-12011-mb", pelicanCode: "PL-12011 MB", name: "PL-12011 MB Vortex Toilet", kind: "toilet", widthIn: 14 + 61 / 64, depthIn: 26 + 31 / 32, heightIn: 30 + 45 / 64, seatHeightIn: 15.75, finish: "vitreous-china-matte-black", drain: null, toiletStyle: "one-piece", toiletFlushControl: "dual-button", toiletFlushTechnology: "vortex-siphonic-rimless", specificationUrl: spec("pl-12011-mb") },
  { id: "pelican-toilet-pl-12027", pelicanCode: "PL-12027", name: "PL-12027 Vortex Toilet", kind: "toilet", widthIn: 15 + 35 / 64, depthIn: 28 + 15 / 16, heightIn: 25 + 19 / 32, seatHeightIn: 15 + 23 / 64, finish: "vitreous-china-white", drain: null, toiletStyle: "one-piece", toiletFlushControl: "dual-button", toiletFlushTechnology: "multi-jet-siphonic", specificationUrl: spec("pl-12027") },
  { id: "pelican-toilet-pl-12044", pelicanCode: "PL-12044", name: "PL-12044 Vortex Toilet", kind: "toilet", widthIn: 14 + 9 / 16, depthIn: 26 + 37 / 64, heightIn: 29 + 17 / 32, seatHeightIn: 15.75, finish: "vitreous-china-white", drain: null, toiletStyle: "one-piece", toiletFlushControl: "dual-button", toiletFlushTechnology: "multi-jet-siphonic", specificationUrl: spec("pl-12044") },
  { id: "pelican-toilet-pl-12044-mb", pelicanCode: "PL-12044 MB", name: "PL-12044 MB Vortex Toilet", kind: "toilet", widthIn: 14 + 9 / 16, depthIn: 26 + 37 / 64, heightIn: 29 + 17 / 32, seatHeightIn: 15.75, finish: "vitreous-china-matte-black", drain: null, toiletStyle: "one-piece", toiletFlushControl: "dual-button", toiletFlushTechnology: "multi-jet-siphonic", specificationUrl: spec("pl-12044-mb") },
  { id: "pelican-toilet-pl-12050", pelicanCode: "PL-12050", name: "PL-12050 ADA Vortex Toilet", kind: "toilet", widthIn: 15 + 23 / 64, depthIn: 28 + 35 / 64, heightIn: 27.75, seatHeightIn: 16 + 17 / 32, finish: "vitreous-china-white", drain: null, toiletStyle: "one-piece", toiletFlushControl: "dual-button", toiletFlushTechnology: "vortex-siphonic-rimless", specificationUrl: spec("pl-12050") },
  { id: "pelican-toilet-pl-12210", pelicanCode: "PL-12210", name: "PL-12210 Vortex Toilet", kind: "toilet", widthIn: 14 + 49 / 64, depthIn: 26 + 31 / 32, heightIn: 26 + 49 / 64, seatHeightIn: 15 + 15 / 16, finish: "vitreous-china-white", drain: null, toiletStyle: "one-piece", toiletFlushControl: "dual-button", toiletFlushTechnology: "multi-jet-siphonic", specificationUrl: spec("pl-12210") },
  { id: "pelican-toilet-pl-12230", pelicanCode: "PL-12230", name: "PL-12230 Vortex Smart Toilet", kind: "toilet", widthIn: 15, depthIn: 26.4, heightIn: 20, seatHeightIn: 15.4, finish: "vitreous-china-white", drain: null, toiletStyle: "smart", toiletFlushControl: "touchless", specificationUrl: spec("pl-12030") },
  { id: "pelican-bidet-pl-12248", pelicanCode: "PL-12248", name: "PL-12248 Vortex Floor Standing Bidet", kind: "bidet", widthIn: 14 + 11 / 64, depthIn: 21 + 21 / 32, heightIn: 16 + 9 / 64, finish: "vitreous-china-white", drain: null, specificationUrl: spec("pl-12248") },
  { id: "pelican-bidet-pl-12249", pelicanCode: "PL-12249", name: "PL-12249 Vortex Floor Standing Bidet", kind: "bidet", widthIn: 14 + 11 / 64, depthIn: 21 + 21 / 32, heightIn: 16 + 9 / 64, finish: "vitreous-china-white", drain: null, specificationUrl: spec("pl-12249") },
  { id: "pelican-toilet-pl-12305", pelicanCode: "PL-12305", name: "PL-12305 Vortex Smart Toilet", kind: "toilet", widthIn: 16 + 7 / 64, depthIn: 27 + 11 / 64, heightIn: 19 + 11 / 16, seatHeightIn: 15 + 23 / 64, finish: "vitreous-china-white", drain: null, toiletStyle: "smart", toiletFlushControl: "touchless-auto", toiletFlushTechnology: "multi-jet-siphonic", specificationUrl: spec("pl-12305") },
  { id: "pelican-toilet-pl-12305-mb", pelicanCode: "PL-12305 MB", name: "PL-12305 MB Vortex Smart Toilet", kind: "toilet", widthIn: 16 + 7 / 64, depthIn: 27 + 11 / 64, heightIn: 19 + 11 / 16, seatHeightIn: 15 + 23 / 64, finish: "vitreous-china-matte-black", drain: null, toiletStyle: "smart", toiletFlushControl: "touchless-auto", toiletFlushTechnology: "multi-jet-siphonic", specificationUrl: spec("pl-12305-mb") },
  { id: "pelican-toilet-pl-12318", pelicanCode: "PL-12318", name: "PL-12318 ADA Vortex Toilet", kind: "toilet", widthIn: 14 + 5 / 8, depthIn: 25 + 5 / 8, heightIn: 26 + 5 / 8, seatHeightIn: 16.5, finish: "vitreous-china-white", drain: null, toiletStyle: "one-piece", toiletFlushControl: "dual-button", toiletFlushTechnology: "tornado-rimless", specificationUrl: spec("pl-12318") },
  { id: "pelican-toilet-pl-12335", pelicanCode: "PL-12335", name: "PL-12335 ADA Vortex Toilet", kind: "toilet", widthIn: 14 + 49 / 64, depthIn: 28 + 5 / 32, heightIn: 29 + 23 / 32, seatHeightIn: 16 + 17 / 32, finish: "vitreous-china-white", drain: null, toiletStyle: "one-piece", toiletFlushControl: "single-button", toiletFlushTechnology: "multi-jet-siphonic", specificationUrl: spec("pl-12335") },
  { id: "pelican-toilet-pl-12382", pelicanCode: "PL-12382", name: "PL-12382 ADA Vortex Toilet", kind: "toilet", widthIn: 14.75, depthIn: 25.625, heightIn: 27.125, seatHeightIn: 16.5, finish: "vitreous-china-white", drain: null, toiletStyle: "one-piece", toiletFlushControl: "single-button", toiletFlushTechnology: "tornado-rimless", specificationUrl: spec("pl-12382") },
  { id: "pelican-toilet-pl-a249-ada", pelicanCode: "PL-A249 ADA", name: "PL-A249 ADA Vortex Two-Piece Toilet", kind: "toilet", widthIn: 16 + 7 / 16, depthIn: 28.75, heightIn: 31.125, seatHeightIn: 17 + 5 / 16, finish: "vitreous-china-white", drain: null, toiletStyle: "two-piece", toiletFlushControl: "single-button", toiletFlushTechnology: "multi-jet-siphonic", specificationUrl: spec("pl-a249") },

  { id: "pelican-tub-pl-02138-59", pelicanCode: 'PL-02138 59"', name: "PL-02138 59-inch Freestanding Soaking Tub", kind: "freestanding-tub", widthIn: 28 + 35 / 64, depthIn: 58 + 55 / 64, heightIn: 23 + 1 / 32, finish: "acrylic-white", drain: "center", specificationUrl: spec("pl-02138") },
  { id: "pelican-tub-pl-02141-59", pelicanCode: 'PL-02141 59"', name: "PL-02141 59-inch Freestanding Soaking Tub", kind: "freestanding-tub", widthIn: 28 + 47 / 64, depthIn: 59 + 1 / 16, heightIn: 27 + 11 / 64, finish: "acrylic-white", drain: "left", specificationUrl: spec("pl-02141") },
  { id: "pelican-tub-pl-02146-59", pelicanCode: 'PL-02146 59"', name: "PL-02146 59-inch Freestanding Soaking Tub", kind: "freestanding-tub", tubShape: "rectangular", widthIn: 29 + 21 / 64, depthIn: 59 + 1 / 16, heightIn: 22 + 53 / 64, finish: "acrylic-white", drain: "center", specificationUrl: spec("pl-02146") },
  { id: "pelican-tub-pl-02562-59", pelicanCode: 'PL-02562 59"', name: "PL-02562 59-inch Freestanding Soaking Tub", kind: "freestanding-tub", tubShape: "rounded-rectangular", widthIn: 28 + 15 / 16, depthIn: 59 + 1 / 16, heightIn: 22 + 53 / 64, finish: "acrylic-white", drain: "center", specificationUrl: spec("pl-02562") },
  { id: "pelican-tub-pl-02563-59", pelicanCode: 'PL-02563 59"', name: "PL-02563 59-inch Freestanding Soaking Tub", kind: "freestanding-tub", tubShape: "rectangular", widthIn: 29 + 17 / 32, depthIn: 59 + 1 / 16, heightIn: 22 + 53 / 64, finish: "acrylic-white", drain: "center", specificationUrl: spec("pl-02563") },
  // Independent 67-inch Pelican sheets; no enlargement of a 59-inch profile.
  // Short dimension stays on local x, long dimension on local z.
  { id: "pelican-tub-pl-02138-67", pelicanCode: 'PL-02138 67"', name: "PL-02138 67-inch Freestanding Soaking Tub", kind: "freestanding-tub", widthIn: 29 + 17 / 32, depthIn: 66 + 59 / 64, heightIn: 23 + 1 / 32, finish: "acrylic-white", drain: "center", specificationUrl: "https://cdn.accentuate.io/8980581613708/1772055445143/PL-02138-67-Spec-%281%29.pdf?v=1772130763043" },
  { id: "pelican-tub-pl-02141-67", pelicanCode: 'PL-02141 67"', name: "PL-02141 67-inch Freestanding Soaking Tub", kind: "freestanding-tub", widthIn: 29 + 9 / 64, depthIn: 66 + 21 / 32, heightIn: 27 + 3 / 4, finish: "acrylic-white", drain: "left", specificationUrl: "https://cdn.accentuate.io/8980581646476/1772055558563/PL-02141-67-Spec-%281%29.pdf?v=1772130816679" },
  { id: "pelican-tub-pl-02146-67", pelicanCode: 'PL-02146 67"', name: "PL-02146 67-inch Freestanding Soaking Tub", kind: "freestanding-tub", tubShape: "rectangular", widthIn: 29 + 13 / 32, depthIn: 66 + 21 / 32, heightIn: 22 + 53 / 64, finish: "acrylic-white", drain: "center", specificationUrl: "https://cdn.accentuate.io/8980581679244/1772055736689/PL-02146-67-Spec-%281%29.pdf?v=1775739382659" },
  { id: "pelican-tub-pl-02562-67", pelicanCode: 'PL-02562 67"', name: "PL-02562 67-inch Freestanding Soaking Tub", kind: "freestanding-tub", tubShape: "rounded-rectangular", widthIn: 30 + 29 / 32, depthIn: 66 + 59 / 64, heightIn: 22 + 53 / 64, finish: "acrylic-white", drain: "center", specificationUrl: "https://cdn.accentuate.io/8980581777548/1772055840468/PL-02562-67-Spec-%281%29.pdf?v=1772130937624" },
  { id: "pelican-tub-pl-02563-67", pelicanCode: 'PL-02563 67"', name: "PL-02563 67-inch Freestanding Soaking Tub", kind: "freestanding-tub", tubShape: "rectangular", widthIn: 31 + 7 / 64, depthIn: 66 + 59 / 64, heightIn: 22 + 53 / 64, finish: "acrylic-white", drain: "center", specificationUrl: "https://cdn.accentuate.io/8980581875852/1772056018579/PL-02563-67-Spec-%282%29.pdf?v=1772131031602" },
  { id: "pelican-tub-pl-02849-left", pelicanCode: "PL-02849L", name: "PL-02849L Left-Drain Alcove Soaking Tub", kind: "alcove-tub", widthIn: 30, depthIn: 60, heightIn: 21 + 21 / 32, finish: "acrylic-white", drain: "left", specificationUrl: spec("pl-2849") },
  { id: "pelican-tub-pl-02849-right", pelicanCode: "PL-02849R", name: "PL-02849R Right-Drain Alcove Soaking Tub", kind: "alcove-tub", widthIn: 30, depthIn: 60, heightIn: 21 + 21 / 32, finish: "acrylic-white", drain: "right", specificationUrl: spec("pl-2849") },
  { id: "pelican-tub-pl-02850-left", pelicanCode: "PL-02850L", name: "PL-02850L Left-Drain Alcove Soaking Tub", kind: "alcove-tub", widthIn: 32 + 1 / 64, depthIn: 60, heightIn: 21 + 21 / 32, finish: "acrylic-white", drain: "left", specificationUrl: spec("pl-2850") },
  { id: "pelican-tub-pl-02850-right", pelicanCode: "PL-02850R", name: "PL-02850R Right-Drain Alcove Soaking Tub", kind: "alcove-tub", widthIn: 32 + 1 / 64, depthIn: 60, heightIn: 21 + 21 / 32, finish: "acrylic-white", drain: "right", specificationUrl: spec("pl-2850") },
  { id: "pelican-tub-pl-02851-left", pelicanCode: "PL-02851L", name: "PL-02851L Left-Drain Alcove Soaking Tub", kind: "alcove-tub", widthIn: 35 + 63 / 64, depthIn: 60, heightIn: 21 + 21 / 32, finish: "acrylic-white", drain: "left", specificationUrl: spec("pl-2851") },
  { id: "pelican-tub-pl-02851-right", pelicanCode: "PL-02851R", name: "PL-02851R Right-Drain Alcove Soaking Tub", kind: "alcove-tub", widthIn: 35 + 63 / 64, depthIn: 60, heightIn: 21 + 21 / 32, finish: "acrylic-white", drain: "right", specificationUrl: spec("pl-2851") },

  // Pelican's official enclosure sheets give nominal width ranges and exact
  // overall / door heights. The shallow depth below is a deliberately visible
  // floor-plan plane for moving and viewing the glass; it is not a wall stud,
  // curb, rail setback, or installation opening dimension.
  { id: "pelican-shower-door-pl-03a42s", pelicanCode: "PL-03A42S", name: "PL-03A42S Frameless Double Sliding Shower Door", kind: "shower-door", widthIn: 60, depthIn: 0.5, heightIn: 76, visiblePanelHeightIn: 71 + 5 / 8, finish: "clear-tempered-glass", drain: null, planningOnly: true, specificationUrl: "https://cdn.accentuate.io/8980582301836/1776111489998/PL-03A42S.pdf?v=1776111489998" },
  { id: "pelican-tub-door-pl-03a42t", pelicanCode: "PL-03A42T", name: "PL-03A42T Frameless Double Sliding Tub Door", kind: "tub-door", widthIn: 60, depthIn: 0.5, heightIn: 59 + 1 / 6, visiblePanelHeightIn: 54 + 13 / 16, finish: "clear-tempered-glass", drain: null, planningOnly: true, specificationUrl: "https://cdn.accentuate.io/8980582301836/1776111498496/PL-03A42T.pdf?v=1776111498496" },
  { id: "pelican-shower-wall-pl-603074", pelicanCode: "PL-603074", name: "PL-603074 Pelican Shower Surround", kind: "shower-wall", widthIn: 60, depthIn: 30, heightIn: 74, finish: "shower-panel", drain: null, planningOnly: true, specificationUrl: "https://buildpelican.com/products/pl-603074" },
  // Official PL-8515LD / PL-8522LD drawings publish heights and spout reach,
  // not a complete horizontal envelope including handshower/hose travel.
  // 14 x 14 is explicitly an illustrative scene/selection occupancy only.
  ...([
    ["8515", "BN", "brushed-nickel"], ["8515", "CHR", "chrome"], ["8515", "MB", "matte-black"],
    ["8522", "BG", "brushed-gold"], ["8522", "CHR", "chrome"], ["8522", "MB", "matte-black"],
    ["8538", "BG", "brushed-gold"], ["8538", "BN", "brushed-nickel"], ["8538", "MB", "matte-black"],
  ] as const).map(([model, suffix, finish]): VerifiedPelicanBathroomFixtureProfile => ({
    id: `pelican-tub-filler-pl-${model}-${suffix.toLowerCase()}`,
    pelicanCode: `PL-${model} ${suffix}`, name: `PL-${model} ${suffix} Floor-mounted Tub Filler`,
    kind: "floor-tub-filler", widthIn: 14, depthIn: 14,
    heightIn: model === "8515" ? 43 + 7 / 8 : model === "8522" ? 44.5 : 41 + 7 / 8, finish, drain: null,
    planningOnly: true, footprintBasis: "illustrative-occupancy", mounting: "floor",
    tubFillerStyle: model === "8515" ? "gooseneck-single-column" : model === "8522" ? "telephone-double-column" : "square-single-column",
    tubFillerSpoutHeightIn: model === "8515" ? 40.25 : model === "8522" ? 32 + 7 / 8 : 35,
    tubFillerSpoutReachIn: model === "8515" ? 7 : model === "8522" ? 6.5 : 8 + 7 / 8,
    specificationUrl: `https://buildpelican.com/cdn/shop/files/PL-${model}LD.png?v=${model === "8515" ? "1774294272" : model === "8522" ? "1774294304" : "1774294349"}`,
  })),
] as const;

function normalizeCode(code: string | null | undefined) {
  return (code ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/** Exact profile only: a product image without a dimensioned source sheet is not enough. */
export function verifiedPelicanBathroomFixtureProfile(
  code: string | null | undefined,
): VerifiedPelicanBathroomFixtureProfile | null {
  const normalized = normalizeCode(code);
  const direct = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((profile) => profile.pelicanCode === normalized);
  if (direct) return direct;
  // Current active catalog records carry finish / panel décor suffixes, while
  // the official technical sheet describes the shared physical envelope. Keep
  // the selected purchasable identity without inventing finish-specific sizes.
  const baseCode = /^PL-03A42S60\s+(?:BN|CHR|MB)$/.test(normalized) ? "PL-03A42S"
    : /^PL-03A42T60\s+(?:BN|CHR|MB)$/.test(normalized) ? "PL-03A42T"
      : /^PL-603074\s+(?:BRICK|GREY WOOD|MARBLE|WHITE WOOD)$/.test(normalized) ? "PL-603074"
        : null;
  const shared = baseCode ? VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((profile) => profile.pelicanCode === baseCode) : null;
  return shared ? { ...shared, pelicanCode: normalized, name: normalized } : null;
}

export function isPelicanBathroomFixtureProfileVerified(code: string | null | undefined): boolean {
  return verifiedPelicanBathroomFixtureProfile(code) != null;
}

export function pelicanBathroomFixturePlacementText(code: string | null | undefined): string {
  const profile = verifiedPelicanBathroomFixtureProfile(code);
  if (profile?.kind === "floor-tub-filler") return `Floor-mounted · ${profile.heightIn}″ source height · illustrative 3D; footprint / plumbing fit unverified`;
  if (profile?.planningOnly) return `Place ${profile.widthIn.toFixed(2).replace(/\.00$/, "")}″ nominal visual planning envelope`;
  if (profile) return `Place measured ${profile.widthIn.toFixed(2).replace(/\.00$/, "")}″W × ${profile.depthIn.toFixed(2).replace(/\.00$/, "")}″D fixture`;
  return "Exact 3D envelope is pending a Pelican technical sheet";
}
