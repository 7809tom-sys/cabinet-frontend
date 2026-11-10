import { describe, expect, it } from "vitest";
import {
  showerBaseCodeForCatalogRow,
  verifiedPelicanBathroomFixtureProfile,
} from "./pelicanBathroomFixtureProfiles";
import { sizeTokenFromDoorSku } from "@/components/design/SurfacesPickerDialog";

/**
 * Every Pelican door keeps its place in the offer — Tom's rule is "keep all
 * doors" — and each one must draw at its REAL width and height. The catalog says
 * the size in three different places depending on the row, so these tests pin the
 * mapping and the fallbacks that read it.
 *
 * The live Shower & Bath catalog carries nine door models in three finishes:
 *
 *   PL-03A11S48   46-48" single sliding shower     (frameless)
 *   PL-03A11S60   58-60" single sliding shower     (frameless)
 *   PL-03A11TSO   60" x 59" single sliding TUB      (frameless)
 *   PL-03A42S60   58-60" double sliding shower     (frameless)
 *   PL-03A42T60   58-60" double sliding TUB         (frameless)
 *   PL-03B71SSO   60" x 76" framed single shower
 *   PL-03B71TSO   60" x 59" framed single TUB
 *   PL-03D42SSO   60" x 76" framed double shower
 *   PL-03D42TSO   60" x 59" framed double TUB
 */
const FINISHES = ["BN", "CHR", "MB"] as const;

type Expected = { model: string; kind: "shower-door" | "tub-door"; widthIn: number; heightIn: number };

const EXPECTED: Expected[] = [
  { model: "PL-03A11S48", kind: "shower-door", widthIn: 48, heightIn: 76 },
  { model: "PL-03A11S60", kind: "shower-door", widthIn: 60, heightIn: 76 },
  { model: "PL-03A11TSO", kind: "tub-door", widthIn: 60, heightIn: 59 + 1 / 6 },
  { model: "PL-03A42S60", kind: "shower-door", widthIn: 60, heightIn: 76 },
  { model: "PL-03A42T60", kind: "tub-door", widthIn: 60, heightIn: 59 + 1 / 6 },
  { model: "PL-03B71SSO", kind: "shower-door", widthIn: 60, heightIn: 76 },
  { model: "PL-03B71TSO", kind: "tub-door", widthIn: 60, heightIn: 59 + 1 / 6 },
  { model: "PL-03D42SSO", kind: "shower-door", widthIn: 60, heightIn: 76 },
  { model: "PL-03D42TSO", kind: "tub-door", widthIn: 60, heightIn: 59 + 1 / 6 },
];

describe("every door resolves to its real width and height", () => {
  it("covers all nine models the catalog sells", () => {
    expect(EXPECTED).toHaveLength(9);
    // Nine models x three finishes is the whole door offer, and none is dropped.
    expect(EXPECTED.length * FINISHES.length).toBe(27);
  });

  for (const { model, kind, widthIn, heightIn } of EXPECTED) {
    it(`${model} is a ${widthIn}" ${kind} at ${heightIn}" tall`, () => {
      for (const finish of FINISHES) {
        const sku = `${model} ${finish}`;
        const base = showerBaseCodeForCatalogRow(sku);
        expect(base, sku).not.toBeNull();
        const profile = verifiedPelicanBathroomFixtureProfile(base)!;
        expect(profile, sku).not.toBeNull();
        expect(profile.kind, sku).toBe(kind);
        expect(profile.widthIn, sku).toBeCloseTo(widthIn, 2);
        expect(profile.heightIn, sku).toBeCloseTo(heightIn, 2);
      }
    });
  }
});

describe("the size bugs this fixes", () => {
  it("gives the 48 inch door its own width, not the 60 inch stand-in", () => {
    const base = showerBaseCodeForCatalogRow("PL-03A11S48 BN")!;
    // It used to resolve to PL-03A42S — the 60" double slider.
    expect(base).not.toBe("PL-03A42S");
    expect(base).toBe("PL-03A11S48");
    expect(verifiedPelicanBathroomFixtureProfile(base)!.widthIn).toBeCloseTo(48, 2);
  });

  it("maps framed TUB doors to the tub envelope, not the 76 inch shower one", () => {
    for (const sku of ["PL-03B71TSO BN", "PL-03D42TSO CHR", "PL-03D42TSO MB"]) {
      const profile = verifiedPelicanBathroomFixtureProfile(showerBaseCodeForCatalogRow(sku)!)!;
      expect(profile.kind, sku).toBe("tub-door");
      // A tub door sits on a tub, so it is roughly a foot shorter than a shower door.
      expect(profile.heightIn, sku).toBeLessThan(70);
    }
  });

  it("keeps the framed shower doors at the 76 inch shower height", () => {
    for (const sku of ["PL-03B71SSO BN", "PL-03D42SSO MB"]) {
      const profile = verifiedPelicanBathroomFixtureProfile(showerBaseCodeForCatalogRow(sku)!)!;
      expect(profile.kind, sku).toBe("shower-door");
      expect(profile.heightIn, sku).toBeCloseTo(76, 2);
    }
  });

  it("distinguishes a framed tub door from its framed shower sibling", () => {
    const tub = showerBaseCodeForCatalogRow("PL-03B71TSO BN");
    const shower = showerBaseCodeForCatalogRow("PL-03B71SSO BN");
    expect(tub).not.toBe(shower);
    expect(verifiedPelicanBathroomFixtureProfile(tub!)!.heightIn)
      .toBeLessThan(verifiedPelicanBathroomFixtureProfile(shower!)!.heightIn);
  });
});

describe("the width fallback reads the SKU when the row states no size", () => {
  it("pulls the opening out of the SKU's own token", () => {
    expect(sizeTokenFromDoorSku("PL-03A11S48 BN")).toBe(48);
    expect(sizeTokenFromDoorSku("PL-03A11S60 MB")).toBe(60);
    expect(sizeTokenFromDoorSku("PL-03A42S60 CHR")).toBe(60);
    expect(sizeTokenFromDoorSku("PL-03A42T60 BN")).toBe(60);
    // Nothing to read is not an error — the caller falls back to the description.
    expect(sizeTokenFromDoorSku("WEP1530")).toBeNull();
    expect(sizeTokenFromDoorSku(null)).toBeNull();
  });
});
