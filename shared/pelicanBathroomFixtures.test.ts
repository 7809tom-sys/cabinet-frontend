import { describe, expect, it } from "vitest";
import {
  PELICAN_DOUBLE_BOWL_MIN_VANITY_WIDTH_IN,
  PELICAN_VANITY_FAUCETS,
  PELICAN_VANITY_FAUCET_SKUS,
  PELICAN_VANITY_SINKS,
  PELICAN_VANITY_SINK_SKUS,
  isPelicanVanityFaucetSku,
  isPelicanVanitySinkSku,
  pelicanVanityFaucetProfile,
  pelicanVanityFaucetTags,
  pelicanVanitySinkProfile,
  pelicanVanitySinkTags,
  vanityFaucetFitsSink,
  vanityFaucetSinkMatch,
} from "./pelicanBathroomFixtures";

describe("Pelican vanity fixture catalog", () => {
  it("lists vanity basins and integrated vanity tops as single-bowl, because Pelican publishes no double-bowl bathroom basin", () => {
    expect(PELICAN_VANITY_SINKS.length).toBeGreaterThan(0);
    expect(PELICAN_VANITY_SINKS.every((sink) => sink.bowlCount === 1)).toBe(true);
    expect(PELICAN_VANITY_SINKS.some((sink) => sink.kind === "vanity-top")).toBe(true);
    expect(PELICAN_VANITY_SINKS.some((sink) => sink.kind === "vanity-basin")).toBe(true);
  });

  it("covers every source mount type the bathroom designer must offer", () => {
    const mounts = new Set(PELICAN_VANITY_SINKS.map((sink) => sink.mount));
    expect(mounts).toEqual(new Set(["undermount", "drop-in", "vessel", "integrated"]));
  });

  it("gives every sink and faucet a specification sheet and positive source dimensions", () => {
    for (const sink of PELICAN_VANITY_SINKS) {
      expect(sink.specificationUrl).toMatch(/^https:\/\//);
      expect(sink.widthIn).toBeGreaterThan(0);
      expect(sink.depthIn).toBeGreaterThan(0);
      expect(sink.heightIn).toBeGreaterThan(0);
    }
    for (const faucet of PELICAN_VANITY_FAUCETS) {
      expect(faucet.specificationUrl).toMatch(/^https:\/\//);
      expect(faucet.overallHeightIn).toBeGreaterThan(0);
      expect(faucet.spoutLengthIn).toBeGreaterThan(0);
    }
  });

  it("offers all three vanity faucet mounting forms, each with a source-stated hole count", () => {
    const mounts = new Set(PELICAN_VANITY_FAUCETS.map((faucet) => faucet.mount));
    expect(mounts).toEqual(new Set(["single-hole", "centerset-4", "widespread-8"]));
    for (const faucet of PELICAN_VANITY_FAUCETS) {
      expect(faucet.faucetHoles).toBe(faucet.mount === "single-hole" ? 1 : 3);
      if (faucet.mount !== "single-hole") expect(faucet.faucetSpreadIn).toBe(faucet.mount === "centerset-4" ? 4 : 8);
    }
  });

  it("keeps Pelican floor-mounted tub fillers out of the vanity faucet list", () => {
    for (const code of ["PL-8515 BN", "PL-8522 CHR", "PL-8538 MB"]) {
      expect(isPelicanVanityFaucetSku(code)).toBe(false);
    }
  });

  it("keeps every kitchen sink and kitchen faucet out of the vanity lists", () => {
    for (const code of ["PL-HA109 R0 16g", "PL-VS5050 18g", "PL-100 Alpina", "PL-FC3318DB White"]) {
      expect(isPelicanVanitySinkSku(code)).toBe(false);
    }
    for (const code of ["PL-8207 BN", "PL-8237 CHR", "PL-8369 BG", "PL-8410 BN", "PL-8480 BN"]) {
      expect(isPelicanVanityFaucetSku(code)).toBe(false);
    }
  });

  it("resolves every sellable SKU to exactly one record", () => {
    for (const code of PELICAN_VANITY_SINK_SKUS) {
      expect(pelicanVanitySinkProfile(code), code).not.toBeNull();
    }
    for (const code of PELICAN_VANITY_FAUCET_SKUS) {
      expect(pelicanVanityFaucetProfile(code), code).not.toBeNull();
    }
  });

  it("never guesses from a model number alone or from an unknown variant suffix", () => {
    expect(pelicanVanitySinkProfile("PL-3099")).toBeNull();
    expect(pelicanVanitySinkProfile("PL-3099 Copper")).toBeNull();
    expect(pelicanVanityFaucetProfile("PL-8107")).toBeNull();
    expect(pelicanVanityFaucetProfile("PL-8107 ORB")).toBeNull();
    expect(pelicanVanitySinkProfile(null)).toBeNull();
  });

  it("tells PL-1011's two pre-drilled spreads apart", () => {
    expect(pelicanVanitySinkProfile('PL-1011 Spread 4"')?.faucetSpreadIn).toBe(4);
    expect(pelicanVanitySinkProfile('PL-1011 Spread 8"')?.faucetSpreadIn).toBe(8);
  });

  it("tags a vanity sink with its mount and bowl count, never the kitchen tags", () => {
    const undermount = pelicanVanitySinkProfile("PL-3099 White");
    expect(undermount).not.toBeNull();
    expect(pelicanVanitySinkTags(undermount!)).toEqual([
      "bathroom-vanity-sink",
      "mount-undermount",
      "bowl-single",
    ]);

    const top = pelicanVanitySinkProfile("PL-R4922W");
    expect(pelicanVanitySinkTags(top!)).toEqual([
      "bathroom-vanity-sink",
      "mount-integrated",
      "bowl-single",
      "faucet-holes-3",
    ]);
  });

  it("tags a vanity faucet as a vanity faucet with its hole count and spread", () => {
    const centerset = pelicanVanityFaucetProfile("PL-8330 BN");
    expect(pelicanVanityFaucetTags(centerset!)).toEqual([
      "bathroom-vanity-faucet",
      "faucet-holes-3",
      "faucet-spread-4",
    ]);

    const vessel = pelicanVanityFaucetProfile("PL-8112 BN");
    expect(pelicanVanityFaucetTags(vessel!)).toEqual([
      "bathroom-vanity-faucet",
      "faucet-holes-1",
      "faucet-for-vessel-sink",
    ]);
  });

  it("matches a faucet to a basin's pre-drilled hole count, and to the spread only when the sink's sheet states one", () => {
    // The Cove tops state "3 Pre-Drilled Faucet Holes" but publish no spacing, so
    // both three-hole forms stay offerable and the spread is reported unverified.
    const threeHole = pelicanVanitySinkProfile("PL-R4922W")!;
    const widespread = pelicanVanityFaucetProfile("PL-8312 BN")!;
    const centerset = pelicanVanityFaucetProfile("PL-8330 BN")!;
    const singleHole = pelicanVanityFaucetProfile("PL-8107 BN")!;

    expect(vanityFaucetSinkMatch(widespread, threeHole)).toEqual({ fits: true, spreadVerified: false });
    expect(vanityFaucetSinkMatch(centerset, threeHole)).toEqual({ fits: true, spreadVerified: false });
    expect(vanityFaucetFitsSink(singleHole, threeHole)).toBe(false);

    // PL-1011's sheet does state the spacing, so the spread is enforced there.
    const spreadStated = pelicanVanitySinkProfile('PL-1011 Spread 4"')!;
    expect(vanityFaucetSinkMatch(centerset, spreadStated)).toEqual({ fits: true, spreadVerified: true });
    expect(vanityFaucetFitsSink(widespread, spreadStated)).toBe(false);

    // An underset basin is drilled in the countertop, not in the china.
    const underset = pelicanVanitySinkProfile("PL-3099 White")!;
    expect(vanityFaucetFitsSink(widespread, underset)).toBe(true);
    expect(vanityFaucetFitsSink(singleHole, underset)).toBe(true);
    expect(vanityFaucetFitsSink(widespread, null)).toBe(true);
  });

  it("keeps the double-bowl width rule available even though no double-bowl vanity sink exists today", () => {
    expect(PELICAN_DOUBLE_BOWL_MIN_VANITY_WIDTH_IN).toBe(48);
    expect(PELICAN_VANITY_SINKS.some((sink) => sink.bowlCount === 2)).toBe(false);
  });
});

describe("kitchen and bathroom never share a fixture", () => {
  it("gives every vanity SKU a bathroom record and no kitchen record", async () => {
    const { verifiedPelicanSinkProfile, verifiedPelicanFaucetProfile } = await import("../client/src/lib/pelicanFixtureProfiles");
    for (const code of PELICAN_VANITY_SINK_SKUS) {
      const profile = verifiedPelicanSinkProfile(code);
      expect(profile, code).not.toBeNull();
      expect(profile!.vanityMount, code).toBeDefined();
      expect(profile!.apronFront, code).toBe(false);
    }
    for (const code of PELICAN_VANITY_FAUCET_SKUS) {
      const profile = verifiedPelicanFaucetProfile(code);
      expect(profile, code).not.toBeNull();
      expect(profile!.vanity, code).toBe(true);
    }
  });

  it("keeps every kitchen sink and kitchen faucet out of the vanity profile path", async () => {
    const { verifiedPelicanSinkProfile, verifiedPelicanFaucetProfile } = await import("../client/src/lib/pelicanFixtureProfiles");
    for (const code of ["PL-HA109 R0 16g", "PL-VS5050 18g", "PL-VS3218 18g", "PL-HA130 R0 16g"]) {
      const profile = verifiedPelicanSinkProfile(code);
      if (profile) expect(profile.vanityMount, code).toBeUndefined();
    }
    for (const code of ["PL-8237 BN", "PL-8207 BN", "PL-8369 BG", "PL-8410 BN"]) {
      const profile = verifiedPelicanFaucetProfile(code);
      if (profile) expect(profile.vanity, code).toBeUndefined();
    }
  });

  it("keeps a saved design's basin and faucet profile ids resolving", async () => {
    const { verifiedPelicanSinkProfile, verifiedPelicanFaucetProfile, isVanitySinkProfileId, isVanityFaucetProfileId } = await import("../client/src/lib/pelicanFixtureProfiles");
    expect(verifiedPelicanSinkProfile("PL-3099 White")?.id).toBe("pelican-pl-3099-pearl-porcelain-undermount-vanity");
    expect(verifiedPelicanSinkProfile("PL-3608")?.id).toBe("pelican-pl-3608-pearl-porcelain-undermount-vanity");
    expect(verifiedPelicanFaucetProfile("PL-8112 BN")?.id).toBe("pelican-pl-8112-cascade-vanity-brushed-nickel");
    expect(isVanitySinkProfileId("pelican-pl-3099-pearl-porcelain-undermount-vanity")).toBe(true);
    expect(isVanityFaucetProfileId("pelican-pl-8112-cascade-vanity-brushed-nickel")).toBe(true);
    // A kitchen profile id must never be mistaken for a vanity one.
    expect(isVanitySinkProfileId("pelican-pl-vs3018-stainless-undermount")).toBe(false);
    expect(isVanityFaucetProfileId("pelican-pl-8237-fountain-standard-arc-brushed-nickel")).toBe(false);
  });
});
