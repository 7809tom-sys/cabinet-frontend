import { describe, expect, it } from "vitest";
import {
  DEFAULT_BAR_THICKNESS_IN,
  DEFAULT_KNOB_DIAMETER_IN,
  hardwareDrawSpec,
  hardwareDrawnSizeIn,
  hardwareFamilyFor,
  measuredHardwareGeometry,
  mixHexColor,
  parseHardwareDimensions,
  placeHardwarePiece,
  type HardwareDrawSpec,
} from "./hardwareElevation";
import type { CatalogHardwareSelection } from "./hardware";

function pick(overrides: Partial<CatalogHardwareSelection> = {}): CatalogHardwareSelection {
  return {
    vendorProductId: 1,
    sku: "SKU",
    collection: "Aiden",
    productType: "Pull",
    configurationKey: "cfg",
    configurationLabel: '5" Overall Length Cabinet Pull. Holes are 96 mm center-to-center.',
    finish: "Satin Nickel",
    imageUrl: null,
    ...overrides,
  };
}

describe("parseHardwareDimensions — millimetres", () => {
  it("reads a millimetre center-to-center figure and the inch overall length", () => {
    const parsed = parseHardwareDimensions('4-13/16" Overall Length Cabinet pull, 96 mm Center to Center with two 8-32 x 1" screws');
    expect(parsed.overallLengthIn).toBeCloseTo(4.8125, 4);
    expect(parsed.centerToCenterIn).toBeCloseTo(96 / 25.4, 4);
  });

  it("reads a millimetre-only overall length", () => {
    const parsed = parseHardwareDimensions("105mm Overall Length Square Cabinet Bar Pull. Holes are 96 mm center-to-center.");
    expect(parsed.overallLengthIn).toBeCloseTo(105 / 25.4, 4);
    expect(parsed.centerToCenterIn).toBeCloseTo(96 / 25.4, 4);
  });

  it("reads the spacing when it follows the keyword", () => {
    const parsed = parseHardwareDimensions('7" Overall Length Cabinet Pull. Holes are 160 mm center-to-center.');
    expect(parsed.centerToCenterIn).toBeCloseTo(160 / 25.4, 4);
  });
});

describe("parseHardwareDimensions — inches and fractions", () => {
  it("reads whole inches", () => {
    expect(parseHardwareDimensions('5" Overall Length Cabinet Pull.').overallLengthIn).toBe(5);
  });

  it("reads mixed fractions", () => {
    expect(parseHardwareDimensions('13-15/16" Overall Length Rectangle Cabinet Pull.').overallLengthIn).toBeCloseTo(13.9375, 4);
    expect(parseHardwareDimensions('1-5/8" Diameter Zinc Die Cast Cabinet Knob.').diameterIn).toBeCloseTo(1.625, 4);
  });

  it("reads a plain fraction with no whole inch", () => {
    expect(parseHardwareDimensions('7/8" Overall Length Pull.').overallLengthIn).toBeCloseTo(0.875, 4);
  });

  it("reads an inch center-to-center figure", () => {
    const parsed = parseHardwareDimensions('3-3/8" Overall Length Cabinet Pull. Holes are 3" center-to-center.');
    expect(parsed.overallLengthIn).toBeCloseTo(3.375, 4);
    expect(parsed.centerToCenterIn).toBeCloseTo(3, 4);
  });

  it("reads a label whose size has no keyword", () => {
    expect(parseHardwareDimensions('1-1/4" Cabinet Knob.').overallLengthIn).toBeCloseTo(1.25, 4);
  });
});

describe("parseHardwareDimensions — center-to-center vs overall length", () => {
  it("keeps the two dimensions distinct on a bar pull", () => {
    const parsed = parseHardwareDimensions('6-1/8" Overall Length Cabinet pull, 128 mm Center to Center with two 8-32 x 1" screws');
    expect(parsed.overallLengthIn).toBeCloseTo(6.125, 4);
    expect(parsed.centerToCenterIn).toBeCloseTo(128 / 25.4, 4);
    expect(parsed.overallLengthIn).not.toBeCloseTo(parsed.centerToCenterIn!, 2);
  });

  it("accepts the lowercase 'center-to-center' spelling and the postfixed number", () => {
    const parsed = parseHardwareDimensions('5-7/8" Overall Length Forged Look Flat Bottom Pull 128 mm center-to-center.');
    expect(parsed.centerToCenterIn).toBeCloseTo(128 / 25.4, 4);
  });

  it("prefers the inch figure when the label states the same size twice", () => {
    const parsed = parseHardwareDimensions('48 mm (1-7/8") Overall Length Steel 9/16" Diameter Cabinet Bar Pull "T" Knob.');
    expect(parsed.overallLengthIn).toBeCloseTo(1.875, 4);
    expect(parsed.diameterIn).toBeCloseTo(0.5625, 4);
  });

  it("reports a double-tapped pull as an ambiguous spacing instead of guessing one", () => {
    const parsed = parseHardwareDimensions('7-1/8" Overall Length Cabinet Pull. Holes are double tapped for 128 mm and 160 mm center-to-center.');
    expect(parsed.centerToCenterAmbiguous).toBe(true);
    expect(parsed.centerToCenterIn).toBeNull();
    expect(parsed.overallLengthIn).toBeCloseTo(7.125, 4);
  });
});

describe("parseHardwareDimensions — never reads packaging text", () => {
  it("ignores screw sizes after the packaged-with sentence", () => {
    const parsed = parseHardwareDimensions('1" Diameter Cabinet Knob. Packaged with one 8-32 x 1-1/8" and 1-3/4" Break-away screw.');
    expect(parsed.diameterIn).toBe(1);
    expect(parsed.overallLengthIn).toBeNull();
  });

  it("returns nothing for text with no measurement at all", () => {
    const parsed = parseHardwareDimensions("Polished chrome cabinet pull");
    expect(parsed).toEqual({ overallLengthIn: null, centerToCenterIn: null, diameterIn: null, centerToCenterAmbiguous: false });
  });
});

describe("hardwareFamilyFor — catalog pick to handle family", () => {
  it("maps each supported product type to a family", () => {
    expect(hardwareFamilyFor(pick({ productType: "Pull" }))).toBe("bar-pull");
    expect(hardwareFamilyFor(pick({ productType: "Bar pull" }))).toBe("bar-pull");
    expect(hardwareFamilyFor(pick({ productType: "Cup pull", configurationLabel: '4-15/16" Overall Length Shaker Cabinet Cup Pull.' }))).toBe("cup-pull");
    expect(hardwareFamilyFor(pick({ productType: "Tab pull", configurationLabel: '4" Overall Length Tab Pull.' }))).toBe("edge-pull");
    expect(hardwareFamilyFor(pick({ productType: "T-knob", configurationLabel: '2" Overall Length Cabinet "T" Knob.' }))).toBe("t-bar");
    expect(hardwareFamilyFor(pick({ productType: "Knob", configurationLabel: '1-1/8" Diameter Cabinet Knob.' }))).toBe("round-knob");
    expect(hardwareFamilyFor(pick({ productType: "Knob", configurationLabel: '1-1/8" Overall Length Square Cabinet Knob.' }))).toBe("square-knob");
  });

  it("maps an arched or bow pull to the arch family", () => {
    expect(hardwareFamilyFor(pick({ productType: "Pull", configurationLabel: '4-5/16" Overall Length Scroll Cabinet Pull.' }))).toBe("arch-pull");
    expect(hardwareFamilyFor(pick({ productType: "Pull", configurationLabel: '5" Overall Length Bow Cabinet Pull.' }))).toBe("arch-pull");
  });

  it("maps a named edge/finger pull to the edge family", () => {
    expect(hardwareFamilyFor(pick({ productType: "Pull", configurationLabel: '1-1/2" Overall Length Finger Pull.' }))).toBe("edge-pull");
  });

  it("refuses appliance handles and unknown types", () => {
    expect(hardwareFamilyFor(pick({ productType: "Appliance handle" }))).toBeNull();
    expect(hardwareFamilyFor(pick({ productType: "Door stop" }))).toBeNull();
    expect(hardwareFamilyFor(null)).toBeNull();
  });
});

describe("hardwareDrawSpec — real sizes only", () => {
  it("uses the catalog overall length for a pull", () => {
    const spec = hardwareDrawSpec(pick())!;
    expect(spec.family).toBe("bar-pull");
    expect(spec.lengthIn).toBe(5);
    expect(spec.centerToCenterIn).toBeCloseTo(96 / 25.4, 4);
    expect(spec.measured).toBe(true);
    expect(spec.thicknessSource).toBe("default");
    expect(spec.thicknessIn).toBe(DEFAULT_BAR_THICKNESS_IN);
  });

  it("reads a knob body diameter instead of a pull length", () => {
    const spec = hardwareDrawSpec(pick({ productType: "Knob", configurationLabel: '1-5/8" Diameter Zinc Die Cast Cabinet Knob.' }))!;
    expect(spec.knob).toBe(true);
    expect(spec.lengthIn).toBeCloseTo(1.625, 4);
    expect(spec.thicknessIn).toBeCloseTo(1.625, 4);
    expect(spec.thicknessSource).toBe("catalog");
  });

  it("marks a label with no readable size as unparseable instead of inventing one", () => {
    const spec = hardwareDrawSpec(pick({ configurationLabel: "Pull with no dimensions in the title" }))!;
    expect(spec.measured).toBe(false);
    expect(spec.unparseable).toBe(true);
    expect(spec.lengthIn).toBeNull();
    // The fallback thickness is a drawing value, never presented as catalog data.
    expect(spec.thicknessIn).toBe(DEFAULT_BAR_THICKNESS_IN);
    expect(spec.thicknessSource).toBe("default");
  });

  it("returns no spec for a non-cabinet product", () => {
    expect(hardwareDrawSpec(pick({ productType: "Appliance handle" }))).toBeNull();
    expect(hardwareDrawSpec(null)).toBeNull();
  });

  it("prefers overall length over spacing, and falls back to spacing when length is missing", () => {
    const withLength = hardwareDrawSpec(pick({ configurationLabel: '6-1/8" Overall Length Cabinet pull, 128 mm Center to Center' }))!;
    expect(withLength.lengthIn).toBeCloseTo(6.125, 4);
    const spacingOnly = hardwareDrawSpec(pick({ configurationLabel: 'Cabinet Pull, 128 mm Center to Center.' }))!;
    // The spec rounds to a thousandth of an inch; that is a drawing value, not a price or an order.
    expect(spacingOnly.lengthIn).toBeCloseTo(128 / 25.4, 2);
  });
});

describe("hardwareDrawnSizeIn", () => {
  const base: HardwareDrawSpec = {
    family: "bar-pull",
    knob: false,
    lengthIn: 5,
    thicknessIn: DEFAULT_BAR_THICKNESS_IN,
    centerToCenterIn: null,
    measured: true,
    thicknessSource: "default",
    unparseable: false,
  };

  it("keeps a bar's real length as its drawn width", () => {
    expect(hardwareDrawnSizeIn(base).widthIn).toBe(5);
  });

  it("draws a knob as a square body", () => {
    const size = hardwareDrawnSizeIn({ ...base, family: "round-knob", knob: true, lengthIn: 1.25, thicknessIn: 1.25 });
    expect(size.widthIn).toBeCloseTo(1.25, 4);
    expect(size.heightIn).toBeCloseTo(1.25, 4);
  });

  it("makes a cup pull taller on the face than a bar of the same length", () => {
    expect(hardwareDrawnSizeIn({ ...base, family: "cup-pull" }).heightIn)
      .toBeGreaterThan(hardwareDrawnSizeIn(base).heightIn);
  });
});

describe("placeHardwarePiece / measuredHardwareGeometry", () => {
  const barSpec: HardwareDrawSpec = {
    family: "bar-pull",
    knob: false,
    lengthIn: 8,
    thicknessIn: 0.44,
    centerToCenterIn: 6.25,
    measured: true,
    thicknessSource: "catalog",
    unparseable: false,
  };

  it("keeps the real length when it fits and reports it as full size", () => {
    const placed = placeHardwarePiece({ spec: barSpec, faceWidthIn: 24, faceHeightIn: 30, centerFromLeftIn: 12, centerFromTopIn: 15, vertical: false });
    expect(placed.widthIn).toBe(8);
    expect(placed.clamped).toBe(false);
  });

  it("shrinks a pull that is wider than the front and says so", () => {
    const placed = placeHardwarePiece({ spec: barSpec, faceWidthIn: 8, faceHeightIn: 30, centerFromLeftIn: 4, centerFromTopIn: 15, vertical: false });
    expect(placed.widthIn).toBeLessThanOrEqual(8 * 0.92 + 1e-9);
    expect(placed.clamped).toBe(true);
  });

  it("rotates a door pull: the real length runs down the face", () => {
    const geometry = measuredHardwareGeometry({
      spec: barSpec, faceWidthIn: 18, faceHeightIn: 34.5, centerFromLeftIn: 16.5, centerFromTopIn: 10,
      bandTopPct: 45, bandHeightPct: 55, vertical: true,
    });
    expect(geometry.heightPct).toBeCloseTo((8 / 34.5) * 100, 6);
    expect(geometry.heightPct).toBeGreaterThan(geometry.widthPct);
  });

  it("pins an edge pull to the top of its band", () => {
    const edgeSpec: HardwareDrawSpec = { ...barSpec, family: "edge-pull", lengthIn: 4 };
    const geometry = measuredHardwareGeometry({
      spec: edgeSpec, faceWidthIn: 24, faceHeightIn: 30, centerFromLeftIn: 12, centerFromTopIn: 20,
      bandTopPct: 0, bandHeightPct: 100, vertical: false,
    });
    expect(geometry.edgeMounted).toBe(true);
    const topPct = geometry.topPct - geometry.heightPct / 2;
    expect(topPct).toBeCloseTo(0, 6);
  });

  it("expresses sizes as front percentages so they scale with the drawing", () => {
    const geometry = measuredHardwareGeometry({
      spec: barSpec, faceWidthIn: 16, faceHeightIn: 32, centerFromLeftIn: 8, centerFromTopIn: 16,
      bandTopPct: 0, bandHeightPct: 100, vertical: false,
    });
    expect(geometry.widthPct).toBeCloseTo(50, 6);
    expect(geometry.leftPct).toBeCloseTo(50, 6);
    expect(geometry.topPct).toBeCloseTo(50, 6);
  });
});

describe("mixHexColor", () => {
  it("mixes toward white and black", () => {
    expect(mixHexColor("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHexColor("#1d2024", "#000000", 0.5)).toBe("#0f1012");
  });

  it("expands short hex and survives junk", () => {
    expect(mixHexColor("#fff", "#000000", 0)).toBe("#ffffff");
    expect(mixHexColor("not-a-color", "#ffffff", 0)).toBe("#c8ccd0");
  });
});
