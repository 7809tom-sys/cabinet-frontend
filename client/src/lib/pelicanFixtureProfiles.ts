/**
 * Source-verified, measured fixture profiles used by the kitchen Designer.
 *
 * These are deliberately small and additive. A product is listed only after a
 * Pelican technical source provides the dimensions required to place it safely.
 * The profile creates measured parametric geometry; it never treats a catalog
 * photo, product thumbnail, or room image as a 3D model or material texture.
 */

export type VerifiedPelicanSinkProfile = {
  id: string;
  pelicanCode: string;
  name: string;
  installation: "apron-front-undermount" | "undermount";
  sinkType: "farmhouse" | "single";
  apronFront: boolean;
  exteriorWidthIn: number;
  exteriorDepthIn: number;
  exteriorHeightIn: number;
  bowlWidthIn: number;
  bowlDepthIn: number;
  bowlHeightIn: number;
  /** Number of source-verified interior bowls; omitted profiles are single-bowl. */
  bowlCount?: 1 | 2;
  /** Individually measured bowl widths for asymmetric two-bowl sink profiles. */
  bowlWidthsIn?: readonly [number, number];
  /** Individually measured bowl depths for asymmetric two-bowl sink profiles. */
  bowlDepthsIn?: readonly [number, number];
  /** Individually measured bowl heights for stepped two-bowl sink profiles. */
  bowlHeightsIn?: readonly [number, number];
  /** Source-documented inset from the bowl's right edge to its drain center. */
  drainInsetRightIn?: number;
  /** Source-documented inset from the bowl's rear edge to its drain center. */
  drainInsetBackIn?: number;
  /** Source-documented physical sink finish persisted for deterministic fixture rendering. */
  surfaceFinish?: "stainless-steel" | "gunmetal-black" | "vitreous-china" | "vitreous-china-black" | "vitreous-china-bone" | "vitreous-china-grey";
  minimumCabinetWidthIn: number;
  specificationUrl: string;
};

export type VerifiedPelicanFaucetProfile = {
  id: string;
  pelicanCode: string;
  name: string;
  installation: "single-hole" | "wall-mounted-8-inch-center";
  overallHeightIn: number;
  spoutLengthIn: number;
  spoutHeightIn: number;
  profile: "pull-down" | "standard-arc" | "pull-out" | "articulated-swing" | "wall-mounted-bridge";
  finish: "brushed-nickel" | "matte-black" | "brushed-gold" | "chrome" | "oil-rubbed-bronze";
  /** Required only by a source-documented 8-inch-center wall-mounted faucet. */
  centerSpreadIn?: number;
  /** Pelican publishes fixture dimensions, not the project's finished-countertop mounting elevation. */
  requiresProjectSpecificMountHeight?: true;
  specificationUrl: string;
};

/**
 * A wall-mounted pot filler is deliberately separate from a sink-mounted
 * faucet. Its manufacturer dimensions describe the fixture itself, but not a
 * universal finished-countertop-to-wall-mount installation height. Any future
 * Designer placement must therefore require a project-specific, documented
 * mounting datum and attach only to the wall behind a range or cooktop.
 */
export type VerifiedPelicanPotFillerProfile = {
  id: string;
  pelicanCode: string;
  name: string;
  installation: "wall-mounted-in-wall-cold-water";
  profile: "dual-jointed-folding-swing-arm";
  finish: "brushed-nickel" | "matte-black" | "brushed-gold" | "chrome";
  /** Maximum source-published spout reach from the wall-mounted fixture. */
  spoutReachIn: number;
  /** Full source-published folded/open overall horizontal span. */
  overallSpanIn: number;
  /** Source-dimensioned articulated arm datum. */
  armDatumIn: number;
  /** Source-published fixture height; not an installation height above a counter. */
  fixtureHeightIn: number;
  /** Source-published outlet datum. */
  outletDatumIn: number;
  maximumFlowGpmAt60Psi: number;
  /** A project drawing or site measurement must supply this missing mount datum. */
  requiresProjectSpecificMountHeight: true;
  specificationUrl: string;
  installationUrl: string;
};

const VERIFIED_PELICAN_SINKS: Record<string, VerifiedPelicanSinkProfile> = {
  "PL-3099": {
    id: "pelican-pl-3099-pearl-porcelain-undermount-vanity", pelicanCode: "PL-3099", name: "PL-3099 Pearl Series Porcelain Undermount Vanity Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 20.875, exteriorDepthIn: 15.625, exteriorHeightIn: 7.75, bowlWidthIn: 18, bowlDepthIn: 13, bowlHeightIn: 6, surfaceFinish: "vitreous-china", minimumCabinetWidthIn: 20.875,
    specificationUrl: "https://cdn.accentuate.io/7876660789388/1729870296544/PL-3099-Spec-Sheet.pdf?v=1729870296544",
  },
  "PL-3608": {
    id: "pelican-pl-3608-pearl-porcelain-undermount-vanity", pelicanCode: "PL-3608", name: "PL-3608 Pearl Series Porcelain Undermount Vanity Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 19, exteriorDepthIn: 16, exteriorHeightIn: 5.5, bowlWidthIn: 16.5, bowlDepthIn: 13.5, bowlHeightIn: 3.5, surfaceFinish: "vitreous-china", minimumCabinetWidthIn: 19,
    specificationUrl: "https://cdn.accentuate.io/7876647551116/1729870423997/PL-3608-Spec-Sheet.pdf?v=1729870423997",
  },
  "PL-HA109": {
    id: "pelican-pl-ha109-stainless-undermount", pelicanCode: "PL-HA109", name: "PL-HA109 Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 30, exteriorDepthIn: 18, exteriorHeightIn: 10, bowlWidthIn: 28, bowlDepthIn: 16, bowlHeightIn: 10, drainInsetBackIn: 1, minimumCabinetWidthIn: 30,
    specificationUrl: "https://cdn.accentuate.io/7876665442444/1729872829476/PL-HA109-R0.pdf?v=1729872829477",
  },
  "PL-HA109 ADA": {
    id: "pelican-pl-ha109-ada-stainless-undermount", pelicanCode: "PL-HA109 ADA", name: "PL-HA109 ADA Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 30, exteriorDepthIn: 18, exteriorHeightIn: 5.5, bowlWidthIn: 28, bowlDepthIn: 16, bowlHeightIn: 5.5, minimumCabinetWidthIn: 30,
    specificationUrl: "https://cdn.accentuate.io/7876665442444/1742318026789/PL-HA109-ADA-R0-18g-Spec.pdf?v=1742318026789",
  },
  "PL-HA115": {
    id: "pelican-pl-ha115-r0-stainless-undermount", pelicanCode: "PL-HA115", name: "PL-HA115 R0 Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 32, exteriorDepthIn: 18, exteriorHeightIn: 10, bowlWidthIn: 30, bowlDepthIn: 16, bowlHeightIn: 10, drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876665966732/1729873248748/PL-HA115-R0.pdf?v=1729873248749",
  },
  "PL-HA104": {
    id: "pelican-pl-ha104-r0-stainless-undermount", pelicanCode: "PL-HA104", name: "PL-HA104 R0 Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 17, exteriorDepthIn: 18, exteriorHeightIn: 10, bowlWidthIn: 15, bowlDepthIn: 16, bowlHeightIn: 10, drainInsetBackIn: 1, minimumCabinetWidthIn: 18,
    specificationUrl: "https://cdn.accentuate.io/7876665278604/1729872420755/PL-HA104-R0.pdf?v=1729872420755",
  },
  "PL-HA108": {
    id: "pelican-pl-ha108-r0-stainless-undermount", pelicanCode: "PL-HA108", name: "PL-HA108 R0 Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 23, exteriorDepthIn: 18, exteriorHeightIn: 10, bowlWidthIn: 21, bowlDepthIn: 16, bowlHeightIn: 10, drainInsetBackIn: 1, minimumCabinetWidthIn: 24,
    specificationUrl: "https://cdn.accentuate.io/7876665376908/1729872673252/PL-HA108-R0.pdf?v=1729872673252",
  },
  "PL-HA111": {
    id: "pelican-pl-ha111-r0-stainless-undermount", pelicanCode: "PL-HA111", name: "PL-HA111 R0 Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 27, exteriorDepthIn: 18, exteriorHeightIn: 10, bowlWidthIn: 25, bowlDepthIn: 16, bowlHeightIn: 10, drainInsetBackIn: 1, minimumCabinetWidthIn: 27,
    specificationUrl: "https://cdn.accentuate.io/7876665802892/1729873006384/PL-HA111-R0.pdf?v=1729873006384",
  },
  "PL-HA117": {
    id: "pelican-pl-ha117-r0-stainless-double-bowl-undermount", pelicanCode: "PL-HA117", name: "PL-HA117 R0 Stainless Steel Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 32, exteriorDepthIn: 18, exteriorHeightIn: 10, bowlWidthIn: 14.5, bowlDepthIn: 16, bowlHeightIn: 10, bowlCount: 2, drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876666130572/1729873362647/PL-HA117-R0.pdf?v=1729873362647",
  },
  "PL-HA119": {
    id: "pelican-pl-ha119-r19-stainless-offset-drain-undermount", pelicanCode: "PL-HA119", name: "PL-HA119 R19 Handmade Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 31.25, exteriorDepthIn: 18, exteriorHeightIn: 10, bowlWidthIn: 29.25, bowlDepthIn: 16, bowlHeightIn: 9.5, drainInsetRightIn: 5, drainInsetBackIn: 5, minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/8978112544908/1775067326529/PL-HA119-R15.pdf?v=1775067326529",
  },
  "PL-HA126": {
    id: "pelican-pl-ha126-r0-stainless-asymmetric-double-bowl-undermount", pelicanCode: "PL-HA126", name: "PL-HA126 R0 Stainless Steel Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 31.25, exteriorDepthIn: 20.5, exteriorHeightIn: 10, bowlWidthIn: 14, bowlDepthIn: 18, bowlHeightIn: 10, bowlCount: 2, bowlWidthsIn: [14, 13.5], bowlDepthsIn: [18, 16], drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876666523788/1729873836731/PL-HA126-R0.pdf?v=1729873836732",
  },
  "PL-HA128": {
    id: "pelican-pl-ha128-r15-stainless-double-bowl-farmhouse", pelicanCode: "PL-HA128", name: "PL-HA128 R15 Handmade Double-Bowl Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 33, exteriorDepthIn: 21, exteriorHeightIn: 10, bowlWidthIn: 14.5, bowlDepthIn: 16, bowlHeightIn: 10, bowlCount: 2, drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 33,
    specificationUrl: "https://cdn.accentuate.io/7876666720396/1729873935066/PL-HA128-R15-%282%29.pdf?v=1729873935067",
  },
  "PL-HA135": {
    id: "pelican-pl-ha135-r0-retrofit-stainless-farmhouse", pelicanCode: "PL-HA135", name: "PL-HA135 R0 Retrofit Stainless Steel Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 35.5, exteriorDepthIn: 21.25, exteriorHeightIn: 9.375, bowlWidthIn: 32.5, bowlDepthIn: 17.25, bowlHeightIn: 9.125, minimumCabinetWidthIn: 36,
    specificationUrl: "https://cdn.accentuate.io/8978112643212/1775067586424/PL-HA135-R0.pdf?v=1775067586424",
  },
  "PL-GMB135": {
    id: "pelican-pl-gmb135-r0-gunmetal-retrofit-farmhouse", pelicanCode: "PL-GMB135", name: "PL-GMB135 R0 Gunmetal Retrofit Stainless Steel Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 35.5, exteriorDepthIn: 21.25, exteriorHeightIn: 9.375, bowlWidthIn: 32.5, bowlDepthIn: 17.25, bowlHeightIn: 9.125, surfaceFinish: "gunmetal-black", minimumCabinetWidthIn: 36,
    specificationUrl: "https://cdn.accentuate.io/8978112348300/1775067777812/PL-GMB135-R0.pdf?v=1775067777812",
  },
  "PL-HA136": {
    id: "pelican-pl-ha136-r15-stainless-asymmetric-double-bowl-farmhouse", pelicanCode: "PL-HA136", name: "PL-HA136 R15 Handmade Double-Bowl Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 33, exteriorDepthIn: 21, exteriorHeightIn: 10, bowlWidthIn: 17, bowlDepthIn: 16, bowlHeightIn: 10, bowlCount: 2, bowlWidthsIn: [17, 12], drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 33,
    specificationUrl: "https://cdn.accentuate.io/7876666949772/1729874053747/PL-HA136-R15.pdf?v=1729874053747",
  },
  "PL-HA139": {
    id: "pelican-pl-ha139-r15-stainless-asymmetric-double-bowl-farmhouse", pelicanCode: "PL-HA139", name: "PL-HA139 R15 Handmade Double-Bowl Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 33, exteriorDepthIn: 21, exteriorHeightIn: 10, bowlWidthIn: 12, bowlDepthIn: 16, bowlHeightIn: 10, bowlCount: 2, bowlWidthsIn: [12, 17], drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 33,
    specificationUrl: "https://cdn.accentuate.io/7876666982540/1729874196839/PL-HA139-R15.pdf?v=1729874196839",
  },
  "PL-HA130": {
    id: "pelican-pl-ha130-r0-stainless-double-bowl-farmhouse", pelicanCode: "PL-HA130", name: "PL-HA130 R0 Handmade Double-Bowl Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 36, exteriorDepthIn: 21, exteriorHeightIn: 10, bowlWidthIn: 16, bowlDepthIn: 16, bowlHeightIn: 10, bowlCount: 2, drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 36,
    specificationUrl: "https://cdn.accentuate.io/7876666818700/1729873984961/PL-HA130-R0.pdf?v=1729873984961",
  },
  "PL-HA122": {
    id: "pelican-pl-ha122-r15-stainless-farmhouse", pelicanCode: "PL-HA122", name: "PL-HA122 R15 Handmade Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 32.875, exteriorDepthIn: 20.75, exteriorHeightIn: 10, bowlWidthIn: 30, bowlDepthIn: 16, bowlHeightIn: 10, drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 33,
    specificationUrl: "https://cdn.accentuate.io/7876666261644/1729873641877/PL-HA122-R15-(1).pdf?v=1729873641877",
  },
  "PL-HA118": {
    id: "pelican-pl-ha118-r15-stainless-farmhouse", pelicanCode: "PL-HA118", name: "PL-HA118 R15 Handmade Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 30, exteriorDepthIn: 21, exteriorHeightIn: 10, bowlWidthIn: 27, bowlDepthIn: 16, bowlHeightIn: 10, drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 30,
    specificationUrl: "https://cdn.accentuate.io/7876666196108/1729873514105/PL-HA118-R15.pdf?v=1729873514105",
  },
  "PL-HA125": {
    id: "pelican-pl-ha125-r0-stainless-asymmetric-double-bowl-farmhouse", pelicanCode: "PL-HA125", name: "PL-HA125 R0 Handmade Double-Bowl Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 35.875, exteriorDepthIn: 20.75, exteriorHeightIn: 10, bowlWidthIn: 19, bowlDepthIn: 16, bowlHeightIn: 10, bowlCount: 2, bowlWidthsIn: [19, 13], drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 36,
    specificationUrl: "https://cdn.accentuate.io/7876666392716/1729873787540/PL-HA125-R0.pdf?v=1729873787540",
  },
  "PL-HA124": {
    id: "pelican-pl-ha124-r0-stainless-farmhouse", pelicanCode: "PL-HA124", name: "PL-HA124 R0 Handmade Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 35.875, exteriorDepthIn: 20.75, exteriorHeightIn: 10, bowlWidthIn: 33, bowlDepthIn: 16, bowlHeightIn: 10, drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 36,
    specificationUrl: "https://cdn.accentuate.io/7876666294412/1729873733866/PL-HA124-R0.pdf?v=1729873733866",
  },
  "PL-HA144": {
    id: "pelican-pl-ha144-r10-stainless-farmhouse", pelicanCode: "PL-HA144", name: "PL-HA144 R10 Handmade Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 33, exteriorDepthIn: 21, exteriorHeightIn: 10, bowlWidthIn: 31, bowlDepthIn: 16, bowlHeightIn: 9.75, drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 33,
    specificationUrl: "https://cdn.accentuate.io/8978112807052/1775059262434/PL-HA144-R10.pdf?v=1775059262434",
  },
  "PL-HA148": {
    id: "pelican-pl-ha148-r10-stainless-farmhouse", pelicanCode: "PL-HA148", name: "PL-HA148 R10 Handmade Farmhouse Sink",
    installation: "apron-front-undermount", sinkType: "farmhouse", apronFront: true,
    exteriorWidthIn: 36, exteriorDepthIn: 21, exteriorHeightIn: 10, bowlWidthIn: 34, bowlDepthIn: 16, bowlHeightIn: 9.75, drainInsetBackIn: 120 / 25.4, minimumCabinetWidthIn: 36,
    specificationUrl: "https://cdn.accentuate.io/8978112938124/1775058900343/PL-HA148-R10.pdf?v=1775058900343",
  },
  "PL-VS3218": {
    id: "pelican-pl-vs3218-stainless-undermount", pelicanCode: "PL-VS3218", name: "PL-VS3218 Signature Series Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 32.125, exteriorDepthIn: 18, exteriorHeightIn: 9, bowlWidthIn: 30.125, bowlDepthIn: 16, bowlHeightIn: 9, minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876668227724/1729876598079/PL-VS3218.pdf?v=1758834311979",
  },
  "PL-VS3018": {
    id: "pelican-pl-vs3018-stainless-undermount", pelicanCode: "PL-VS3018", name: "PL-VS3018 Signature Series Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 30, exteriorDepthIn: 18, exteriorHeightIn: 9, bowlWidthIn: 28, bowlDepthIn: 16, bowlHeightIn: 9, minimumCabinetWidthIn: 30,
    specificationUrl: "https://cdn.accentuate.io/7876667965580/1729876393881/PL-VS3018.pdf?v=1758828574961",
  },
  "PL-VS3018 ADA": {
    id: "pelican-pl-vs3018-ada-shallow-stainless-undermount", pelicanCode: "PL-VS3018 ADA", name: "PL-VS3018 ADA Signature Series Shallow Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 30, exteriorDepthIn: 18, exteriorHeightIn: 5.5, bowlWidthIn: 28, bowlDepthIn: 16, bowlHeightIn: 5.5, minimumCabinetWidthIn: 30,
    specificationUrl: "https://cdn.accentuate.io/7876667965580/1729876415168/PL-VS3018-ADA.pdf?v=1742392774085",
  },
  "PL-VS2718": {
    id: "pelican-pl-vs2718-stainless-undermount", pelicanCode: "PL-VS2718", name: "PL-VS2718 Signature Series Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 27, exteriorDepthIn: 18, exteriorHeightIn: 9, bowlWidthIn: 25, bowlDepthIn: 16, bowlHeightIn: 9, minimumCabinetWidthIn: 27,
    specificationUrl: "https://cdn.accentuate.io/7876667900044/1729876262131/PL-VS2718.pdf?v=1742392624082",
  },
  "PL-VS1815": {
    id: "pelican-pl-vs1815-stainless-undermount", pelicanCode: "PL-VS1815", name: "PL-VS1815 Signature Series Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 18.5, exteriorDepthIn: 15, exteriorHeightIn: 7, bowlWidthIn: 16.5, bowlDepthIn: 13, bowlHeightIn: 7, minimumCabinetWidthIn: 21,
    specificationUrl: "https://cdn.accentuate.io/7876667375756/1729875932156/PL-VS1815.pdf?v=1742391310508",
  },
  "PL-VS1513": {
    id: "pelican-pl-vs1513-stainless-compact-undermount", pelicanCode: "PL-VS1513", name: "PL-VS1513 Signature Series Stainless Steel Compact Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 15, exteriorDepthIn: 12.75, exteriorHeightIn: 6.75, bowlWidthIn: 13, bowlDepthIn: 10.75, bowlHeightIn: 6.75, minimumCabinetWidthIn: 18,
    specificationUrl: "https://cdn.accentuate.io/7876667211916/1729875794169/PL-VS1513.pdf?v=1742391224100",
  },
  "PL-VS2118": {
    id: "pelican-pl-vs2118-stainless-undermount", pelicanCode: "PL-VS2118", name: "PL-VS2118 Signature Series Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 20.625, exteriorDepthIn: 17.875, exteriorHeightIn: 9, bowlWidthIn: 18.625, bowlDepthIn: 15.875, bowlHeightIn: 9, minimumCabinetWidthIn: 21,
    specificationUrl: "https://cdn.accentuate.io/7876667408524/1729875967180/PL-VS2118.pdf?v=1742391427922",
  },
  "PL-VS2318": {
    id: "pelican-pl-vs2318-stainless-undermount", pelicanCode: "PL-VS2318", name: "PL-VS2318 Signature Series Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 23, exteriorDepthIn: 17.75, exteriorHeightIn: 9, bowlWidthIn: 21, bowlDepthIn: 15.75, bowlHeightIn: 9, minimumCabinetWidthIn: 24,
    specificationUrl: "https://cdn.accentuate.io/7876667474060/1729876113634/PL-VS2318-.pdf?v=1742392230407",
  },
  "PL-VS4060": {
    id: "pelican-pl-vs4060-stainless-stepped-double-bowl-undermount", pelicanCode: "PL-VS4060", name: "PL-VS4060 Signature Series Stainless Steel Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 32.125, exteriorDepthIn: 20.625, exteriorHeightIn: 9, bowlWidthIn: 13, bowlDepthIn: 16.5, bowlHeightIn: 7, bowlCount: 2, bowlWidthsIn: [13, 15.875], bowlDepthsIn: [16.5, 18.625], bowlHeightsIn: [7, 9], minimumCabinetWidthIn: 33,
    specificationUrl: "https://cdn.accentuate.io/7876668522636/1729876762122/PL-VS4060.pdf?v=1742393327883",
  },
  "PL-VS4040": {
    id: "pelican-pl-vs4040-stainless-equal-double-bowl-undermount", pelicanCode: "PL-VS4040", name: "PL-VS4040 Signature Series Stainless Steel Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 29.125, exteriorDepthIn: 18.5, exteriorHeightIn: 8, bowlWidthIn: 13, bowlDepthIn: 16.5, bowlHeightIn: 8, bowlCount: 2, minimumCabinetWidthIn: 30,
    specificationUrl: "https://cdn.accentuate.io/7876668391564/1729876706766/PL-VS4040.pdf?v=1742393226362",
  },
  "PL-VS5050": {
    id: "pelican-pl-vs5050-stainless-equal-double-bowl-undermount", pelicanCode: "PL-VS5050", name: "PL-VS5050 Signature Series Stainless Steel Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 32.125, exteriorDepthIn: 18, exteriorHeightIn: 9, bowlWidthIn: 14.5, bowlDepthIn: 16, bowlHeightIn: 9, bowlCount: 2, minimumCabinetWidthIn: 33,
    specificationUrl: "https://cdn.accentuate.io/7876668752012/1729876810836/PL-VS5050.pdf?v=1758902044753",
  },
  "PL-VS5050 ADA": {
    id: "pelican-pl-vs5050-ada-stainless-shallow-double-bowl-undermount", pelicanCode: "PL-VS5050 ADA", name: "PL-VS5050 ADA Stainless Steel Shallow Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 32.125, exteriorDepthIn: 18, exteriorHeightIn: 5.5, bowlWidthIn: 14.5, bowlDepthIn: 16, bowlHeightIn: 5.5, bowlCount: 2, minimumCabinetWidthIn: 33,
    specificationUrl: "https://cdn.accentuate.io/7876668752012/1729876868211/PL-VS5050-ADA.pdf?v=1742393422746",
  },
  "PL-VR5050": {
    id: "pelican-pl-vr5050-r20-stainless-equal-double-bowl-undermount", pelicanCode: "PL-VR5050", name: "PL-VR5050 R20 Urban Series Stainless Steel Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 31, exteriorDepthIn: 18, exteriorHeightIn: 9, bowlWidthIn: 14, bowlDepthIn: 16, bowlHeightIn: 9, bowlCount: 2, minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876651090060/1729875615547/PL-VR5050-R20.pdf?v=1742390973929",
  },
  "PL-VR6040": {
    id: "pelican-pl-vr6040-r20-stainless-stepped-double-bowl-undermount", pelicanCode: "PL-VR6040", name: "PL-VR6040 R20 Urban Series Stainless Steel Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 31.5, exteriorDepthIn: 20.5, exteriorHeightIn: 9, bowlWidthIn: 15.75, bowlDepthIn: 18.5, bowlHeightIn: 9, bowlCount: 2, bowlWidthsIn: [15.75, 12.75], bowlDepthsIn: [18.5, 16], bowlHeightsIn: [9, 8], minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876651253900/1729875738021/PL-VR6040-R20.pdf?v=1742391112882",
  },
  "PL-VR2318": {
    id: "pelican-pl-vr2318-r20-stainless-compact-undermount", pelicanCode: "PL-VR2318", name: "PL-VR2318 R20 Urban Series Stainless Steel Compact Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 23, exteriorDepthIn: 18, exteriorHeightIn: 9, bowlWidthIn: 21, bowlDepthIn: 16, bowlHeightIn: 9, minimumCabinetWidthIn: 24,
    specificationUrl: "https://cdn.accentuate.io/7876650336396/1729875037735/PL-VR2318-R20.pdf?v=1742390106955",
  },
  "PL-VR1816": {
    id: "pelican-pl-vr1816-r20-stainless-compact-undermount", pelicanCode: "PL-VR1816", name: "PL-VR1816 R20 Urban Series Stainless Steel Compact Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 18, exteriorDepthIn: 16, exteriorHeightIn: 9, bowlWidthIn: 16, bowlDepthIn: 14, bowlHeightIn: 9, minimumCabinetWidthIn: 21,
    specificationUrl: "https://cdn.accentuate.io/7876649877644/1729874954761/PL-VR1816-R20.pdf?v=1742389823793",
  },
  "PL-VR2718": {
    id: "pelican-pl-vr2718-r20-stainless-undermount", pelicanCode: "PL-VR2718", name: "PL-VR2718 R20 Urban Series Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 27, exteriorDepthIn: 18, exteriorHeightIn: 9, bowlWidthIn: 25, bowlDepthIn: 16, bowlHeightIn: 9, minimumCabinetWidthIn: 27,
    specificationUrl: "https://cdn.accentuate.io/7876650631308/1729875123836/PL-VR2718-R20.pdf?v=1742390450234",
  },
  "PL-VR2718 ADA": {
    id: "pelican-pl-vr2718-ada-shallow-stainless-undermount", pelicanCode: "PL-VR2718 ADA", name: "PL-VR2718 ADA Urban Series Shallow Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 27, exteriorDepthIn: 18, exteriorHeightIn: 5.5, bowlWidthIn: 25, bowlDepthIn: 16, bowlHeightIn: 5.5, minimumCabinetWidthIn: 27,
    specificationUrl: "https://cdn.accentuate.io/7876650500236/1729875077545/PL-VR2718-ADA.pdf?v=1742390303513",
  },
  "PL-VR3118": {
    id: "pelican-pl-vr3118-r20-stainless-undermount", pelicanCode: "PL-VR3118", name: "PL-VR3118 R20 Urban Series Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 31, exteriorDepthIn: 18, exteriorHeightIn: 9, bowlWidthIn: 29, bowlDepthIn: 16, bowlHeightIn: 9, minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876650827916/1729875323884/PL-VR3118-R20.pdf?v=1742390804855",
  },
  "PL-VR3118 ADA": {
    id: "pelican-pl-vr3118-ada-shallow-stainless-undermount", pelicanCode: "PL-VR3118 ADA", name: "PL-VR3118 ADA Urban Series Shallow Stainless Steel Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 31, exteriorDepthIn: 18, exteriorHeightIn: 5.5, bowlWidthIn: 29, bowlDepthIn: 16, bowlHeightIn: 5.5, minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876650729612/1729875276603/PL-VR3118-ADA.pdf?v=1742390573768",
  },
  "PL-VR4060": {
    id: "pelican-pl-vr4060-r20-stainless-stepped-double-bowl-undermount", pelicanCode: "PL-VR4060", name: "PL-VR4060 R20 Urban Series Stainless Steel Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 31.5, exteriorDepthIn: 20.5, exteriorHeightIn: 9, bowlWidthIn: 12.75, bowlDepthIn: 16, bowlHeightIn: 8, bowlCount: 2, bowlWidthsIn: [12.75, 15.75], bowlDepthsIn: [16, 18.5], bowlHeightsIn: [8, 9], minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876650958988/1742389325891/_PL-VR4060-R20.pdf?v=1742389325891",
  },
  "PL-VS3070": {
    id: "pelican-pl-vs3070-stainless-stepped-double-bowl-undermount", pelicanCode: "PL-VS3070", name: "PL-VS3070 Signature Series Stainless Steel Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 31.5, exteriorDepthIn: 20.5, exteriorHeightIn: 9, bowlWidthIn: 10.625, bowlDepthIn: 16, bowlHeightIn: 7, bowlCount: 2, bowlWidthsIn: [10.625, 17.75], bowlDepthsIn: [16, 18.5], bowlHeightsIn: [7, 9], minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876668129420/1729876545002/PL-VS3070.pdf?v=1742392860993",
  },
  "PL-VS7030": {
    id: "pelican-pl-vs7030-stainless-stepped-double-bowl-undermount", pelicanCode: "PL-VS7030", name: "PL-VS7030 Signature Series Stainless Steel Double-Bowl Undermount Sink",
    installation: "undermount", sinkType: "single", apronFront: false,
    exteriorWidthIn: 31.5, exteriorDepthIn: 20.5, exteriorHeightIn: 9, bowlWidthIn: 17.75, bowlDepthIn: 18.5, bowlHeightIn: 9, bowlCount: 2, bowlWidthsIn: [17.75, 10.625], bowlDepthsIn: [18.5, 16], bowlHeightsIn: [9, 7], minimumCabinetWidthIn: 32,
    specificationUrl: "https://cdn.accentuate.io/7876669014156/1729877038011/PL-VS7030.pdf?v=1742393657703",
  },
};

const VERIFIED_PELICAN_FAUCETS: Record<string, VerifiedPelicanFaucetProfile> = {
  "PL-8112 BN": {
    id: "pelican-pl-8112-cascade-vanity-brushed-nickel", pelicanCode: "PL-8112 BN", name: "PL-8112 Cascade Series Vanity Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 12.4375, spoutLengthIn: 3.9375, spoutHeightIn: 7.6875, profile: "standard-arc", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876661543052/1729880913717/PL-8112-Spec-Sheet.pdf?v=1734119006276",
  },
  "PL-8112 CHR": {
    id: "pelican-pl-8112-cascade-vanity-chrome", pelicanCode: "PL-8112 CHR", name: "PL-8112 Cascade Series Vanity Faucet — Chrome",
    installation: "single-hole", overallHeightIn: 12.4375, spoutLengthIn: 3.9375, spoutHeightIn: 7.6875, profile: "standard-arc", finish: "chrome",
    specificationUrl: "https://cdn.accentuate.io/7876661543052/1729880913717/PL-8112-Spec-Sheet.pdf?v=1734119006276",
  },
  "PL-8203": {
    id: "pelican-pl-8203-fountain-pull-down", pelicanCode: "PL-8203", name: "PL-8203 Fountain Series Pull-Down Kitchen Faucet",
    installation: "single-hole", overallHeightIn: 27.1875, spoutLengthIn: 9.875, spoutHeightIn: 4.9375, profile: "pull-down", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876662329484/1729881091715/PL-8203-Spec-Sheet.pdf?v=1734119171551",
  },
  "PL-8207 BN": {
    id: "pelican-pl-8207-fountain-pull-down-brushed-nickel", pelicanCode: "PL-8207 BN", name: "PL-8207 Fountain Series Pull-Down Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 26.125, spoutLengthIn: 7.6875, spoutHeightIn: 6.5, profile: "pull-down", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876662395020/1729881131839/PL-8207-Spec-Sheet.pdf?v=1734119192469",
  },
  "PL-8207 MB": {
    id: "pelican-pl-8207-fountain-pull-down-matte-black", pelicanCode: "PL-8207 MB", name: "PL-8207 Fountain Series Pull-Down Kitchen Faucet — Matte Black",
    installation: "single-hole", overallHeightIn: 26.125, spoutLengthIn: 7.6875, spoutHeightIn: 6.5, profile: "pull-down", finish: "matte-black",
    specificationUrl: "https://cdn.accentuate.io/7876662395020/1729881131839/PL-8207-Spec-Sheet.pdf?v=1734119192469",
  },
  "PL-8237 BG": {
    id: "pelican-pl-8237-fountain-standard-arc-brushed-gold", pelicanCode: "PL-8237 BG", name: "PL-8237 Fountain Series Kitchen Faucet — Brushed Gold",
    installation: "single-hole", overallHeightIn: 12.8125, spoutLengthIn: 7.0625, spoutHeightIn: 8.375, profile: "standard-arc", finish: "brushed-gold",
    specificationUrl: "https://cdn.accentuate.io/7876664393868/1729881524238/PL-8237.pdf?v=1729881524238",
  },
  "PL-8237 BN": {
    id: "pelican-pl-8237-fountain-standard-arc-brushed-nickel", pelicanCode: "PL-8237 BN", name: "PL-8237 Fountain Series Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 12.8125, spoutLengthIn: 7.0625, spoutHeightIn: 8.375, profile: "standard-arc", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876664393868/1729881524238/PL-8237.pdf?v=1729881524238",
  },
  "PL-8237 CHR": {
    id: "pelican-pl-8237-fountain-standard-arc-chrome", pelicanCode: "PL-8237 CHR", name: "PL-8237 Fountain Series Kitchen Faucet — Chrome",
    installation: "single-hole", overallHeightIn: 12.8125, spoutLengthIn: 7.0625, spoutHeightIn: 8.375, profile: "standard-arc", finish: "chrome",
    specificationUrl: "https://cdn.accentuate.io/7876664393868/1729881524238/PL-8237.pdf?v=1729881524238",
  },
  "PL-8237 MB": {
    id: "pelican-pl-8237-fountain-standard-arc-matte-black", pelicanCode: "PL-8237 MB", name: "PL-8237 Fountain Series Kitchen Faucet — Matte Black",
    installation: "single-hole", overallHeightIn: 12.8125, spoutLengthIn: 7.0625, spoutHeightIn: 8.375, profile: "standard-arc", finish: "matte-black",
    specificationUrl: "https://cdn.accentuate.io/7876664393868/1729881524238/PL-8237.pdf?v=1729881524238",
  },
  "PL-8248 BN": {
    id: "pelican-pl-8248-fountain-pull-out-brushed-nickel", pelicanCode: "PL-8248 BN", name: "PL-8248 Fountain Series Pull-Out Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 12.375, spoutLengthIn: 10.0625, spoutHeightIn: 10.875, profile: "pull-out", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/8105530687628/1744289003241/PL-8248.pdf?v=1744289003241",
  },
  "PL-8248 CHR": {
    id: "pelican-pl-8248-fountain-pull-out-chrome", pelicanCode: "PL-8248 CHR", name: "PL-8248 Fountain Series Pull-Out Kitchen Faucet — Chrome",
    installation: "single-hole", overallHeightIn: 12.375, spoutLengthIn: 10.0625, spoutHeightIn: 10.875, profile: "pull-out", finish: "chrome",
    specificationUrl: "https://cdn.accentuate.io/8105530687628/1744289003241/PL-8248.pdf?v=1744289003241",
  },
  "PL-8248 MB": {
    id: "pelican-pl-8248-fountain-pull-out-matte-black", pelicanCode: "PL-8248 MB", name: "PL-8248 Fountain Series Pull-Out Kitchen Faucet — Matte Black",
    installation: "single-hole", overallHeightIn: 12.375, spoutLengthIn: 10.0625, spoutHeightIn: 10.875, profile: "pull-out", finish: "matte-black",
    specificationUrl: "https://cdn.accentuate.io/8105530687628/1744289003241/PL-8248.pdf?v=1744289003241",
  },
  "PL-8222 BN": {
    id: "pelican-pl-8222-fountain-pull-out-brushed-nickel", pelicanCode: "PL-8222 BN", name: "PL-8222 Fountain Series Pull-Out Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 9.5625, spoutLengthIn: 8.375, spoutHeightIn: 5.8125, profile: "pull-out", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876663148684/1729881399900/PL-8222-Spec-Sheet.pdf?v=1734119372824",
  },
  "PL-8206 BN": {
    id: "pelican-pl-8206-fountain-articulated-swing-brushed-nickel", pelicanCode: "PL-8206 BN", name: "PL-8206 Fountain Series Articulated Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 10.5, spoutLengthIn: 9.75, spoutHeightIn: 9.25, profile: "articulated-swing", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/8105530654860/1744229984387/PL-8206.pdf?v=1744229984387",
  },
  "PL-8206 CHR": {
    id: "pelican-pl-8206-fountain-articulated-swing-chrome", pelicanCode: "PL-8206 CHR", name: "PL-8206 Fountain Series Articulated Kitchen Faucet — Chrome",
    installation: "single-hole", overallHeightIn: 10.5, spoutLengthIn: 9.75, spoutHeightIn: 9.25, profile: "articulated-swing", finish: "chrome",
    specificationUrl: "https://cdn.accentuate.io/8105530654860/1744229984387/PL-8206.pdf?v=1744229984387",
  },
  "PL-8206 MB": {
    id: "pelican-pl-8206-fountain-articulated-swing-matte-black", pelicanCode: "PL-8206 MB", name: "PL-8206 Fountain Series Articulated Kitchen Faucet — Matte Black",
    installation: "single-hole", overallHeightIn: 10.5, spoutLengthIn: 9.75, spoutHeightIn: 9.25, profile: "articulated-swing", finish: "matte-black",
    specificationUrl: "https://cdn.accentuate.io/8105530654860/1744229984387/PL-8206.pdf?v=1744229984387",
  },
  "PL-8224 BN": {
    id: "pelican-pl-8224-fountain-pull-out-brushed-nickel", pelicanCode: "PL-8224 BN", name: "PL-8224 Fountain Series Pull-Out Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 19.3125, spoutLengthIn: 7.9375, spoutHeightIn: 10.25, profile: "pull-out", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876664131724/1729881432596/PL-8224-Spec-Sheet.pdf?v=1734119408878",
  },
  "PL-8224 ORB": {
    id: "pelican-pl-8224-fountain-pull-out-oil-rubbed-bronze", pelicanCode: "PL-8224 ORB", name: "PL-8224 Fountain Series Pull-Out Kitchen Faucet — Oil Rubbed Bronze",
    installation: "single-hole", overallHeightIn: 19.3125, spoutLengthIn: 7.9375, spoutHeightIn: 10.25, profile: "pull-out", finish: "oil-rubbed-bronze",
    specificationUrl: "https://cdn.accentuate.io/7876664131724/1729881432596/PL-8224-Spec-Sheet.pdf?v=1734119408878",
  },
  "PL-8210 BN": {
    id: "pelican-pl-8210-fountain-commercial-pull-down-brushed-nickel", pelicanCode: "PL-8210 BN", name: "PL-8210 Fountain Series Commercial Pull-Down Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 22.5, spoutLengthIn: 9.75, spoutHeightIn: 7.75, profile: "pull-down", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876662493324/1729881249111/PL-8210-Spec-Sheet.pdf?v=1734119224340",
  },
  "PL-8210 MB": {
    id: "pelican-pl-8210-fountain-commercial-pull-down-matte-black", pelicanCode: "PL-8210 MB", name: "PL-8210 Fountain Series Commercial Pull-Down Kitchen Faucet — Matte Black",
    installation: "single-hole", overallHeightIn: 22.5, spoutLengthIn: 9.75, spoutHeightIn: 7.75, profile: "pull-down", finish: "matte-black",
    specificationUrl: "https://cdn.accentuate.io/7876662493324/1729881249111/PL-8210-Spec-Sheet.pdf?v=1734119224340",
  },
  "PL-8211 BG": {
    id: "pelican-pl-8211-fountain-pull-down-brushed-gold", pelicanCode: "PL-8211 BG", name: "PL-8211 Fountain Series Pull-Down Kitchen Faucet — Brushed Gold",
    installation: "single-hole", overallHeightIn: 15.6875, spoutLengthIn: 9.4375, spoutHeightIn: 6.625, profile: "pull-down", finish: "brushed-gold",
    specificationUrl: "https://cdn.accentuate.io/7876662689932/1729881278122/PL-8211-spec.pdf?v=1750169308913",
  },
  "PL-8211 BN": {
    id: "pelican-pl-8211-fountain-pull-down-brushed-nickel", pelicanCode: "PL-8211 BN", name: "PL-8211 Fountain Series Pull-Down Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 15.6875, spoutLengthIn: 9.4375, spoutHeightIn: 6.625, profile: "pull-down", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876662689932/1729881278122/PL-8211-spec.pdf?v=1750169308913",
  },
  "PL-8211 CHR": {
    id: "pelican-pl-8211-fountain-pull-down-chrome", pelicanCode: "PL-8211 CHR", name: "PL-8211 Fountain Series Pull-Down Kitchen Faucet — Chrome",
    installation: "single-hole", overallHeightIn: 15.6875, spoutLengthIn: 9.4375, spoutHeightIn: 6.625, profile: "pull-down", finish: "chrome",
    specificationUrl: "https://cdn.accentuate.io/7876662689932/1729881278122/PL-8211-spec.pdf?v=1750169308913",
  },
  "PL-8213 BN": {
    id: "pelican-pl-8213-fountain-pull-down-brushed-nickel", pelicanCode: "PL-8213 BN", name: "PL-8213 Fountain Series Pull-Down Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 15.75, spoutLengthIn: 9.375, spoutHeightIn: 6.5, profile: "pull-down", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876662886540/1729881310144/PL-8213-Spec-Sheet.pdf?v=1734119293439",
  },
  "PL-8217 BN": {
    id: "pelican-pl-8217-fountain-pull-down-brushed-nickel", pelicanCode: "PL-8217 BN", name: "PL-8217 Fountain Series Pull-Down Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 16.8125, spoutLengthIn: 9.375, spoutHeightIn: 7.5625, profile: "pull-down", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876662952076/1729881335594/PL-8217-Spec-Sheet.pdf?v=1734119313031",
  },
  "PL-8217 ORB": {
    id: "pelican-pl-8217-fountain-pull-down-oil-rubbed-bronze", pelicanCode: "PL-8217 ORB", name: "PL-8217 Fountain Series Pull-Down Kitchen Faucet — Oil Rubbed Bronze",
    installation: "single-hole", overallHeightIn: 16.8125, spoutLengthIn: 9.375, spoutHeightIn: 7.5625, profile: "pull-down", finish: "oil-rubbed-bronze",
    specificationUrl: "https://cdn.accentuate.io/7876662952076/1729881335594/PL-8217-Spec-Sheet.pdf?v=1734119313031",
  },
  "PL-8218 BN": {
    id: "pelican-pl-8218-fountain-pull-down-brushed-nickel", pelicanCode: "PL-8218 BN", name: "PL-8218 Fountain Series Pull-Down Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 17.6875, spoutLengthIn: 9.375, spoutHeightIn: 8.375, profile: "pull-down", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876663017612/1729881362501/PL-8218-Spec-Sheet.pdf?v=1734119334413",
  },
  "PL-8218 MB": {
    id: "pelican-pl-8218-fountain-pull-down-matte-black", pelicanCode: "PL-8218 MB", name: "PL-8218 Fountain Series Pull-Down Kitchen Faucet — Matte Black",
    installation: "single-hole", overallHeightIn: 17.6875, spoutLengthIn: 9.375, spoutHeightIn: 8.375, profile: "pull-down", finish: "matte-black",
    specificationUrl: "https://cdn.accentuate.io/7876663017612/1729881362501/PL-8218-Spec-Sheet.pdf?v=1734119334413",
  },
  "PL-8231 BG": {
    id: "pelican-pl-8231-fountain-pull-out-brushed-gold", pelicanCode: "PL-8231 BG", name: "PL-8231 Fountain Series Pull-Out Kitchen Faucet — Brushed Gold",
    installation: "single-hole", overallHeightIn: 15.75, spoutLengthIn: 9.375, spoutHeightIn: 6.5, profile: "pull-out", finish: "brushed-gold",
    specificationUrl: "https://cdn.accentuate.io/7876664230028/1729881462010/PL-8231-Spec-Sheet.pdf?v=1734119435030",
  },
  "PL-8231 BN": {
    id: "pelican-pl-8231-fountain-pull-out-brushed-nickel", pelicanCode: "PL-8231 BN", name: "PL-8231 Fountain Series Pull-Out Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 15.75, spoutLengthIn: 9.375, spoutHeightIn: 6.5, profile: "pull-out", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/7876664230028/1729881462010/PL-8231-Spec-Sheet.pdf?v=1734119435030",
  },
  "PL-8231 CHR": {
    id: "pelican-pl-8231-fountain-pull-out-chrome", pelicanCode: "PL-8231 CHR", name: "PL-8231 Fountain Series Pull-Out Kitchen Faucet — Chrome",
    installation: "single-hole", overallHeightIn: 15.75, spoutLengthIn: 9.375, spoutHeightIn: 6.5, profile: "pull-out", finish: "chrome",
    specificationUrl: "https://cdn.accentuate.io/7876664230028/1729881462010/PL-8231-Spec-Sheet.pdf?v=1734119435030",
  },
  "PL-8231 MB": {
    id: "pelican-pl-8231-fountain-pull-out-matte-black", pelicanCode: "PL-8231 MB", name: "PL-8231 Fountain Series Pull-Out Kitchen Faucet — Matte Black",
    installation: "single-hole", overallHeightIn: 15.75, spoutLengthIn: 9.375, spoutHeightIn: 6.5, profile: "pull-out", finish: "matte-black",
    specificationUrl: "https://cdn.accentuate.io/7876664230028/1729881462010/PL-8231-Spec-Sheet.pdf?v=1734119435030",
  },
  "PL-8257 BN": {
    id: "pelican-pl-8257-fountain-pull-down-brushed-nickel", pelicanCode: "PL-8257 BN", name: "PL-8257 Fountain Series Pull-Down Kitchen Faucet — Brushed Nickel",
    installation: "single-hole", overallHeightIn: 17.75, spoutLengthIn: 8.25, spoutHeightIn: 9.5, profile: "pull-down", finish: "brushed-nickel",
    specificationUrl: "https://cdn.accentuate.io/8105530785932/1744290070437/PL-8257.pdf?v=1744290070437",
  },
  "PL-8257 CHR": {
    id: "pelican-pl-8257-fountain-pull-down-chrome", pelicanCode: "PL-8257 CHR", name: "PL-8257 Fountain Series Pull-Down Kitchen Faucet — Chrome",
    installation: "single-hole", overallHeightIn: 17.75, spoutLengthIn: 8.25, spoutHeightIn: 9.5, profile: "pull-down", finish: "chrome",
    specificationUrl: "https://cdn.accentuate.io/8105530785932/1744290070437/PL-8257.pdf?v=1744290070437",
  },
  "PL-8257 MB": {
    id: "pelican-pl-8257-fountain-pull-down-matte-black", pelicanCode: "PL-8257 MB", name: "PL-8257 Fountain Series Pull-Down Kitchen Faucet — Matte Black",
    installation: "single-hole", overallHeightIn: 17.75, spoutLengthIn: 8.25, spoutHeightIn: 9.5, profile: "pull-down", finish: "matte-black",
    specificationUrl: "https://cdn.accentuate.io/8105530785932/1744290070437/PL-8257.pdf?v=1744290070437",
  },
  "PL-8410 BN": {
    id: "pelican-pl-8410-fountain-wall-mounted-brushed-nickel", pelicanCode: "PL-8410 BN", name: "PL-8410 Fountain Series Wall-Mounted Kitchen Faucet — Brushed Nickel",
    installation: "wall-mounted-8-inch-center", overallHeightIn: 10.5, spoutLengthIn: 9.75, spoutHeightIn: 7.5, centerSpreadIn: 8, profile: "wall-mounted-bridge", finish: "brushed-nickel", requiresProjectSpecificMountHeight: true,
    specificationUrl: "https://buildpelican.com/products/pl-8410",
  },
  "PL-8410 MB": {
    id: "pelican-pl-8410-fountain-wall-mounted-matte-black", pelicanCode: "PL-8410 MB", name: "PL-8410 Fountain Series Wall-Mounted Kitchen Faucet — Matte Black",
    installation: "wall-mounted-8-inch-center", overallHeightIn: 10.5, spoutLengthIn: 9.75, spoutHeightIn: 7.5, centerSpreadIn: 8, profile: "wall-mounted-bridge", finish: "matte-black", requiresProjectSpecificMountHeight: true,
    specificationUrl: "https://buildpelican.com/products/pl-8410",
  },
  "PL-8461 BN": {
    id: "pelican-pl-8461-fountain-wall-mounted-brushed-nickel", pelicanCode: "PL-8461 BN", name: "PL-8461 Fountain Series Wall-Mounted Kitchen Faucet — Brushed Nickel",
    installation: "wall-mounted-8-inch-center", overallHeightIn: 4.375, spoutLengthIn: 8.75, spoutHeightIn: 3.125, centerSpreadIn: 8, profile: "wall-mounted-bridge", finish: "brushed-nickel", requiresProjectSpecificMountHeight: true,
    specificationUrl: "https://buildpelican.com/products/pl-8461",
  },
  "PL-8461 MB": {
    id: "pelican-pl-8461-fountain-wall-mounted-matte-black", pelicanCode: "PL-8461 MB", name: "PL-8461 Fountain Series Wall-Mounted Kitchen Faucet — Matte Black",
    installation: "wall-mounted-8-inch-center", overallHeightIn: 4.375, spoutLengthIn: 8.75, spoutHeightIn: 3.125, centerSpreadIn: 8, profile: "wall-mounted-bridge", finish: "matte-black", requiresProjectSpecificMountHeight: true,
    specificationUrl: "https://buildpelican.com/products/pl-8461",
  },
};

const VERIFIED_PELICAN_POT_FILLERS: Record<string, VerifiedPelicanPotFillerProfile> = {
  "PL-8369 BG": {
    id: "pelican-pl-8369-fountain-pot-filler-brushed-gold", pelicanCode: "PL-8369 BG", name: "PL-8369 Fountain Series Kitchen Pot Filler — Brushed Gold",
    installation: "wall-mounted-in-wall-cold-water", profile: "dual-jointed-folding-swing-arm", finish: "brushed-gold",
    spoutReachIn: 24, overallSpanIn: 26.1875, armDatumIn: 13, fixtureHeightIn: 3.15625, outletDatumIn: 1.875, maximumFlowGpmAt60Psi: 2.2,
    requiresProjectSpecificMountHeight: true,
    specificationUrl: "https://cdn.accentuate.io/9507678257292/1784297892633/PL-8369-Spec.pdf?v=1784297892633",
    installationUrl: "https://cdn.accentuate.io/9507678257292/1784297936129/PL-8369-Installation-Instructions-(2).pdf?v=1784297936130",
  },
  "PL-8369 BN": {
    id: "pelican-pl-8369-fountain-pot-filler-brushed-nickel", pelicanCode: "PL-8369 BN", name: "PL-8369 Fountain Series Kitchen Pot Filler — Brushed Nickel",
    installation: "wall-mounted-in-wall-cold-water", profile: "dual-jointed-folding-swing-arm", finish: "brushed-nickel",
    spoutReachIn: 24, overallSpanIn: 26.1875, armDatumIn: 13, fixtureHeightIn: 3.15625, outletDatumIn: 1.875, maximumFlowGpmAt60Psi: 2.2,
    requiresProjectSpecificMountHeight: true,
    specificationUrl: "https://cdn.accentuate.io/9507678257292/1784297892633/PL-8369-Spec.pdf?v=1784297892633",
    installationUrl: "https://cdn.accentuate.io/9507678257292/1784297936129/PL-8369-Installation-Instructions-(2).pdf?v=1784297936130",
  },
  "PL-8369 CHR": {
    id: "pelican-pl-8369-fountain-pot-filler-chrome", pelicanCode: "PL-8369 CHR", name: "PL-8369 Fountain Series Kitchen Pot Filler — Chrome",
    installation: "wall-mounted-in-wall-cold-water", profile: "dual-jointed-folding-swing-arm", finish: "chrome",
    spoutReachIn: 24, overallSpanIn: 26.1875, armDatumIn: 13, fixtureHeightIn: 3.15625, outletDatumIn: 1.875, maximumFlowGpmAt60Psi: 2.2,
    requiresProjectSpecificMountHeight: true,
    specificationUrl: "https://cdn.accentuate.io/9507678257292/1784297892633/PL-8369-Spec.pdf?v=1784297892633",
    installationUrl: "https://cdn.accentuate.io/9507678257292/1784297936129/PL-8369-Installation-Instructions-(2).pdf?v=1784297936130",
  },
  "PL-8369 MB": {
    id: "pelican-pl-8369-fountain-pot-filler-matte-black", pelicanCode: "PL-8369 MB", name: "PL-8369 Fountain Series Kitchen Pot Filler — Matte Black",
    installation: "wall-mounted-in-wall-cold-water", profile: "dual-jointed-folding-swing-arm", finish: "matte-black",
    spoutReachIn: 24, overallSpanIn: 26.1875, armDatumIn: 13, fixtureHeightIn: 3.15625, outletDatumIn: 1.875, maximumFlowGpmAt60Psi: 2.2,
    requiresProjectSpecificMountHeight: true,
    specificationUrl: "https://cdn.accentuate.io/9507678257292/1784297892633/PL-8369-Spec.pdf?v=1784297892633",
    installationUrl: "https://cdn.accentuate.io/9507678257292/1784297936129/PL-8369-Installation-Instructions-(2).pdf?v=1784297936130",
  },
};

function normalizedPelicanCode(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase().replace(/\s+\(OLD\)$/, "").replace(/\s+(?:BLACK|GREY|WHITE)$/, "");
  if (/^PL-3099(?:\s|$)/.test(normalized)) return "PL-3099";
  if (/^PL-HA109\s+ADA\s+R(?:0|15)\s+18G$/.test(normalized)) return "PL-HA109 ADA";
  if (/^PL-HA109\s+R(?:0|15)\s+(?:16|18)G$/.test(normalized)) return "PL-HA109";
  if (/^PL-HA115\s+R(?:0|15)\s+(?:16|18)G$/.test(normalized)) return "PL-HA115";
  if (/^PL-HA104\s+R(?:0|15)\s+16G$/.test(normalized)) return "PL-HA104";
  if (/^PL-HA108\s+R0\s+(?:16|18)G$/.test(normalized)) return "PL-HA108";
  if (/^PL-HA111\s+R0\s+(?:16|18)G$/.test(normalized)) return "PL-HA111";
  if (/^PL-HA117\s+R0\s+(?:16|18)G$/.test(normalized)) return "PL-HA117";
  if (/^PL-HA119\s+R(?:15|19)\s+18G$/.test(normalized)) return "PL-HA119";
  if (/^PL-HA126\s+R0\s+(?:16|18)G$/.test(normalized)) return "PL-HA126";
  if (/^PL-HA128\s+R15(?:\s+16G)?$/.test(normalized)) return "PL-HA128";
  if (/^PL-HA135\s+R0(?:\s+16G)?$/.test(normalized)) return "PL-HA135";
  if (/^PL-GMB135\s+R0(?:\s+16G)?$/.test(normalized)) return "PL-GMB135";
  if (/^PL-HA130\s+R0(?:\s+16G)?$/.test(normalized)) return "PL-HA130";
  if (/^PL-HA122\s+R15(?:\s+16G)?$/.test(normalized)) return "PL-HA122";
  if (/^PL-HA118\s+R15(?:\s+16G)?$/.test(normalized)) return "PL-HA118";
  if (/^PL-HA125\s+R0(?:\s+16G)?$/.test(normalized)) return "PL-HA125";
  if (/^PL-HA124\s+R0(?:\s+16G)?$/.test(normalized)) return "PL-HA124";
  if (/^PL-HA139\s+R15(?:\s+16G)?$/.test(normalized)) return "PL-HA139";
  if (/^PL-HA144\s+R10(?:\s+16G)?$/.test(normalized)) return "PL-HA144";
  if (/^PL-HA148\s+R10(?:\s+16G)?$/.test(normalized)) return "PL-HA148";
  if (/^PL-VS3218\s+(?:16|18)G$/.test(normalized)) return "PL-VS3218";
  if (/^PL-VS3018\s+(?:16|18)G$/.test(normalized)) return "PL-VS3018";
  if (/^PL-VS3018\s+18G\s+ADA$/.test(normalized)) return "PL-VS3018 ADA";
  if (/^PL-VS2718\s+(?:16|18)G$/.test(normalized)) return "PL-VS2718";
  if (/^PL-VS1815\s+18G$/.test(normalized)) return "PL-VS1815";
  if (/^PL-VS1513\s+18G$/.test(normalized)) return "PL-VS1513";
  if (/^PL-VS2118\s+18G$/.test(normalized)) return "PL-VS2118";
  if (/^PL-VS2318\s+(?:16|18)G$/.test(normalized)) return "PL-VS2318";
  if (/^PL-VS4060\s+(?:16|18)G$/.test(normalized)) return "PL-VS4060";
  if (/^PL-VS4040\s+18G$/.test(normalized)) return "PL-VS4040";
  if (/^PL-VS5050\s+(?:16|18)G$/.test(normalized)) return "PL-VS5050";
  if (/^PL-VS5050\s+18G\s+ADA$/.test(normalized)) return "PL-VS5050 ADA";
  if (/^PL-VR5050\s+R20$/.test(normalized)) return "PL-VR5050";
  if (/^PL-VR6040\s+R20$/.test(normalized)) return "PL-VR6040";
  if (/^PL-VR2318\s+R20$/.test(normalized)) return "PL-VR2318";
  if (/^PL-VR1816\s+R20$/.test(normalized)) return "PL-VR1816";
  if (/^PL-VR2718\s+R20$/.test(normalized)) return "PL-VR2718";
  if (/^PL-VR2718\s+ADA$/.test(normalized)) return "PL-VR2718 ADA";
  if (/^PL-VR3118\s+R20$/.test(normalized)) return "PL-VR3118";
  if (/^PL-VR3118\s+ADA$/.test(normalized)) return "PL-VR3118 ADA";
  if (/^PL-VR4060\s+R20$/.test(normalized)) return "PL-VR4060";
  if (/^PL-VS3070\s+(?:16|18)G$/.test(normalized)) return "PL-VS3070";
  if (/^PL-VS7030\s+(?:16|18)G$/.test(normalized)) return "PL-VS7030";
  return normalized;
}

export function verifiedPelicanSinkProfile(code: string | null | undefined): VerifiedPelicanSinkProfile | null {
  const profile = VERIFIED_PELICAN_SINKS[normalizedPelicanCode(code)] ?? null;
  if (!profile || profile.pelicanCode !== "PL-3099") return profile;
  const normalized = (code ?? "").trim().toUpperCase();
  const surfaceFinish = /MATTE\s+BLACK|GLOSS\s+BLACK/.test(normalized)
    ? "vitreous-china-black" as const
    : /MATTE\s+GREY/.test(normalized)
      ? "vitreous-china-grey" as const
      : /\bBONE\b/.test(normalized)
        ? "vitreous-china-bone" as const
        : "vitreous-china" as const;
  return { ...profile, surfaceFinish };
}

export function verifiedPelicanFaucetProfile(code: string | null | undefined): VerifiedPelicanFaucetProfile | null {
  const normalized = (code ?? "").trim().toUpperCase();
  if (/^PL-8203(?:\s+BN)?$/.test(normalized)) return VERIFIED_PELICAN_FAUCETS["PL-8203"];
  return VERIFIED_PELICAN_FAUCETS[normalized] ?? null;
}

export function verifiedPelicanPotFillerProfile(code: string | null | undefined): VerifiedPelicanPotFillerProfile | null {
  const normalized = (code ?? "").trim().toUpperCase();
  return VERIFIED_PELICAN_POT_FILLERS[normalized] ?? null;
}

export function hasVerifiedPelicanFixtureProfile(code: string | null | undefined): boolean {
  return Boolean(verifiedPelicanSinkProfile(code) || verifiedPelicanFaucetProfile(code) || verifiedPelicanPotFillerProfile(code));
}

/** Bathroom-only profiles keep vanity fixtures out of the kitchen sink/faucet workflow. */
export function isVerifiedPelicanVanitySink(code: string | null | undefined): boolean {
  const profile = verifiedPelicanSinkProfile(code);
  return profile?.pelicanCode === "PL-3099" || profile?.pelicanCode === "PL-3608";
}

/** Bathroom-only profiles keep vanity faucets out of the kitchen sink/faucet workflow. */
export function isVerifiedPelicanVanityFaucet(code: string | null | undefined): boolean {
  return /^PL-8112\s+(?:BN|CHR)$/.test((code ?? "").trim().toUpperCase());
}

export function verifiedPelicanSinkFitsCabinet(profile: VerifiedPelicanSinkProfile, cabinetWidthIn: number): boolean {
  return Number.isFinite(cabinetWidthIn) && cabinetWidthIn >= profile.minimumCabinetWidthIn;
}

/**
 * A sink base's usable opening is its nominal cabinet face width.  Its rotated
 * plan footprint may swap width/depth, but that must never turn an FSB-36 into
 * a 24-inch opening during a sink compatibility check.
 */
export function sinkBaseOpeningWidthIn(base?: { width?: number | null }): number {
  const width = Number(base?.width ?? 0);
  return Number.isFinite(width) && width > 0 ? width : 0;
}

export type PelicanSinkCandidate = { pelicanCode?: string | null; name?: string | null; description?: string | null };
export type PelicanSinkBaseKind = "farmhouse" | "standard";

/** A farmhouse base accepts only apron-front sinks; a standard SB-style base accepts standard sinks. */
export function pelicanSinkBaseKind(candidate: PelicanSinkCandidate): PelicanSinkBaseKind {
  if (verifiedPelicanSinkProfile(candidate.pelicanCode)?.sinkType === "farmhouse") return "farmhouse";
  const details = `${candidate.name ?? ""} ${candidate.description ?? ""}`.toLowerCase();
  return /\bfarm(?:house)?\b|\bapron[-\s]?front\b/.test(details) ? "farmhouse" : "standard";
}

export function isPelicanSinkCompatibleWithBase(candidate: PelicanSinkCandidate, baseKind: PelicanSinkBaseKind): boolean {
  return pelicanSinkBaseKind(candidate) === baseKind;
}
