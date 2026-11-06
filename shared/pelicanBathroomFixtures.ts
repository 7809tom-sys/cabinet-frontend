/**
 * Pelican bathroom vanity sinks and vanity faucets, resolved from source data.
 *
 * Why this file exists: `pelican_products` stores only an imported category and
 * sub-category ("Sinks & Faucets" / "Sinks" or "Faucets"). Every kitchen sink and
 * every kitchen faucet shares those two values with the bathroom products, so the
 * Bathroom Designer had no way to tell a porcelain vanity basin from a stainless
 * kitchen sink, or a 4" centerset vanity faucet from a pull-down kitchen faucet.
 * The old approach hard-coded two basins (PL-3099, PL-3608) and one faucet
 * (PL-8112), which is why the bathroom picker showed one faucet.
 *
 * Every entry below is tied to a specific Pelican record that the importer already
 * carries, and its mounting type / bowl count / hole count comes from Pelican's own
 * published specification sheet (buildpelican.com). Nothing is inferred from a
 * product name, a photo, or a category label. Where Pelican publishes no spec
 * sheet, the model is deliberately absent (see docs/pelican-vanity-fixtures.md).
 *
 * A model is identified by its base code. The importer creates one row per finish,
 * colour, or packaging variant ("PL-3099 Bone", "PL-3099 Matte Black",
 * "PL-3059 Individually Packed"), so an exact code is matched on its model plus a
 * known variant suffix. Unknown suffixes never match.
 */

export type PelicanVanitySinkKind = "vanity-basin" | "vanity-top";

/** How the basin is installed, exactly as the Pelican specification sheet states it. */
export type PelicanVanitySinkMount = "undermount" | "drop-in" | "vessel" | "integrated";

export type PelicanVanitySink = {
  /** Base model, e.g. "PL-3099". Every finish/colour variant resolves to this. */
  model: string;
  /** "vanity-basin" is a separate bowl; "vanity-top" is a bowl moulded into its own top. */
  kind: PelicanVanitySinkKind;
  mount: PelicanVanitySinkMount;
  /** Source-stated bowl count. Every Pelican vanity basin today is single-bowl. */
  bowlCount: 1 | 2;
  /** Source-stated pre-drilled faucet holes, when the sheet publishes a count. */
  faucetHoles?: 1 | 3;
  /** Source-stated hole spacing in inches (3 holes only). */
  faucetSpreadIn?: 4 | 8;
  series: string;
  /** Source exterior measurements, inches. These are the plan/3D envelope. */
  widthIn: number;
  depthIn: number;
  heightIn: number;
  /** Source interior (bowl) measurements, inches, when the sheet publishes them. */
  bowlWidthIn?: number;
  bowlDepthIn?: number;
  bowlHeightIn?: number;
  /** Published Pelican technical sheet for this exact model. */
  specificationUrl: string;
};

const SPEC = {
  pl1606: "https://cdn.accentuate.io/7876644176012/1729868512737/PL-1606.pdf?v=1729868617037",
  pl1634: "https://cdn.accentuate.io/7876644307084/1729868822694/PL-1634-Spec-Sheet.pdf?v=1729868822695",
  pl1637: "https://cdn.accentuate.io/7876644569228/1729868958116/PL-1637.pdf?v=1729868958117",
  pl1646: "https://cdn.accentuate.io/7876644634764/1729869000344/PL-1646.pdf?v=1729869000344",
  pl1647: "https://cdn.accentuate.io/7876644733068/1729869070204/PL-1647.pdf?v=1729869070204",
  pl3001: "https://cdn.accentuate.io/7876645027980/1729869389863/PL-3001.pdf?v=1729869389863",
  pl3002: "https://cdn.accentuate.io/7876645257356/1729869452447/PL-3002.pdf?v=1729869452447",
  pl3014: "https://cdn.accentuate.io/7876645585036/1729869490754/PL-3014.pdf?v=1729869490755",
  pl3033: "https://cdn.accentuate.io/7876659970188/1729869573688/PL-3033-Spec-Sheet.pdf?v=1729869573688",
  pl3044: "https://cdn.accentuate.io/7876660068492/1729869655714/PL-3044-Spec-Sheet.pdf?v=1729869655715",
  pl3053: "https://cdn.accentuate.io/7876645879948/1729869709777/PL-3053.pdf?v=1729869709777",
  pl3059: "https://cdn.accentuate.io/7876660134028/1729869738675/PL-3059.pdf?v=1772662429726",
  pl3060: "https://cdn.accentuate.io/7876646109324/1729869790088/PL-3060.pdf?v=1729869790088",
  pl3064: "https://cdn.accentuate.io/7876660428940/1729869913595/PL-3064-Spec-Sheet.pdf?v=1729869913595",
  pl3072: "https://cdn.accentuate.io/7876660560012/1729869955188/PL-3072-Spec-Sheet.pdf?v=1729869955188",
  pl3079: "https://cdn.accentuate.io/7876646469772/1729870007876/PL-3079.pdf?v=1729870007876",
  pl3081: "https://cdn.accentuate.io/7876646830220/1729870046284/PL-3081.pdf?v=1729870046284",
  pl3082: "https://cdn.accentuate.io/7876647026828/1729870130596/PL-3082.pdf?v=1729870130596",
  pl3086: "https://cdn.accentuate.io/7876647288972/1729870172772/PL-3086-Spec-Sheet.pdf?v=1729870172773",
  pl3088: "https://cdn.accentuate.io/7876660592780/1729870249640/PL-3088-Spec-Sheet.pdf?v=1729870249641",
  pl3099: "https://cdn.accentuate.io/7876660789388/1729870296544/PL-3099-Spec-Sheet.pdf?v=1729870296544",
  pl3608: "https://cdn.accentuate.io/7876647551116/1729870423997/PL-3608-Spec-Sheet.pdf?v=1729870423997",
  pl3611: "https://cdn.accentuate.io/8981248508044/1772662762695/PL-3611.pdf?v=1772662762695",
  pl3639: "https://cdn.accentuate.io/7876647682188/1729870458889/PL-3639-Spec-Sheet.pdf?v=1729870458889",
  pl5053: "https://cdn.accentuate.io/8086128263308/1754071040822/PL-5053-(3).pdf?v=1754071040823",
  pl1011_4: "https://cdn.accentuate.io/7876659216524/1729010166589/PL-1011-4inch-Spec-Sheet.pdf?v=1729868393278",
  pl1011_8: "https://cdn.accentuate.io/7876659216524/1729010181670/PL-1011-8inch-Spec-Sheet.pdf?v=1729868404022",
  plR1917: "https://cdn.accentuate.io/8978113724556/1772653353528/PL-R1917W.pdf?v=1772653353528",
  plR2519: "https://cdn.accentuate.io/8978113790092/1772653078994/PL-R2519W-Spec.pdf?v=1772653078994",
  plR2522: "https://cdn.accentuate.io/8978113822860/1772650395372/PL-R2522W-Spec.pdf?v=1772650395372",
  plR3119: "https://cdn.accentuate.io/8978113855628/1772652874456/PL-R3119W-Spec.pdf?v=1772652874456",
  plR3122: "https://cdn.accentuate.io/8978113888396/1772652563080/PL-R3122W-Spec.pdf?v=1772652563080",
  plR3722: "https://cdn.accentuate.io/8978113921164/1772652203044/PL-R3722W-Spec.pdf?v=1772652203044",
  plR4322: "https://cdn.accentuate.io/8978113986700/1772652016358/PL-R4322W-Spec.pdf?v=1772652016358",
  plR4922: "https://cdn.accentuate.io/8978114052236/1772651799394/PL-R4922W-Spec.pdf?v=1772651799395",
  plO2519: "https://cdn.accentuate.io/8978113069196/1772654415812/PL-O2519WBS-Spec.pdf?v=1772654415812",
  plO2522: "https://cdn.accentuate.io/8978113167500/1772656951755/PL-O2522WBS-Spec.pdf?v=1772656951755",
  plO3122: "https://cdn.accentuate.io/8978113265804/1772656724251/PL-O3122WBS-Spec.pdf?v=1772656724251",
  plO3719: "https://cdn.accentuate.io/8978113396876/1772656587611/PL-O3719WBS-Spec.pdf?v=1772656587611",
  plO3722: "https://cdn.accentuate.io/8978113495180/1772653900990/PL-O3722WBS-Spec.pdf?v=1772653900990",
  plO4922: "https://cdn.accentuate.io/8978113626252/1772653740601/PL-O4922WBS-Spec.pdf?v=1772653740601",
} as const;

/**
 * Every Pelican vanity basin and integrated vanity top that has a published
 * specification sheet stating its installation and exterior measurements.
 *
 * All 45 basins and all 14 integrated tops Pelican sells as bathroom are single
 * bowl. Pelican publishes no double-bowl bathroom vanity basin, so none appears
 * here — see docs/pelican-vanity-fixtures.md for that finding and the evidence.
 */
export const PELICAN_VANITY_SINKS: readonly PelicanVanitySink[] = [
  // ── Undermount porcelain basins ──────────────────────────────────────────
  { model: "PL-1606", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Sandbar Series", widthIn: 19, depthIn: 16, heightIn: 7, bowlWidthIn: 17, bowlDepthIn: 14, bowlHeightIn: 4.5, specificationUrl: SPEC.pl1606 },
  { model: "PL-1634", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 21, depthIn: 15.75, heightIn: 5.25, bowlWidthIn: 18, bowlDepthIn: 13, bowlHeightIn: 3.375, specificationUrl: SPEC.pl1634 },
  { model: "PL-1637", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Sandbar Series", widthIn: 19.5, depthIn: 15.5, heightIn: 7.25, bowlWidthIn: 17, bowlDepthIn: 13, bowlHeightIn: 5, specificationUrl: SPEC.pl1637 },
  { model: "PL-1646", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Sandbar Series", widthIn: 21.5, depthIn: 15.125, heightIn: 6.5, bowlWidthIn: 19, bowlDepthIn: 13, bowlHeightIn: 4.5, specificationUrl: SPEC.pl1646 },
  { model: "PL-1647", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Sandbar Series", widthIn: 24.375, depthIn: 16.625, heightIn: 7, bowlWidthIn: 22, bowlDepthIn: 14.25, bowlHeightIn: 4.75, specificationUrl: SPEC.pl1647 },
  { model: "PL-3033", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 21, depthIn: 13.375, heightIn: 7, bowlWidthIn: 18.5, bowlDepthIn: 11, bowlHeightIn: 5.5, specificationUrl: SPEC.pl3033 },
  { model: "PL-3044", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 21, depthIn: 14.5, heightIn: 8.5, bowlWidthIn: 18.25, bowlDepthIn: 12, bowlHeightIn: 6.25, specificationUrl: SPEC.pl3044 },
  { model: "PL-3059", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 19, depthIn: 15.75, heightIn: 7.75, bowlWidthIn: 17.25, bowlDepthIn: 14, bowlHeightIn: 5.75, specificationUrl: SPEC.pl3059 },
  { model: "PL-3064", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 18, depthIn: 15, heightIn: 7.5, bowlWidthIn: 16, bowlDepthIn: 13, bowlHeightIn: 6, specificationUrl: SPEC.pl3064 },
  { model: "PL-3072", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 17.125, depthIn: 14, heightIn: 7.5, bowlWidthIn: 15.25, bowlDepthIn: 12, bowlHeightIn: 6, specificationUrl: SPEC.pl3072 },
  { model: "PL-3088", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 18, depthIn: 13, heightIn: 7.25, bowlWidthIn: 16.25, bowlDepthIn: 11, bowlHeightIn: 5.5, specificationUrl: SPEC.pl3088 },
  { model: "PL-3099", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 20.875, depthIn: 15.625, heightIn: 7.75, bowlWidthIn: 18, bowlDepthIn: 13, bowlHeightIn: 6, specificationUrl: SPEC.pl3099 },
  { model: "PL-3608", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 19, depthIn: 16, heightIn: 5.5, bowlWidthIn: 16.5, bowlDepthIn: 13.5, bowlHeightIn: 3.5, specificationUrl: SPEC.pl3608 },
  { model: "PL-3611", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 19.75, depthIn: 16, heightIn: 7.375, bowlWidthIn: 17.5, bowlDepthIn: 13, bowlHeightIn: 5.25, specificationUrl: SPEC.pl3611 },
  { model: "PL-3639", kind: "vanity-basin", mount: "undermount", bowlCount: 1, series: "Pearl Series", widthIn: 17, depthIn: 13.75, heightIn: 5.25, bowlWidthIn: 14.5, bowlDepthIn: 11.5, bowlHeightIn: 3.375, specificationUrl: SPEC.pl3639 },
  // ── Vessel (above-counter) porcelain basins — height is above the counter ──
  { model: "PL-3001", kind: "vanity-basin", mount: "vessel", bowlCount: 1, series: "Shell Series", widthIn: 16, depthIn: 16, heightIn: 6.25, specificationUrl: SPEC.pl3001 },
  { model: "PL-3002", kind: "vanity-basin", mount: "vessel", bowlCount: 1, series: "Shell Series", widthIn: 22.75, depthIn: 14.75, heightIn: 7.5, specificationUrl: SPEC.pl3002 },
  { model: "PL-3014", kind: "vanity-basin", mount: "vessel", bowlCount: 1, series: "Shell Series", widthIn: 16.75, depthIn: 16.75, heightIn: 5.75, specificationUrl: SPEC.pl3014 },
  { model: "PL-3053", kind: "vanity-basin", mount: "vessel", bowlCount: 1, series: "Shell Series", widthIn: 17.75, depthIn: 17.75, heightIn: 7, specificationUrl: SPEC.pl3053 },
  { model: "PL-3060", kind: "vanity-basin", mount: "vessel", bowlCount: 1, series: "Shell Series", widthIn: 16, depthIn: 16, heightIn: 5.125, specificationUrl: SPEC.pl3060 },
  { model: "PL-3079", kind: "vanity-basin", mount: "vessel", bowlCount: 1, series: "Shell Series", widthIn: 18, depthIn: 18, heightIn: 6, specificationUrl: SPEC.pl3079 },
  { model: "PL-3081", kind: "vanity-basin", mount: "vessel", bowlCount: 1, series: "Shell Series", widthIn: 19.25, depthIn: 14, heightIn: 5.625, specificationUrl: SPEC.pl3081 },
  { model: "PL-3082", kind: "vanity-basin", mount: "vessel", bowlCount: 1, series: "Shell Series", widthIn: 20.25, depthIn: 14.125, heightIn: 5.75, specificationUrl: SPEC.pl3082 },
  // ── Drop-in / self-rimming basins ────────────────────────────────────────
  { model: "PL-3086", kind: "vanity-basin", mount: "drop-in", bowlCount: 1, series: "Pearl Series", widthIn: 18, depthIn: 18, heightIn: 7.5, bowlWidthIn: 16, bowlDepthIn: 16, bowlHeightIn: 6, specificationUrl: SPEC.pl3086 },
  { model: "PL-5053", kind: "vanity-basin", mount: "drop-in", bowlCount: 1, faucetHoles: 1, series: "Pearl Series", widthIn: 21.25, depthIn: 18, heightIn: 7.5, bowlWidthIn: 16.5, bowlDepthIn: 11.25, bowlHeightIn: 5.5, specificationUrl: SPEC.pl5053 },
  // Two purchasable records, one per pre-drilled spread; the hole count is source-stated.
  { model: "PL-1011", kind: "vanity-basin", mount: "drop-in", bowlCount: 1, faucetHoles: 3, faucetSpreadIn: 4, series: "Pearl Series", widthIn: 20.5, depthIn: 17.75, heightIn: 7.75, bowlWidthIn: 15.5, bowlDepthIn: 11.25, bowlHeightIn: 6.125, specificationUrl: SPEC.pl1011_4 },
  { model: "PL-1011", kind: "vanity-basin", mount: "drop-in", bowlCount: 1, faucetHoles: 3, faucetSpreadIn: 8, series: "Pearl Series", widthIn: 20.5, depthIn: 17.75, heightIn: 7.75, bowlWidthIn: 15.5, bowlDepthIn: 11.25, bowlHeightIn: 6.125, specificationUrl: SPEC.pl1011_8 },
  // ── Integrated cultured-marble vanity tops (bowl is moulded into the top) ──
  { model: "PL-R1917", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 1, series: "Cove Series", widthIn: 18.969, depthIn: 17.016, heightIn: 6.109, bowlWidthIn: 12.984, bowlDepthIn: 9.844, bowlHeightIn: 4.531, specificationUrl: SPEC.plR1917 },
  { model: "PL-R2519", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 1, series: "Cove Series", widthIn: 25, depthIn: 18.969, heightIn: 6.656, bowlWidthIn: 18.969, bowlDepthIn: 10.984, bowlHeightIn: 4.953, specificationUrl: SPEC.plR2519 },
  { model: "PL-R2522", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 1, series: "Cove Series", widthIn: 25, depthIn: 22.016, heightIn: 6.656, bowlWidthIn: 18.031, bowlDepthIn: 13.5, bowlHeightIn: 4.953, specificationUrl: SPEC.plR2522 },
  { model: "PL-R3119", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 3, series: "Cove Series", widthIn: 30.984, depthIn: 18.969, heightIn: 6.656, bowlWidthIn: 18.969, bowlDepthIn: 10.938, bowlHeightIn: 4.953, specificationUrl: SPEC.plR3119 },
  { model: "PL-R3122", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 3, series: "Cove Series", widthIn: 30.984, depthIn: 22.047, heightIn: 6.609, bowlWidthIn: 20.859, bowlDepthIn: 13.781, bowlHeightIn: 4.922, specificationUrl: SPEC.plR3122 },
  { model: "PL-R3722", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 3, series: "Cove Series", widthIn: 37.016, depthIn: 22.047, heightIn: 6.609, bowlWidthIn: 20.859, bowlDepthIn: 13.781, bowlHeightIn: 4.922, specificationUrl: SPEC.plR3722 },
  { model: "PL-R4322", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 3, series: "Cove Series", widthIn: 42.984, depthIn: 22.047, heightIn: 6.609, bowlWidthIn: 20.859, bowlDepthIn: 13.781, bowlHeightIn: 5.156, specificationUrl: SPEC.plR4322 },
  { model: "PL-R4922", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 3, series: "Cove Series", widthIn: 49.016, depthIn: 22.047, heightIn: 6.812, bowlWidthIn: 20.859, bowlDepthIn: 13.781, bowlHeightIn: 5.156, specificationUrl: SPEC.plR4922 },
  // The oval Cove tops carry a built-in backsplash; that is why the height is larger.
  { model: "PL-O2519", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 1, series: "Cove Series", widthIn: 25, depthIn: 19.016, heightIn: 10.234, bowlWidthIn: 16.141, bowlDepthIn: 10.469, bowlHeightIn: 4.453, specificationUrl: SPEC.plO2519 },
  { model: "PL-O2522", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 1, series: "Cove Series", widthIn: 25, depthIn: 22.016, heightIn: 11.297, bowlWidthIn: 16.844, bowlDepthIn: 11.562, bowlHeightIn: 5.547, specificationUrl: SPEC.plO2522 },
  { model: "PL-O3122", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 3, series: "Cove Series", widthIn: 30.984, depthIn: 22.016, heightIn: 11.344, bowlWidthIn: 17.125, bowlDepthIn: 11.688, bowlHeightIn: 5.625, specificationUrl: SPEC.plO3122 },
  { model: "PL-O3719", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 3, series: "Cove Series", widthIn: 37.016, depthIn: 19.016, heightIn: 10.906, bowlWidthIn: 17.281, bowlDepthIn: 10.312, bowlHeightIn: 5.203, specificationUrl: SPEC.plO3719 },
  { model: "PL-O3722", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 3, series: "Cove Series", widthIn: 37.016, depthIn: 22.016, heightIn: 10.906, bowlWidthIn: 18.312, bowlDepthIn: 12.203, bowlHeightIn: 5.203, specificationUrl: SPEC.plO3722 },
  { model: "PL-O4922", kind: "vanity-top", mount: "integrated", bowlCount: 1, faucetHoles: 3, series: "Cove Series", widthIn: 49.016, depthIn: 22.016, heightIn: 11.219, bowlWidthIn: 16.844, bowlDepthIn: 11.609, bowlHeightIn: 5.547, specificationUrl: SPEC.plO4922 },
];

/** How a vanity faucet is installed, exactly as the Pelican specification sheet states it. */
export type PelicanVanityFaucetMount = "single-hole" | "centerset-4" | "widespread-8";

export type PelicanVanityFaucet = {
  model: string;
  mount: PelicanVanityFaucetMount;
  /** Source-stated hole count and spacing, so the Designer can match a basin's drilling. */
  faucetHoles: 1 | 3;
  faucetSpreadIn?: 4 | 8;
  series: string;
  /** "vessel" faucets are the source's "Works with Vessel Style Sinks" models. */
  forVesselSink: boolean;
  overallHeightIn: number;
  spoutLengthIn: number;
  spoutHeightIn: number;
  specificationUrl: string;
};

/**
 * Every Pelican bathroom (vanity) faucet with a published specification sheet.
 * Deliberately excludes Pelican's floor-mounted tub fillers (PL-8515, PL-8522,
 * PL-8538), which Pelican tags "Bathroom" but installs on the tub floor, and the
 * Hydra shower sets, which are shower valves rather than deck faucets.
 */
export const PELICAN_VANITY_FAUCETS: readonly PelicanVanityFaucet[] = [
  { model: "PL-8104", mount: "centerset-4", faucetHoles: 3, faucetSpreadIn: 4, series: "Cascade Series", forVesselSink: false, overallHeightIn: 5.3125, spoutLengthIn: 4.75, spoutHeightIn: 2.1875, specificationUrl: "https://cdn.accentuate.io/7876661379212/1729880874818/PL-8104-Spec-Sheet.pdf?v=1734118982337" },
  { model: "PL-8107", mount: "single-hole", faucetHoles: 1, series: "Cascade Series", forVesselSink: false, overallHeightIn: 7.625, spoutLengthIn: 7.25, spoutHeightIn: 4.8125, specificationUrl: "https://cdn.accentuate.io/8105494216844/1744058921762/PL-8107.pdf?v=1744058921762" },
  { model: "PL-8112", mount: "single-hole", faucetHoles: 1, series: "Cascade Series", forVesselSink: true, overallHeightIn: 12.4375, spoutLengthIn: 3.9375, spoutHeightIn: 7.6875, specificationUrl: "https://cdn.accentuate.io/7876661543052/1729880913717/PL-8112-Spec-Sheet.pdf?v=1734119006276" },
  { model: "PL-8113", mount: "single-hole", faucetHoles: 1, series: "Cascade Series", forVesselSink: false, overallHeightIn: 7.5625, spoutLengthIn: 5.6875, spoutHeightIn: 3.5, specificationUrl: "https://cdn.accentuate.io/7876661608588/1729880951618/PL-8113-Spec-Sheet.pdf?v=1734119044273" },
  { model: "PL-8116", mount: "single-hole", faucetHoles: 1, series: "Cascade Series", forVesselSink: false, overallHeightIn: 7.5, spoutLengthIn: 5.1875, spoutHeightIn: 4.625, specificationUrl: "https://cdn.accentuate.io/8105530622092/1744223508745/PL-8116.pdf?v=1744223508745" },
  { model: "PL-8136", mount: "single-hole", faucetHoles: 1, series: "Cascade Series", forVesselSink: true, overallHeightIn: 11.1875, spoutLengthIn: 4.875, spoutHeightIn: 7.6875, specificationUrl: "https://cdn.accentuate.io/7876661936268/1729880978878/PL-8136-Spec-Sheet.pdf?v=1734119101445" },
  { model: "PL-8142", mount: "single-hole", faucetHoles: 1, series: "Cascade Series", forVesselSink: false, overallHeightIn: 7.25, spoutLengthIn: 4.5, spoutHeightIn: 4.5625, specificationUrl: "https://cdn.accentuate.io/7876662100108/1729881025624/PL-8142-(2).pdf?v=1741037996314" },
  { model: "PL-8162", mount: "single-hole", faucetHoles: 1, series: "Cascade Series", forVesselSink: false, overallHeightIn: 7.3125, spoutLengthIn: 4.375, spoutHeightIn: 4.625, specificationUrl: "https://cdn.accentuate.io/7876662198412/1729881051914/PL-8162-Spec-Sheet.pdf?v=1734119147907" },
  { model: "PL-8312", mount: "widespread-8", faucetHoles: 3, faucetSpreadIn: 8, series: "Cascade Series", forVesselSink: false, overallHeightIn: 10.4375, spoutLengthIn: 7.0625, spoutHeightIn: 6, specificationUrl: "https://cdn.accentuate.io/7876664459404/1729881773291/PL-8312-Spec.pdf?v=1784908064980" },
  { model: "PL-8330", mount: "centerset-4", faucetHoles: 3, faucetSpreadIn: 4, series: "Cascade Series", forVesselSink: false, overallHeightIn: 8.125, spoutLengthIn: 5.0625, spoutHeightIn: 4.875, specificationUrl: "https://cdn.accentuate.io/7876664754316/1729881782209/PL-8330-Spec-Sheet.pdf?v=1734119510159" },
];

/**
 * Every purchasable Pelican SKU for the models above. These are the exact
 * `pelican_products.pelicanCode` values (finish, colour, packaging, or pre-drilled
 * spread variants). Only these rows are tagged; anything else is left untouched
 * and reported to the owner rather than guessed.
 */
export const PELICAN_VANITY_SINK_SKUS: readonly string[] = [
  // PL-1606..PL-3639 undermount
  "PL-1606 White",
  "PL-1634 White",
  "PL-1637 White",
  "PL-1646 White",
  "PL-1647 White",
  "PL-3033 Bone", "PL-3033 White",
  "PL-3044 Bone", "PL-3044 White",
  "PL-3059 Bone", "PL-3059 Gloss Black", "PL-3059 Individually Packed", "PL-3059 Matte Black", "PL-3059 Matte Grey", "PL-3059 White",
  "PL-3064 Bone", "PL-3064 Individually Packed", "PL-3064 White",
  "PL-3072 Bone", "PL-3072 Individually Packed", "PL-3072 White",
  "PL-3088 Bone", "PL-3088 Individually Packed", "PL-3088 White",
  "PL-3099 Bone", "PL-3099 Gloss Black", "PL-3099 Individually Packed", "PL-3099 Matte Black", "PL-3099 Matte Grey", "PL-3099 White",
  "PL-3608",
  "PL-3611 White",
  "PL-3639",
  // Vessel
  "PL-3001", "PL-3002", "PL-3014", "PL-3053", "PL-3060", "PL-3079", "PL-3081", "PL-3082",
  // Drop-in; PL-1011 ships one SKU per pre-drilled spread.
  "PL-3086", "PL-5053-1", 'PL-1011 Spread 4"', 'PL-1011 Spread 8"',
  // Integrated vanity tops — rectangular (Sinks & Faucets) and oval (imported to Tile & Mosaic)
  "PL-R1917W", "PL-R2519W", "PL-R2522W", "PL-R3119W", "PL-R3122W", "PL-R3722W", "PL-R4322W", "PL-R4922W",
  "PL-O2519WBS", "PL-O2522WBS", "PL-O3122WBS", "PL-O3719WBS", "PL-O3722WBS", "PL-O4922WBS",
];

export const PELICAN_VANITY_FAUCET_SKUS: readonly string[] = [
  "PL-8104 BN", "PL-8104 CHR",
  "PL-8107 BN", "PL-8107 CHR", "PL-8107 MB",
  "PL-8112 BN", "PL-8112 CHR",
  "PL-8113 BG", "PL-8113 BN", "PL-8113 CHR", "PL-8113 MB",
  "PL-8116 BN", "PL-8116 CHR", "PL-8116 MB",
  "PL-8136 BN",
  "PL-8142 BG", "PL-8142 BN", "PL-8142 CHR", "PL-8142 MB",
  "PL-8162 BN", "PL-8162 CHR",
  "PL-8312 BG", "PL-8312 BN", "PL-8312 CHR", "PL-8312 MB",
  "PL-8330 BG", "PL-8330 BN", "PL-8330 CHR", "PL-8330 MB",
];

/** Tags stored on `pelican_products.bathroomFixtureTags` (comma-delimited). */
export const PELICAN_BATHROOM_TAG = {
  vanitySink: "bathroom-vanity-sink",
  vanityFaucet: "bathroom-vanity-faucet",
  undermount: "mount-undermount",
  dropIn: "mount-drop-in",
  vessel: "mount-vessel",
  integrated: "mount-integrated",
  singleBowl: "bowl-single",
  doubleBowl: "bowl-double",
  holes1: "faucet-holes-1",
  holes3: "faucet-holes-3",
  spread4: "faucet-spread-4",
  spread8: "faucet-spread-8",
  vesselFaucet: "faucet-for-vessel-sink",
} as const;

/** A vanity top wide enough for a second basin; used to gate any double-bowl offer. */
export const PELICAN_DOUBLE_BOWL_MIN_VANITY_WIDTH_IN = 48;

function normalizeModel(sku: string | null | undefined): string {
  return (sku ?? "").trim().toUpperCase();
}

/**
 * Resolve the vanity-sink record for an exact catalog SKU.
 *
 * A record is matched on its model number plus a known variant suffix only:
 * finish names ("WHITE", "BONE", "MATTE BLACK", "GLOSS BLACK", "MATTE GREY"),
 * packaging ("INDIVIDUALLY PACKED"), or the two PL-1011 pre-drilled spreads.
 * A code with an unrecognised suffix, or a bare model the catalog does not sell
 * under that exact string, returns null rather than a nearest guess.
 */
export function pelicanVanitySinkProfile(code: string | null | undefined): PelicanVanitySink | null {
  const normalized = normalizeModel(code);
  if (!normalized) return null;
  if (!PELICAN_VANITY_SINK_SKUS.includes(code!.trim())) return null;
  // PL-1011 ships one SKU per pre-drilled spread, so the suffix selects the record.
  if (/^PL-1011\s+SPREAD\s+8/.test(normalized)) {
    return PELICAN_VANITY_SINKS.find((entry) => entry.model === "PL-1011" && entry.faucetSpreadIn === 8) ?? null;
  }
  if (/^PL-1011\s+SPREAD\s+4/.test(normalized)) {
    return PELICAN_VANITY_SINKS.find((entry) => entry.model === "PL-1011" && entry.faucetSpreadIn === 4) ?? null;
  }
  const model = normalized.match(/^PL-(?:[RO]\d{4}|\d{4})/)?.[0] ?? null;
  if (!model) return null;
  return PELICAN_VANITY_SINKS.find((entry) => entry.model === model) ?? null;
}

/** Resolve the vanity-faucet record for an exact catalog SKU. */
export function pelicanVanityFaucetProfile(code: string | null | undefined): PelicanVanityFaucet | null {
  if (!PELICAN_VANITY_FAUCET_SKUS.includes((code ?? "").trim())) return null;
  const model = normalizeModel(code).match(/^PL-\d{4}/)?.[0] ?? null;
  if (!model) return null;
  return PELICAN_VANITY_FAUCETS.find((entry) => entry.model === model) ?? null;
}

export function isPelicanVanitySinkSku(code: string | null | undefined): boolean {
  return pelicanVanitySinkProfile(code) != null;
}

export function isPelicanVanityFaucetSku(code: string | null | undefined): boolean {
  return pelicanVanityFaucetProfile(code) != null;
}

/** The tags a vanity sink's catalog row should carry. */
export function pelicanVanitySinkTags(profile: PelicanVanitySink): string[] {
  const mountTag = profile.mount === "undermount" ? PELICAN_BATHROOM_TAG.undermount
    : profile.mount === "drop-in" ? PELICAN_BATHROOM_TAG.dropIn
      : profile.mount === "vessel" ? PELICAN_BATHROOM_TAG.vessel
        : PELICAN_BATHROOM_TAG.integrated;
  const tags: string[] = [
    PELICAN_BATHROOM_TAG.vanitySink,
    mountTag,
    profile.bowlCount === 2 ? PELICAN_BATHROOM_TAG.doubleBowl : PELICAN_BATHROOM_TAG.singleBowl,
  ];
  if (profile.faucetHoles === 1) tags.push(PELICAN_BATHROOM_TAG.holes1);
  if (profile.faucetHoles === 3) tags.push(PELICAN_BATHROOM_TAG.holes3);
  if (profile.faucetSpreadIn === 4) tags.push(PELICAN_BATHROOM_TAG.spread4);
  if (profile.faucetSpreadIn === 8) tags.push(PELICAN_BATHROOM_TAG.spread8);
  return tags;
}

/** The tags a vanity faucet's catalog row should carry. */
export function pelicanVanityFaucetTags(profile: PelicanVanityFaucet): string[] {
  const tags: string[] = [PELICAN_BATHROOM_TAG.vanityFaucet];
  if (profile.faucetHoles === 1) tags.push(PELICAN_BATHROOM_TAG.holes1);
  if (profile.faucetHoles === 3) tags.push(PELICAN_BATHROOM_TAG.holes3);
  if (profile.faucetSpreadIn === 4) tags.push(PELICAN_BATHROOM_TAG.spread4);
  if (profile.faucetSpreadIn === 8) tags.push(PELICAN_BATHROOM_TAG.spread8);
  if (profile.forVesselSink) tags.push(PELICAN_BATHROOM_TAG.vesselFaucet);
  return tags;
}

/**
 * True when a vanity faucet physically suits a vanity sink's drilling.
 *
 * "Matches when the data allows": a sink whose sheet states its hole count only
 * accepts a faucet with the same hole count. The spread is enforced only when the
 * sink's own sheet publishes one — Pelican's porcelain records state a spread
 * ("4" Spread Between Holes"), but the Cove cultured-marble tops state only
 * "3 Pre-Drilled Faucet Holes" with no spacing, so `spreadVerified` stays false
 * and the Designer asks for confirmation instead of silently excluding a faucet.
 *
 * A sink whose sheet publishes no hole count (an undermount or vessel basin is
 * drilled in the countertop, not in the china) accepts any vanity faucet.
 */
export function vanityFaucetSinkMatch(
  faucet: PelicanVanityFaucet,
  sink: PelicanVanitySink | null | undefined,
): { fits: boolean; spreadVerified: boolean } {
  if (!sink) return { fits: true, spreadVerified: false };
  if (sink.faucetHoles != null && faucet.faucetHoles !== sink.faucetHoles) return { fits: false, spreadVerified: false };
  if (sink.faucetHoles === 3 && sink.faucetSpreadIn != null) {
    return { fits: faucet.faucetSpreadIn === sink.faucetSpreadIn, spreadVerified: true };
  }
  return { fits: true, spreadVerified: false };
}

/** Convenience wrapper over `vanityFaucetSinkMatch` for callers that only filter. */
export function vanityFaucetFitsSink(
  faucet: PelicanVanityFaucet,
  sink: PelicanVanitySink | null | undefined,
): boolean {
  return vanityFaucetSinkMatch(faucet, sink).fits;
}

/** Plain-language mounting label for the picker, taken from the source sheet. */
export function pelicanVanitySinkMountLabel(profile: PelicanVanitySink): string {
  if (profile.mount === "undermount") return "Undermount basin";
  if (profile.mount === "drop-in") return "Drop-in / self-rimming basin";
  if (profile.mount === "vessel") return "Vessel (above-counter) basin";
  return "Integrated vanity top";
}

export function pelicanVanityFaucetMountLabel(profile: PelicanVanityFaucet): string {
  if (profile.mount === "single-hole") return `Single hole${profile.forVesselSink ? " · vessel height" : ""}`;
  if (profile.mount === "centerset-4") return 'Three hole · 4" centerset';
  return 'Three hole · 8" widespread';
}
