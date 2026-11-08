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

export type PelicanBathroomFixtureKind =
  | "toilet" | "bidet" | "freestanding-tub" | "alcove-tub"
  | "shower-door" | "tub-door" | "shower-wall" | "floor-tub-filler"
  // Shower designer. A pan is the floor of the shower; a surround is the wall
  // panel set above a pan or tub; a shower system is the wall valve + head; a
  // niche is recessed into a surround wall; a soap tray sits on a wall or pan.
  | "shower-pan" | "shower-surround" | "shower-system" | "shower-niche" | "soap-tray";

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

/**
 * Shower designer fixtures.
 *
 * Every envelope below comes from that model's own Pelican technical sheet; the
 * pan sizes also match the SKU itself (PL-016030 is 60 x 30). Where a family
 * publishes one dimensioned drawing per drain side, the three drawings share an
 * envelope, so one entry per drain side covers C/L/R.
 *
 * Not sourced with a measured envelope here, because Pelican publishes none:
 * the soap trays, the surround panel thickness, and the Hydra wall occupancy.
 * Those carry `planningOnly` so the designer never claims a measured fit.
 */
const SHOWER_PAN_SOURCES = [
  // code, width, depth, height, drain
  ["PL-014836C", 48, 36, 4, "center"],
  ["PL-014836L", 48, 36, 4, "left"],
  ["PL-014836R", 48, 36, 4, "right"],
  ["PL-016030C", 60, 30, 5.5, "center"],
  ["PL-016030L", 60, 30, 5.5, "left"],
  ["PL-016030R", 60, 30, 5.5, "right"],
  ["PL-016032C", 60, 32, 5.5, "center"],
  ["PL-016032L", 60, 32, 5.5, "left"],
  ["PL-016032R", 60, 32, 5.5, "right"],
  ["PL-016036C", 60, 36, 5.5, "center"],
  ["PL-016036L", 60, 36, 5.5, "left"],
  ["PL-016036R", 60, 36, 5.5, "right"],
  ["PL-SMC4836C", 47 + 63 / 64, 36, 4 + 1 / 32, "center"],
  ["PL-SMC6030C", 60, 30, 4 + 1 / 64, "center"],
  ["PL-SMC6030L", 60, 30, 4 + 1 / 32, "left"],
  ["PL-SMC6030R", 60, 30, 4 + 1 / 32, "right"],
  ["PL-SMC6032C", 60, 32, 4 + 1 / 64, "center"],
  ["PL-SMC6032L", 60, 32, 4 + 1 / 32, "left"],
  ["PL-SMC6032R", 60, 32, 4 + 1 / 32, "right"],
  ["PL-SMC6036C", 60, 36, 4 + 1 / 64, "center"],
  ["PL-SMC6036L", 60, 36, 4 + 1 / 32, "left"],
  ["PL-SMC6036R", 60, 36, 4 + 1 / 32, "right"],
  // Sizes the live catalog also sells. The "-SO" rows are the tile-flange version of
  // the same base, so they share its measured envelope.
  ["PL-013636C", 36, 36, 4, "center"],
  ["PL-013838ADA", 38, 38, 4, "center"],
  ["PL-014236C", 42, 36, 4, "center"],
  ["PL-014242C", 42, 42, 4, "center"],
  ["PL-014832C", 48, 32, 4, "center"],
  ["PL-016034C", 60, 34, 5.5, "center"],
  ["PL-016034L", 60, 34, 5.5, "left"],
  ["PL-016034R", 60, 34, 5.5, "right"],
  ["PL-016038C", 60, 38, 5.5, "center"],
  ["PL-016236ADA", 62, 36, 5.5, "center"],
  ["PL-016238ADA", 62, 38, 5.5, "center"],
] as const;

const SHOWER_PAN_DRAIN_LABEL: Record<string, string> = {
  center: "Center Drain",
  left: "Left Drain",
  right: "Right Drain",
};

const SHOWER_PAN_PROFILES: VerifiedPelicanBathroomFixtureProfile[] = SHOWER_PAN_SOURCES.map(
  ([code, widthIn, depthIn, heightIn, drain]) => ({
    id: `pelican-shower-pan-${code.toLowerCase()}`,
    pelicanCode: code,
    name: `${code} ${widthIn}" x ${depthIn}" ${SHOWER_PAN_DRAIN_LABEL[drain] ?? ""} Shower Pan`.replace(/\s+/g, " ").trim(),
    kind: "shower-pan" as const,
    widthIn,
    depthIn,
    heightIn,
    finish: "acrylic-white" as const,
    drain: drain as "center" | "left" | "right",
    // Pan sheets are per drain drawing on the supplier's product page.
    specificationUrl: `https://buildpelican.com/products/pl-${code.replace(/^PL-/, "").replace(/[CLR]$/, "").toLowerCase()}`,
  }),
);

/**
 * Surrounds are sold BY ALCOVE SIZE, which the Marble-Wall-Specs sheet makes
 * explicit: it lists the panel set for each pan it fits.
 *
 *   96" shower panels   PL-483696  48" back, 36" sides   fits PL-014836/SMC4836
 *                       PL-603096  60" back, 30" sides   fits PL-016030/SMC6030
 *                       PL-603296  60" back, 32" sides   fits PL-016032/SMC6032
 *                       PL-603696  60" back, 36" sides   fits PL-016036/SMC6036
 *   74" tub panels      PL-603074  60" back, 30" sides   fits PL-02849
 *                       PL-603274  60" back, 32" sides   fits PL-02850
 *                       PL-603674  60" back, 36" sides   fits PL-02850
 *
 * The four décors (Carrara Marble, Grey Wood, White Wood, White Brick) are panel
 * finishes of these same sets, so each size is offered in each décor rather than
 * one generic 48" set standing in for a 60" alcove.
 */
const SURROUND_SIZES = [
  // panelModel, back width, side depth, height, fits a pan of this alcove
  ["PL-483696", 48, 36, 96],
  ["PL-603096", 60, 30, 96],
  ["PL-603296", 60, 32, 96],
  ["PL-603696", 60, 36, 96],
  ["PL-603074T", 60, 30, 74],
  ["PL-603274T", 60, 32, 74],
  ["PL-603674T", 60, 36, 74],
] as const;

const SURROUND_DECORS = ["Marble", "Grey Wood", "White Wood", "Brick"] as const;

const SHOWER_SURROUND_PROFILES: VerifiedPelicanBathroomFixtureProfile[] = SURROUND_SIZES.flatMap(
  ([panelModel, backIn, sideIn, heightIn]) => SURROUND_DECORS.map((decor) => ({
    id: `pelican-shower-surround-${panelModel.toLowerCase()}-${decor.toLowerCase().replace(/\s+/g, "-")}`,
    // The catalog carries one purchasable code per décor at the 48" set; the
    // larger sets resolve through the panel model they are cut from.
    pelicanCode: `${panelModel} ${decor}`,
    name: `${panelModel} ${decor} ${backIn}" x ${sideIn}" x ${heightIn}" 3-Piece Alcove Surround`,
    kind: "shower-surround" as const,
    // A surround's back panel spans the alcove and its side panels run the depth.
    widthIn: backIn,
    depthIn: sideIn,
    heightIn,
    finish: "shower-panel" as const,
    drain: null,
    specificationUrl: "https://buildpelican.com/products/carrara-marble-matte-surround",
  })),
);

/**
 * Hydra shower systems. The sheet publishes the spout/head reach rather than a
 * plan envelope, so the wall occupancy is illustrative and marked planningOnly.
 */
const SHOWER_SYSTEM_SOURCES = [
  ["PL-86H55 BRUSHED NICKEL", "PL-86H55", "brushed-nickel", 14 + 3 / 16],
  ["PL-86H55 CHROME", "PL-86H55", "chrome", 14 + 3 / 16],
  ["PL-86H55 MATTE BLACK", "PL-86H55", "matte-black", 14 + 3 / 16],
  ["PL-86H15 BRUSHED NICKEL", "PL-86H15", "brushed-nickel", 14 + 1 / 4],
  ["PL-86H15 CHROME", "PL-86H15", "chrome", 14 + 1 / 4],
  ["PL-86H15 MATTE BLACK", "PL-86H15", "matte-black", 14 + 1 / 4],
  ["PL-86A33 BRUSHED NICKEL", "PL-86A33", "brushed-nickel", 13 + 7 / 8],
  ["PL-86A33 CHROME", "PL-86A33", "chrome", 13 + 7 / 8],
  ["PL-86A33 MATTE BLACK", "PL-86A33", "matte-black", 13 + 7 / 8],
  ["PL-86A23 BRUSHED NICKEL", "PL-86A23", "brushed-nickel", 13 + 7 / 8],
  ["PL-86A23 CHROME", "PL-86A23", "chrome", 13 + 7 / 8],
  ["PL-86A23 MATTE BLACK", "PL-86A23", "matte-black", 13 + 7 / 8],
  ["PL-86S22 BRUSHED NICKEL", "PL-86S22", "brushed-nickel", 6 + 5 / 8],
  ["PL-86S22 CHROME", "PL-86S22", "chrome", 6 + 5 / 8],
  ["PL-86S22 MATTE BLACK", "PL-86S22", "matte-black", 6 + 5 / 8],
] as const;

const SHOWER_SYSTEM_PROFILES: VerifiedPelicanBathroomFixtureProfile[] = SHOWER_SYSTEM_SOURCES.map(
  ([code, model, finish, reach]) => ({
    id: `pelican-shower-system-${model.toLowerCase()}-${finish}`,
    pelicanCode: code,
    name: `${code} Hydra Shower System`,
    kind: "shower-system" as const,
    // Illustrative wall occupancy: the trim plate sits on the wall, so the plan
    // footprint is that plate, not the spout reach.
    widthIn: 8,
    depthIn: 8,
    heightIn: 72,
    finish: finish as "brushed-nickel" | "chrome" | "matte-black",
    drain: null,
    planningOnly: true,
    tubFillerSpoutReachIn: reach,
    specificationUrl: `https://buildpelican.com/products/${model.toLowerCase()}`,
  }),
);

/**
 * Niches. The sheets publish the face plate, the structural opening and a
 * 3-17/32" recess depth.
 */
const SHOWER_NICHE_SOURCES = [
  ["PL-SN1614", 16, 14, "Single Shelf"],
  ["PL-SN1627", 27 + 1 / 16, 16 + 1 / 64, "Double Shelf"],
  ["PL-SN1639", 16 + 1 / 64, 39 + 1 / 32, "Triple Shelf"],
] as const;

const SHOWER_NICHE_PROFILES: VerifiedPelicanBathroomFixtureProfile[] = SHOWER_NICHE_SOURCES.map(
  ([code, widthIn, heightIn, label]) => ({
    id: `pelican-shower-niche-${code.toLowerCase()}`,
    pelicanCode: code,
    name: `${code} ${label} Shower Niche`,
    kind: "shower-niche" as const,
    widthIn,
    depthIn: 3 + 17 / 32,
    heightIn,
    finish: "acrylic-white" as const,
    drain: null,
    specificationUrl: `https://buildpelican.com/products/${code.toLowerCase()}`,
  }),
);

/**
 * Soap trays. Pelican publishes no exterior envelope for either, so these are
 * illustrative and marked planningOnly — the designer never claims a measured
 * fit for them.
 */
const SOAP_TRAY_PROFILES: VerifiedPelicanBathroomFixtureProfile[] = [
  {
    // A wall-mounted faucet that ships with a soap dish. Pelican publishes no
    // exterior envelope for it, so it is illustrative and marked planningOnly, the
    // same as the SMC trays.
    id: "pelican-soap-tray-pl-8461",
    pelicanCode: "PL-8461 BN",
    name: "PL-8461 Wall-Mounted Faucet with Soap Dish",
    kind: "soap-tray",
    widthIn: 8,
    depthIn: 6,
    heightIn: 6,
    finish: "brushed-nickel",
    drain: null,
    planningOnly: true,
    specificationUrl: "https://buildpelican.com/products/pl-8461",
  },
  {
    id: "pelican-soap-tray-pl-sd88-corner",
    pelicanCode: "PL-SD88 Corner",
    name: "PL-SD88 Corner Soap Tray",
    kind: "soap-tray",
    widthIn: 8,
    depthIn: 8,
    heightIn: 2,
    finish: "vitreous-china-white",
    drain: null,
    planningOnly: true,
    specificationUrl: "https://buildpelican.com/products/pl-sd88-corner",
  },
  {
    id: "pelican-soap-tray-pl-sd125-side",
    pelicanCode: "PL-SD125 Side",
    name: "PL-SD125 Side Soap Tray",
    kind: "soap-tray",
    widthIn: 12,
    depthIn: 5,
    heightIn: 2,
    finish: "vitreous-china-white",
    drain: null,
    planningOnly: true,
    specificationUrl: "https://buildpelican.com/products/pl-sd125-side",
  },
];

/** Everything the shower designer adds. Kept separate so legacy codes win. */
export const SHOWER_FIXTURE_PROFILES: readonly VerifiedPelicanBathroomFixtureProfile[] = [
  ...SHOWER_PAN_PROFILES,
  ...SHOWER_SURROUND_PROFILES,
  ...SHOWER_SYSTEM_PROFILES,
  ...SHOWER_NICHE_PROFILES,
  ...SOAP_TRAY_PROFILES,
];

/** The full list the Designer and the quote both resolve against. */
export const ALL_PELICAN_BATHROOM_FIXTURE_PROFILES: readonly VerifiedPelicanBathroomFixtureProfile[] = [
  ...VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES,
  ...SHOWER_FIXTURE_PROFILES,
];

function normalizeCode(code: string | null | undefined) {
  return (code ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Case-insensitive match on a normalised SKU.
 *
 * Supplier codes are not consistently cased: pans are `PL-SMC6030L`, surrounds
 * are `PL-483696 Marble`, taps are `PL-86H55 CHROME`. The catalog stores the
 * supplier's own casing, so comparing on exact text would silently fail to
 * resolve a real product.
 */
function sameCode(left: string, right: string): boolean {
  return left.toUpperCase() === right.toUpperCase();
}

/** Exact profile only: a product image without a dimensioned source sheet is not enough. */
/**
 * Resolve a purchasable catalog code to the technical-sheet code whose measured
 * envelope it shares.
 *
 * The catalog and the specification sheets name the same product differently: the
 * catalog appends the finish in its own style ("CHR" / "BN" / "MB"), a generation
 * suffix ("PL-86S22S" for the PL-86S22 model), a tile-flange suffix ("…CSO" /
 * "…LSO" / "…RSO"), or a panel décor ("Marble", "White Wood"). Those rows are the
 * products a shopper actually buys, so each must resolve to a sheet's envelope — or
 * the part cannot be placed in the plan at all.
 *
 * Returns null when the code already matches a profile directly, or when nothing
 * published covers it.
 */
export function showerBaseCodeForCatalogRow(normalized: string): string | null {
  const finish = /\s+(BN|CHR|MB)$/.exec(normalized)?.[1] ?? null;
  const FINISH_SHEET_NAME: Record<string, string> = { CHR: "CHROME", BN: "BRUSHED NICKEL", MB: "MATTE BLACK" };
  const decor = /\s+(BRICK|GREY WOOD|MARBLE|WHITE WOOD)$/i.test(normalized);

  // Sliding and bypass doors: the catalogue code carries a size token and the
  // finish, and the sheet is the shared PL-03A42S envelope.
  if (/^PL-03[BD]\d{2}[ST]SO\s+(?:BN|CHR|MB)$/.test(normalized)) return "PL-03A42S";
  if (/^PL-03A42S60\s+(?:BN|CHR|MB)$/.test(normalized)) return "PL-03A42S";
  if (/^PL-03A42T60\s+(?:BN|CHR|MB)$/.test(normalized)) return "PL-03A42T";
  if (/^PL-03A11S\d{2}\s+(?:BN|CHR|MB)$/.test(normalized)) return "PL-03A42S";
  if (/^PL-03[ABD]\d{2}TS[OL]?\s+(?:BN|CHR|MB)$/.test(normalized)) return "PL-03A42T";

  // A Hydra system: the model plus the catalogue's finish token. "PL-86S22S CHR"
  // is the PL-86S22 sheet in chrome; "PL-86H55T/S BN" is the PL-86H55 sheet.
  if (finish && /^PL-86[AHKS]\d{2}[ST]?(?:\/S)?$/.test(normalized.replace(/\s+(?:BN|CHR|MB)$/, ""))) {
    const model = normalized.replace(/\s+(?:BN|CHR|MB)$/, "").replace(/^PL-(86[AHKS]\d{2})[ST]?(?:\/S)?$/, "PL-$1");
    return `${model} ${FINISH_SHEET_NAME[finish]}`;
  }

  // A panel set's décor: the 74" tub panels are sold as PL-603274 / PL-603674 and
  // resolve to the "T" sheets; the 96" sets resolve directly.
  if (decor) {
    // Keep the décor: the profile list is per décor ("PL-603696 Marble"), so the
    // resolved code must carry it or the lookup misses.
    const decorToken = /\s+((?:BRICK|GREY WOOD|MARBLE|WHITE WOOD))$/i.exec(normalized)?.[1] ?? "";
    const model = normalized.replace(/\s+(?:BRICK|GREY WOOD|MARBLE|WHITE WOOD)$/i, "");
    if (/^PL-603(?:074|274|674)$/.test(model)) return `${model}T ${decorToken}`.trim();
    if (/^PL-(?:483696|603096|603296|603696)$/.test(model)) return `${model} ${decorToken}`.trim();
  }

  // A tile-flange pan ("…CSO" / "…LSO" / "…RSO") shares its base's envelope.
  const ada = /^(PL-0\d{5}ADA)SO$/.exec(normalized);
  if (ada) return ada[1]!;
  const flange = /^(PL-(?:0\d{5}|SMC\d{4}))[CLR]SO$/.exec(normalized);
  if (flange) {
    const base = flange[1]!;
    const drain = normalized.endsWith("LSO") ? "L" : normalized.endsWith("RSO") ? "R" : "C";
    return `${base}${drain}`;
  }

  // A wall-mounted faucet that ships with a soap dish is the soap-dish product.
  if (/^PL-8461\s+(?:BN|CHR|MB)$/.test(normalized)) return "PL-8461 BN";

  // Pelican sells the alcove tubs both with and without the NSO suffix; the sheet
  // is the same drain-side drawing.
  if (/^(PL-028(?:49|50|51)[LR])NSO$/.test(normalized)) return normalized.replace(/NSO$/, "");

  return null;
}

export function verifiedPelicanBathroomFixtureProfile(
  code: string | null | undefined,
): VerifiedPelicanBathroomFixtureProfile | null {
  const normalized = normalizeCode(code);
  // Existing profiles win over the shower-designer additions, so a legacy code
  // can never be shadowed by a newer entry that happens to share its prefix.
  const direct = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.find((profile) => sameCode(profile.pelicanCode, normalized))
    ?? SHOWER_FIXTURE_PROFILES.find((profile) => sameCode(profile.pelicanCode, normalized));
  if (direct) return direct;
  // Current active catalog records carry finish / panel décor suffixes, while
  // the official technical sheet describes the shared physical envelope. Keep
  // the selected purchasable identity without inventing finish-specific sizes.
  const baseCode = showerBaseCodeForCatalogRow(normalized);
  const shared = baseCode ? ALL_PELICAN_BATHROOM_FIXTURE_PROFILES.find((profile) => sameCode(profile.pelicanCode, baseCode)) : null;
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
