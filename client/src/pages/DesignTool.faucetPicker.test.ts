import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const selection = readFileSync(new URL("../lib/sinkBaseSelection.ts", import.meta.url), "utf8");

describe("Designer visual faucet selection", () => {
  it("requests the complete bounded measured-faucet palette instead of six suggestions", () => {
    // The faucet list also carries the storefront scope, or an affiliate
    // Designer shows the platform price for its own vanity faucets. The role
    // comes from the selected BASE, so an apron-front base in a bathroom asks
    // for kitchen faucets rather than vanity faucets.
    expect(source).toContain("{ role: faucetCatalogRoleForBase(sinkDialogBase, roomType), limit: 200, affiliateSlug: affiliateSlug ?? undefined }");
  });

  it("delegates every verified kitchen or vanity faucet to the reusable visual picker without a local six-card slice", () => {
    expect(source).toContain("<PelicanFaucetPicker");
    expect(source).toContain("faucets={filteredFaucets}");
    expect(source).not.toContain("filteredFaucets.slice(0, 6)");
  });

  it("keeps the chosen exact faucet identity and measured profile in the attached sink fixture and selected surfaces", () => {
    // Sink placement has ONE implementation, so the identity is written in one
    // place and cannot drift between the dialog and the seeded default.
    expect(source).toContain("placeSinkOnBase({ base: cab, room, roomType, product: sinkProduct, faucet: faucetProduct })");
    expect(selection).toContain("pelicanFaucetProductId: faucet.id");
    expect(selection).toContain("pelicanFaucetProductName: faucet.name");
    expect(selection).toContain("pelicanFaucetProductImage: faucet.imageUrl ?? undefined");
    expect(selection).toContain("pelicanFaucetProfileId: faucetProfile.id");
    expect(selection).toContain("faucetOverallHeight: faucetProfile.overallHeightIn");
  });

  it("routes a source-measured wall-mounted faucet through its own documented mounting-height confirmation rather than treating it as a countertop single-hole faucet", () => {
    expect(source).toContain('verifiedFaucetProfile?.installation === "wall-mounted-8-inch-center"');
    expect(source).toContain("faucetWallMountHeightAboveCountertopIn");
    expect(source).toContain("requiresProjectSpecificMountHeight");
    expect(source).toContain("Enter the documented wall-mount datum above the finished countertop");
  });

  it("never blocks a catalog-valid sink because the rear deck is tight, and never redesigns the layout for it", () => {
    // Tom's rule: faucets are universal across one- and two-hole deck mounts, so
    // the rear deck is informational. Assert the blocking call is gone.
    expect(source).not.toContain("!deckPlacement.faucetCanFit");
    expect(source).not.toContain("does not leave the required rear countertop deck for a faucet");
    expect(source).not.toContain("nonApronSinkDeckPlacement(cab, room, verifiedDimensions)");
    // The sink still places, and the fixture still carries the advisory.
    expect(selection).toContain("makeSinkForCabinet(");
    expect(source).not.toContain("faucetDeckConflict: \"shallow-countertop-deck\"");
  });
});
