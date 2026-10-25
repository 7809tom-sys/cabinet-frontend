import { describe, expect, it } from "vitest";
import { hasVerifiedPelicanFixtureProfile, isPelicanSinkCompatibleWithBase, pelicanSinkBaseKind, sinkBaseOpeningWidthIn, verifiedPelicanFaucetProfile, verifiedPelicanPotFillerProfile, verifiedPelicanSinkFitsCabinet, verifiedPelicanSinkProfile } from "./pelicanFixtureProfiles";

describe("verifiedPelicanSinkProfile", () => {
  it("recognizes imported Farmhouse Series color variants without treating their abbreviated size fields as authoritative", () => {
    expect(verifiedPelicanSinkProfile("PL-FC3018SB Black")).toBeNull();
    expect(verifiedPelicanSinkProfile("PL-FC3318SB Grey")).toBeNull();
    expect(verifiedPelicanSinkProfile("PL-FC3321SB White")).toBeNull();
    expect(verifiedPelicanSinkProfile("PL-FC3620SB White")).toBeNull();
  });

  it("distinguishes the measured standard and ADA PL-HA109 undermount depths", () => {
    expect(verifiedPelicanSinkProfile("PL-HA109 R15 16g")).toMatchObject({
      installation: "undermount",
      apronFront: false,
      exteriorHeightIn: 10,
      bowlHeightIn: 10,
      drainInsetBackIn: 1,
    });
    expect(verifiedPelicanSinkProfile("PL-HA109 ADA R0 18g")).toMatchObject({
      installation: "undermount",
      apronFront: false,
      exteriorHeightIn: 5.5,
      bowlHeightIn: 5.5,
    });
  });

  it("maps the PL-HA115 R0 source-verified normal-depth standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA115 R0 16g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 32,
      exteriorDepthIn: 18,
      exteriorHeightIn: 10,
      bowlWidthIn: 30,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps the PL-VS3218 source-verified normal-depth standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VS3218 18g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 32.125,
      exteriorDepthIn: 18,
      exteriorHeightIn: 9,
      bowlWidthIn: 30.125,
      bowlDepthIn: 16,
      bowlHeightIn: 9,
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps the PL-VS3018 source-verified normal-depth standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VS3018 16g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 30,
      exteriorDepthIn: 18,
      exteriorHeightIn: 9,
      bowlWidthIn: 28,
      bowlDepthIn: 16,
      bowlHeightIn: 9,
      minimumCabinetWidthIn: 30,
    });
  });

  it("maps PL-VS3018 18G ADA as shallow source-measured geometry without changing the standard base contract", () => {
    expect(verifiedPelicanSinkProfile("PL-VS3018 18G ADA")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 30,
      exteriorDepthIn: 18,
      exteriorHeightIn: 5.5,
      bowlWidthIn: 28,
      bowlDepthIn: 16,
      bowlHeightIn: 5.5,
      minimumCabinetWidthIn: 30,
    });
  });

  it("maps the PL-VS2718 source-verified normal-depth standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VS2718 18g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 27,
      exteriorDepthIn: 18,
      exteriorHeightIn: 9,
      bowlWidthIn: 25,
      bowlDepthIn: 16,
      bowlHeightIn: 9,
      minimumCabinetWidthIn: 27,
    });
  });

  it("maps the PL-VS1815 source-verified compact standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VS1815 18g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 18.5,
      exteriorDepthIn: 15,
      exteriorHeightIn: 7,
      bowlWidthIn: 16.5,
      bowlDepthIn: 13,
      bowlHeightIn: 7,
      minimumCabinetWidthIn: 21,
    });
  });

  it("maps the PL-VS1513 source-verified compact standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VS1513 18g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 15,
      exteriorDepthIn: 12.75,
      exteriorHeightIn: 6.75,
      bowlWidthIn: 13,
      bowlDepthIn: 10.75,
      bowlHeightIn: 6.75,
      minimumCabinetWidthIn: 18,
    });
  });

  it("maps the PL-VS2118 source-verified compact standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VS2118 18g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 20.625,
      exteriorDepthIn: 17.875,
      exteriorHeightIn: 9,
      bowlWidthIn: 18.625,
      bowlDepthIn: 15.875,
      bowlHeightIn: 9,
      minimumCabinetWidthIn: 21,
    });
  });

  it("maps the PL-VS2318 source-verified normal-depth standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VS2318 16g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 23,
      exteriorDepthIn: 17.75,
      exteriorHeightIn: 9,
      bowlWidthIn: 21,
      bowlDepthIn: 15.75,
      bowlHeightIn: 9,
      minimumCabinetWidthIn: 24,
    });
  });

  it("maps PL-VS7030 as a source-verified stainless double-bowl profile with independent bowl dimensions and heights", () => {
    expect(verifiedPelicanSinkProfile("PL-VS7030 16g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 31.5,
      exteriorDepthIn: 20.5,
      exteriorHeightIn: 9,
      bowlCount: 2,
      bowlWidthsIn: [17.75, 10.625],
      bowlDepthsIn: [18.5, 16],
      bowlHeightsIn: [9, 7],
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps PL-VS4060 as a source-verified stainless double-bowl profile with independent stepped-bowl dimensions", () => {
    expect(verifiedPelicanSinkProfile("PL-VS4060 18g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 32.125,
      exteriorDepthIn: 20.625,
      exteriorHeightIn: 9,
      bowlCount: 2,
      bowlWidthsIn: [13, 15.875],
      bowlDepthsIn: [16.5, 18.625],
      bowlHeightsIn: [7, 9],
      minimumCabinetWidthIn: 33,
    });
  });

  it("maps PL-VS4040 as a source-verified compact stainless equal double-bowl standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VS4040 18g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 29.125,
      exteriorDepthIn: 18.5,
      exteriorHeightIn: 8,
      bowlWidthIn: 13,
      bowlDepthIn: 16.5,
      bowlHeightIn: 8,
      bowlCount: 2,
      minimumCabinetWidthIn: 30,
    });
  });

  it("maps PL-VS5050 as a source-verified stainless equal double-bowl standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VS5050 16g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 32.125,
      exteriorDepthIn: 18,
      exteriorHeightIn: 9,
      bowlWidthIn: 14.5,
      bowlDepthIn: 16,
      bowlHeightIn: 9,
      bowlCount: 2,
      minimumCabinetWidthIn: 33,
    });
  });

  it("maps PL-VS5050 ADA as a source-verified shallow equal double-bowl profile without changing cabinet-height behavior", () => {
    expect(verifiedPelicanSinkProfile("PL-VS5050 18g ADA")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 32.125,
      exteriorDepthIn: 18,
      exteriorHeightIn: 5.5,
      bowlWidthIn: 14.5,
      bowlDepthIn: 16,
      bowlHeightIn: 5.5,
      bowlCount: 2,
      minimumCabinetWidthIn: 33,
    });
  });

  it("maps PL-VR5050 R20 as a source-verified stainless equal double-bowl standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VR5050 R20")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 31,
      exteriorDepthIn: 18,
      exteriorHeightIn: 9,
      bowlWidthIn: 14,
      bowlDepthIn: 16,
      bowlHeightIn: 9,
      bowlCount: 2,
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps PL-VR6040 R20 as a source-verified stainless stepped double-bowl profile with independent bowl dimensions", () => {
    expect(verifiedPelicanSinkProfile("PL-VR6040 R20")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 31.5,
      exteriorDepthIn: 20.5,
      exteriorHeightIn: 9,
      bowlCount: 2,
      bowlWidthsIn: [15.75, 12.75],
      bowlDepthsIn: [18.5, 16],
      bowlHeightsIn: [9, 8],
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps PL-VR2318 R20 as a source-verified compact stainless standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VR2318 R20")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 23,
      exteriorDepthIn: 18,
      exteriorHeightIn: 9,
      bowlWidthIn: 21,
      bowlDepthIn: 16,
      bowlHeightIn: 9,
      minimumCabinetWidthIn: 24,
    });
  });

  it("maps PL-VR1816 R20 as a source-verified compact stainless standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VR1816 R20")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 18,
      exteriorDepthIn: 16,
      exteriorHeightIn: 9,
      bowlWidthIn: 16,
      bowlDepthIn: 14,
      bowlHeightIn: 9,
      minimumCabinetWidthIn: 21,
    });
  });

  it("maps PL-VR2718 R20 as a source-verified stainless standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VR2718 R20")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 27,
      exteriorDepthIn: 18,
      exteriorHeightIn: 9,
      bowlWidthIn: 25,
      bowlDepthIn: 16,
      bowlHeightIn: 9,
      minimumCabinetWidthIn: 27,
    });
  });

  it("maps PL-VR2718 ADA as shallow source-measured geometry without changing the standard base contract", () => {
    expect(verifiedPelicanSinkProfile("PL-VR2718 ADA")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 27,
      exteriorDepthIn: 18,
      exteriorHeightIn: 5.5,
      bowlWidthIn: 25,
      bowlDepthIn: 16,
      bowlHeightIn: 5.5,
      minimumCabinetWidthIn: 27,
    });
  });

  it("maps PL-VR3118 R20 as a source-verified stainless standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-VR3118 R20")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 31,
      exteriorDepthIn: 18,
      exteriorHeightIn: 9,
      bowlWidthIn: 29,
      bowlDepthIn: 16,
      bowlHeightIn: 9,
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps PL-VR3118 ADA as a shallow source-measured sink without changing the standard base contract", () => {
    expect(verifiedPelicanSinkProfile("PL-VR3118 ADA")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 31,
      exteriorDepthIn: 18,
      exteriorHeightIn: 5.5,
      bowlWidthIn: 29,
      bowlDepthIn: 16,
      bowlHeightIn: 5.5,
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps PL-VR4060 R20 as a source-verified stainless stepped double-bowl profile with independent bowl dimensions", () => {
    expect(verifiedPelicanSinkProfile("PL-VR4060 R20")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 31.5,
      exteriorDepthIn: 20.5,
      exteriorHeightIn: 9,
      bowlCount: 2,
      bowlWidthsIn: [12.75, 15.75],
      bowlDepthsIn: [16, 18.5],
      bowlHeightsIn: [8, 9],
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps PL-VS3070 as a source-verified stainless stepped double-bowl profile with independent bowl dimensions", () => {
    expect(verifiedPelicanSinkProfile("PL-VS3070 16g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 31.5,
      exteriorDepthIn: 20.5,
      exteriorHeightIn: 9,
      bowlCount: 2,
      bowlWidthsIn: [10.625, 17.75],
      bowlDepthsIn: [16, 18.5],
      bowlHeightsIn: [7, 9],
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps the PL-HA104 R0 source-verified compact standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA104 R0 16g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 17,
      exteriorDepthIn: 18,
      exteriorHeightIn: 10,
      bowlWidthIn: 15,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      drainInsetBackIn: 1,
      minimumCabinetWidthIn: 18,
    });
  });

  it("maps the PL-HA108 R0 source-verified normal-depth standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA108 R0 18g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 23,
      exteriorDepthIn: 18,
      exteriorHeightIn: 10,
      bowlWidthIn: 21,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      drainInsetBackIn: 1,
      minimumCabinetWidthIn: 24,
    });
  });

  it("maps the PL-HA111 R0 source-verified normal-depth standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA111 R0 18g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 27,
      exteriorDepthIn: 18,
      exteriorHeightIn: 10,
      bowlWidthIn: 25,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      drainInsetBackIn: 1,
      minimumCabinetWidthIn: 27,
    });
  });

  it("maps the PL-HA117 R0 source-verified equal double-bowl standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA117 R0 16g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 32,
      exteriorDepthIn: 18,
      exteriorHeightIn: 10,
      bowlWidthIn: 14.5,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      bowlCount: 2,
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps the PL-HA119 R19 source-verified rear-right drain offset profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA119 R19 18g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 31.25,
      exteriorDepthIn: 18,
      exteriorHeightIn: 10,
      bowlWidthIn: 29.25,
      bowlDepthIn: 16,
      bowlHeightIn: 9.5,
      drainInsetRightIn: 5,
      drainInsetBackIn: 5,
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps the PL-HA126 R0 source-verified asymmetric double-bowl standard undermount profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA126 R0 16g")).toMatchObject({
      installation: "undermount",
      sinkType: "single",
      apronFront: false,
      exteriorWidthIn: 31.25,
      exteriorDepthIn: 20.5,
      exteriorHeightIn: 10,
      bowlWidthIn: 14,
      bowlDepthIn: 18,
      bowlHeightIn: 10,
      bowlCount: 2,
      bowlWidthsIn: [14, 13.5],
      bowlDepthsIn: [18, 16],
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 32,
    });
  });

  it("maps the PL-HA128 R15 source-verified double-bowl farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA128 R15 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 33,
      exteriorDepthIn: 21,
      drainInsetBackIn: 120 / 25.4,
      exteriorHeightIn: 10,
      bowlWidthIn: 14.5,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      bowlCount: 2,
      minimumCabinetWidthIn: 33,
    });
  });

  it("maps the PL-HA135 R0 source-verified retrofit stainless-steel farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA135 R0 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 35.5,
      exteriorDepthIn: 21.25,
      exteriorHeightIn: 9.375,
      bowlWidthIn: 32.5,
      bowlDepthIn: 17.25,
      bowlHeightIn: 9.125,
      minimumCabinetWidthIn: 36,
    });
  });

  it("maps the PL-GMB135 R0 source-verified gunmetal retrofit farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-GMB135 R0 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 35.5,
      exteriorDepthIn: 21.25,
      exteriorHeightIn: 9.375,
      bowlWidthIn: 32.5,
      bowlDepthIn: 17.25,
      bowlHeightIn: 9.125,
      surfaceFinish: "gunmetal-black",
      minimumCabinetWidthIn: 36,
    });
  });

  it("maps the PL-HA136 R15 source-verified asymmetric double-bowl farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA136")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 33,
      exteriorDepthIn: 21,
      exteriorHeightIn: 10,
      bowlWidthIn: 17,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      bowlCount: 2,
      bowlWidthsIn: [17, 12],
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 33,
    });
  });

  it("maps the PL-HA139 R15 source-verified asymmetric double-bowl farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA139 R15 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 33,
      exteriorDepthIn: 21,
      exteriorHeightIn: 10,
      bowlWidthIn: 12,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      bowlCount: 2,
      bowlWidthsIn: [12, 17],
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 33,
    });
  });

  it("maps the PL-HA130 R0 source-verified equal double-bowl farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA130 R0 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 36,
      exteriorDepthIn: 21,
      exteriorHeightIn: 10,
      bowlWidthIn: 16,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      bowlCount: 2,
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 36,
    });
  });

  it("maps the PL-HA122 R15 source-verified single-bowl farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA122 R15 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 32.875,
      exteriorDepthIn: 20.75,
      exteriorHeightIn: 10,
      bowlWidthIn: 30,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 33,
    });
  });

  it("maps the PL-HA118 R15 source-verified compact single-bowl farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA118 R15 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 30,
      exteriorDepthIn: 21,
      exteriorHeightIn: 10,
      bowlWidthIn: 27,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 30,
    });
  });

  it("maps the PL-HA125 R0 source-verified asymmetric double-bowl farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA125 R0 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 35.875,
      exteriorDepthIn: 20.75,
      exteriorHeightIn: 10,
      bowlWidthIn: 19,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      bowlCount: 2,
      bowlWidthsIn: [19, 13],
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 36,
    });
  });

  it("maps the PL-HA124 R0 source-verified single-bowl farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA124 R0 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 35.875,
      exteriorDepthIn: 20.75,
      exteriorHeightIn: 10,
      bowlWidthIn: 33,
      bowlDepthIn: 16,
      bowlHeightIn: 10,
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 36,
    });
  });

  it("maps the PL-HA144 R10 source-verified single-bowl farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA144 R10 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 33,
      exteriorDepthIn: 21,
      exteriorHeightIn: 10,
      bowlWidthIn: 31,
      bowlDepthIn: 16,
      bowlHeightIn: 9.75,
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 33,
    });
  });

  it("maps the PL-HA148 R10 source-verified single-bowl farmhouse profile", () => {
    expect(verifiedPelicanSinkProfile("PL-HA148 R10 16g")).toMatchObject({
      installation: "apron-front-undermount",
      sinkType: "farmhouse",
      apronFront: true,
      exteriorWidthIn: 36,
      exteriorDepthIn: 21,
      exteriorHeightIn: 10,
      bowlWidthIn: 34,
      bowlDepthIn: 16,
      bowlHeightIn: 9.75,
      drainInsetBackIn: 120 / 25.4,
      minimumCabinetWidthIn: 36,
    });
  });

  it("keeps PL-FC2522SB outside physical placement while its reversible front and drain datum remain source-incomplete", () => {
    expect(verifiedPelicanSinkProfile("PL-FC2522SB White")).toBeNull();
  });

  it("keeps PL-FC3219SB outside physical placement while its offset drain lacks a numerical datum", () => {
    expect(verifiedPelicanSinkProfile("PL-FC3219SB White")).toBeNull();
  });

  it("keeps PL-FC3318DB outside physical placement while its reversible front and drain data remain source-incomplete", () => {
    expect(verifiedPelicanSinkProfile("PL-FC3318DB White")).toBeNull();
  });

  it("uses Pelican’s published PL-8203 dimensions for the matching brushed-nickel faucet", () => {
    expect(verifiedPelicanFaucetProfile("PL-8203 BN")).toMatchObject({
      installation: "single-hole",
      overallHeightIn: 27.1875,
      spoutLengthIn: 9.875,
      spoutHeightIn: 4.9375,
      profile: "pull-down",
    });
  });

  it("maps both imported PL-8207 finish codes to their shared measured profile geometry", () => {
    expect(verifiedPelicanFaucetProfile("PL-8207 BN")).toMatchObject({
      overallHeightIn: 26.125,
      spoutLengthIn: 7.6875,
      spoutHeightIn: 6.5,
      finish: "brushed-nickel",
    });
    expect(verifiedPelicanFaucetProfile("PL-8207 MB")).toMatchObject({
      overallHeightIn: 26.125,
      spoutLengthIn: 7.6875,
      spoutHeightIn: 6.5,
      finish: "matte-black",
    });
  });

  it("maps every active PL-8237 finish code to Pelican’s same verified standard-arc measurements", () => {
    for (const [code, finish] of [["PL-8237 BG", "brushed-gold"], ["PL-8237 BN", "brushed-nickel"], ["PL-8237 CHR", "chrome"], ["PL-8237 MB", "matte-black"]] as const) {
      expect(verifiedPelicanFaucetProfile(code)).toMatchObject({
        overallHeightIn: 12.8125,
        spoutLengthIn: 7.0625,
        spoutHeightIn: 8.375,
        finish,
        profile: "standard-arc",
      });
    }
  });

  it("maps every active PL-8248 finish code to Pelican’s verified pull-out faucet form", () => {
    for (const [code, finish] of [["PL-8248 BN", "brushed-nickel"], ["PL-8248 CHR", "chrome"], ["PL-8248 MB", "matte-black"]] as const) {
      expect(verifiedPelicanFaucetProfile(code)).toMatchObject({
        overallHeightIn: 12.375,
        spoutLengthIn: 10.0625,
        spoutHeightIn: 10.875,
        profile: "pull-out",
        finish,
      });
    }
  });

  it("maps PL-8222 Brushed Nickel to Pelican’s measured compact pull-out faucet profile", () => {
    expect(verifiedPelicanFaucetProfile("PL-8222 BN")).toMatchObject({
      overallHeightIn: 9.5625,
      spoutLengthIn: 8.375,
      spoutHeightIn: 5.8125,
      profile: "pull-out",
      finish: "brushed-nickel",
    });
  });

  it("maps every active PL-8206 finish to Pelican’s articulated dual-swing-joint faucet profile", () => {
    for (const [code, finish] of [["PL-8206 BN", "brushed-nickel"], ["PL-8206 CHR", "chrome"], ["PL-8206 MB", "matte-black"]] as const) {
      expect(verifiedPelicanFaucetProfile(code)).toMatchObject({
        overallHeightIn: 10.5,
        spoutLengthIn: 9.75,
        spoutHeightIn: 9.25,
        profile: "articulated-swing",
        finish,
      });
    }
  });

  it("maps active PL-8224 finishes to Pelican’s measured tall pull-out faucet profile", () => {
    expect(verifiedPelicanFaucetProfile("PL-8224 BN")).toMatchObject({ overallHeightIn: 19.3125, spoutLengthIn: 7.9375, spoutHeightIn: 10.25, profile: "pull-out", finish: "brushed-nickel" });
    expect(verifiedPelicanFaucetProfile("PL-8224 ORB")).toMatchObject({ overallHeightIn: 19.3125, spoutLengthIn: 7.9375, spoutHeightIn: 10.25, profile: "pull-out", finish: "oil-rubbed-bronze" });
  });

  it("maps both active PL-8210 finishes to Pelican’s measured commercial pull-down profile", () => {
    expect(verifiedPelicanFaucetProfile("PL-8210 BN")).toMatchObject({ overallHeightIn: 22.5, spoutLengthIn: 9.75, spoutHeightIn: 7.75, profile: "pull-down", finish: "brushed-nickel" });
    expect(verifiedPelicanFaucetProfile("PL-8210 MB")).toMatchObject({ overallHeightIn: 22.5, spoutLengthIn: 9.75, spoutHeightIn: 7.75, profile: "pull-down", finish: "matte-black" });
  });

  it("maps every active PL-8211 finish to Pelican’s measured pull-down profile", () => {
    for (const [code, finish] of [["PL-8211 BG", "brushed-gold"], ["PL-8211 BN", "brushed-nickel"], ["PL-8211 CHR", "chrome"]] as const) {
      expect(verifiedPelicanFaucetProfile(code)).toMatchObject({ overallHeightIn: 15.6875, spoutLengthIn: 9.4375, spoutHeightIn: 6.625, profile: "pull-down", finish });
    }
  });

  it("maps PL-8213 brushed nickel to Pelican’s active measured pull-down profile and excludes unsupported chrome", () => {
    expect(verifiedPelicanFaucetProfile("PL-8213 BN")).toMatchObject({ overallHeightIn: 15.75, spoutLengthIn: 9.375, spoutHeightIn: 6.5, profile: "pull-down", finish: "brushed-nickel" });
    expect(verifiedPelicanFaucetProfile("PL-8213 CHR")).toBeNull();
  });

  it("maps every active-source PL-8217 finish and excludes unsupported chrome", () => {
    for (const [code, finish] of [["PL-8217 BN", "brushed-nickel"], ["PL-8217 ORB", "oil-rubbed-bronze"]] as const) {
      expect(verifiedPelicanFaucetProfile(code)).toMatchObject({ overallHeightIn: 16.8125, spoutLengthIn: 9.375, spoutHeightIn: 7.5625, profile: "pull-down", finish });
    }
    expect(verifiedPelicanFaucetProfile("PL-8217 CHR")).toBeNull();
  });

  it("maps every active-source PL-8218 finish and excludes unsupported chrome", () => {
    for (const [code, finish] of [["PL-8218 BN", "brushed-nickel"], ["PL-8218 MB", "matte-black"]] as const) {
      expect(verifiedPelicanFaucetProfile(code)).toMatchObject({ overallHeightIn: 17.6875, spoutLengthIn: 9.375, spoutHeightIn: 8.375, profile: "pull-down", finish });
    }
    expect(verifiedPelicanFaucetProfile("PL-8218 CHR")).toBeNull();
  });

  it("maps every active PL-8231 finish to Pelican’s measured Fountain pull-out profile", () => {
    for (const [code, finish] of [["PL-8231 BG", "brushed-gold"], ["PL-8231 BN", "brushed-nickel"], ["PL-8231 CHR", "chrome"], ["PL-8231 MB", "matte-black"]] as const) {
      expect(verifiedPelicanFaucetProfile(code)).toMatchObject({ overallHeightIn: 15.75, spoutLengthIn: 9.375, spoutHeightIn: 6.5, profile: "pull-out", finish });
    }
  });

  it("maps every active PL-8257 finish to Pelican’s measured pull-down faucet profile", () => {
    for (const [code, finish] of [["PL-8257 BN", "brushed-nickel"], ["PL-8257 CHR", "chrome"], ["PL-8257 MB", "matte-black"]] as const) {
      expect(verifiedPelicanFaucetProfile(code)).toMatchObject({
        installation: "single-hole",
        overallHeightIn: 17.75,
        spoutLengthIn: 8.25,
        spoutHeightIn: 9.5,
        profile: "pull-down",
        finish,
      });
    }
  });

  it("maps PL-8369 only as a source-measured wall pot filler, retaining exact reach, finish, and its required project mounting datum", () => {
    for (const [code, finish] of [["PL-8369 BG", "brushed-gold"], ["PL-8369 BN", "brushed-nickel"], ["PL-8369 CHR", "chrome"], ["PL-8369 MB", "matte-black"]] as const) {
      expect(verifiedPelicanPotFillerProfile(code)).toMatchObject({
        installation: "wall-mounted-in-wall-cold-water",
        profile: "dual-jointed-folding-swing-arm",
        finish,
        spoutReachIn: 24,
        overallSpanIn: 26.1875,
        armDatumIn: 13,
        fixtureHeightIn: 3.15625,
        outletDatumIn: 1.875,
        maximumFlowGpmAt60Psi: 2.2,
        requiresProjectSpecificMountHeight: true,
      });
    }
    // The source's base code is a historical bad import; no finish means no
    // purchasable or renderable variant identity.
    expect(verifiedPelicanPotFillerProfile("PL-8369")).toBeNull();
  });

  it("keeps Pelican's dimensioned PL-8410 and PL-8461 wall-mounted kitchen faucets distinct from sink-mounted profiles", () => {
    expect(verifiedPelicanFaucetProfile("PL-8410 BN")).toMatchObject({
      installation: "wall-mounted-8-inch-center",
      overallHeightIn: 10.5,
      spoutLengthIn: 9.75,
      spoutHeightIn: 7.5,
      centerSpreadIn: 8,
      profile: "wall-mounted-bridge",
      requiresProjectSpecificMountHeight: true,
    });
    expect(verifiedPelicanFaucetProfile("PL-8461 MB")).toMatchObject({
      installation: "wall-mounted-8-inch-center",
      overallHeightIn: 4.375,
      spoutLengthIn: 8.75,
      spoutHeightIn: 3.125,
      centerSpreadIn: 8,
      profile: "wall-mounted-bridge",
      requiresProjectSpecificMountHeight: true,
    });
  });

  it("treats only registered source-verified sink and faucet codes as exact fixture profiles", () => {
    expect(hasVerifiedPelicanFixtureProfile("PL-FC3018SB")).toBe(false);
    expect(hasVerifiedPelicanFixtureProfile("PL-8248 MB")).toBe(true);
    expect(hasVerifiedPelicanFixtureProfile("PL-UNMEASURED")).toBe(false);
    expect(hasVerifiedPelicanFixtureProfile(null)).toBe(false);
  });

  it("does not treat unverified or source-incomplete codes as measured Designer profiles", () => {
    expect(verifiedPelicanSinkProfile("PL-FC2418SB")).toBeNull();
    expect(verifiedPelicanSinkProfile("PL-FC3018SB")).toBeNull();
    expect(verifiedPelicanSinkProfile("PL-FC3318SB")).toBeNull();
    expect(verifiedPelicanSinkProfile("PL-FC3318DB")).toBeNull();
    expect(verifiedPelicanSinkProfile("PL-FC3219SB")).toBeNull();
    expect(verifiedPelicanSinkProfile("PL-FC3620SB")).toBeNull();
    expect(verifiedPelicanSinkProfile("PL-UNKNOWN")).toBeNull();
    expect(verifiedPelicanFaucetProfile("PL-8213 CHR")).toBeNull();
    expect(verifiedPelicanFaucetProfile("PL-8217 CHR")).toBeNull();
    expect(verifiedPelicanFaucetProfile("PL-8218 CHR")).toBeNull();
  });

  it("uses the nominal sink-base face width rather than a rotated plan footprint", () => {
    const farmhouse = verifiedPelicanSinkProfile("PL-HA128 R15 16g")!;
    const rotatedFsb36 = { width: 36, depth: 24, rotation: 90 };
    expect(sinkBaseOpeningWidthIn(rotatedFsb36)).toBe(36);
    expect(verifiedPelicanSinkFitsCabinet(farmhouse, sinkBaseOpeningWidthIn(rotatedFsb36))).toBe(true);
  });

  it("keeps farmhouse and standard sink choices in their matching sink bases", () => {
    const farmhouse = { pelicanCode: "PL-FC3318SB", name: "PL-FC3318SB", description: "Fireclay farmhouse apron-front sink" };
    const standard = { pelicanCode: "PL-SS3018", name: "PL-SS3018", description: "Stainless steel undermount kitchen sink" };
    expect(pelicanSinkBaseKind(farmhouse)).toBe("farmhouse");
    expect(pelicanSinkBaseKind(standard)).toBe("standard");
    expect(isPelicanSinkCompatibleWithBase(farmhouse, "farmhouse")).toBe(true);
    expect(isPelicanSinkCompatibleWithBase(farmhouse, "standard")).toBe(false);
    expect(isPelicanSinkCompatibleWithBase(standard, "standard")).toBe(true);
  });
});
