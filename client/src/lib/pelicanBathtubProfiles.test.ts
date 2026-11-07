import { describe, expect, it } from "vitest";
import {
  VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES,
  verifiedPelicanBathroomFixtureProfile,
} from "./pelicanBathroomFixtureProfiles";

const FREESTANDING = ['PL-02138 59"', 'PL-02138 67"', 'PL-02141 59"', 'PL-02141 67"', 'PL-02146 59"', 'PL-02146 67"',
  'PL-02562 59"', 'PL-02562 67"', 'PL-02563 59"', 'PL-02563 67"'];
const ALCOVE = ["PL-02849L", "PL-02849R", "PL-02850L", "PL-02850R", "PL-02851L", "PL-02851R"];
/** The purchasable catalog sells the alcove tubs with an NSO (nested pallet) suffix. */
const ALCOVE_NSO = ALCOVE.map((code) => `${code}NSO`);

describe("Pelican bathtub profiles", () => {
  it("resolves every purchasable tub SKU, including the NSO catalog variant", () => {
    for (const code of [...FREESTANDING, ...ALCOVE, ...ALCOVE_NSO]) {
      expect(verifiedPelicanBathroomFixtureProfile(code), code).not.toBeNull();
    }
  });

  it("maps an NSO tub to the same measured envelope as its plain SKU", () => {
    for (const plain of ALCOVE) {
      const base = verifiedPelicanBathroomFixtureProfile(plain)!;
      const nso = verifiedPelicanBathroomFixtureProfile(`${plain}NSO`)!;
      expect(nso.widthIn, plain).toBe(base.widthIn);
      expect(nso.depthIn, plain).toBe(base.depthIn);
      expect(nso.heightIn, plain).toBe(base.heightIn);
      expect(nso.drain, plain).toBe(base.drain);
      expect(nso.kind, plain).toBe("alcove-tub");
      // The purchasable identity is kept, so the quote and 3D agree on the SKU.
      expect(nso.pelicanCode, plain).toBe(`${plain}NSO`);
    }
  });

  it("covers every tub sheet the catalog sells, plus the NSO SKU aliases", () => {
    const tubs = VERIFIED_PELICAN_BATHROOM_FIXTURE_PROFILES.filter(
      (profile) => profile.kind === "freestanding-tub" || profile.kind === "alcove-tub",
    );
    // 10 freestanding (59" and 67" of five models) and 6 alcove sheets.
    expect(tubs).toHaveLength(16);
    expect(FREESTANDING).toHaveLength(10);
    expect(ALCOVE).toHaveLength(6);
    // The catalog sells 22 purchasable tub rows: those 16 plus six NSO aliases.
    expect(new Set([...FREESTANDING, ...ALCOVE_NSO]).size).toBe(16);
    expect(ALCOVE.length + ALCOVE_NSO.length).toBe(12);
  });
});
