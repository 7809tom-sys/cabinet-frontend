import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const selection = readFileSync(new URL("../lib/sinkBaseSelection.ts", import.meta.url), "utf8");

describe("sink base dialog keeps the chosen faucet", () => {
  const start = source.indexOf("const applySink = (");
  const end = source.indexOf("setSinkBaseDialog(null);", start);
  const applySink = source.slice(start, end);

  it("builds one fixture that carries both the sink and the faucet", () => {
    expect(start).toBeGreaterThan(0);
    // Placement has one implementation, so the chosen faucet's identity and
    // measured profile are written there and the dialog cannot drop them.
    expect(applySink).toContain("placeSinkOnBase({ base: cab, room, roomType, product: sinkProduct, faucet: faucetProduct })");
    expect(applySink).toContain("sinkWithFaucet,");
    expect(selection).toContain("pelicanFaucetProfileId: faucetProfile.id");
    expect(selection).toContain("pelicanFaucetProductId: faucet.id");
  });

  it("only records the products as selected instead of re-placing them from the old sink list", () => {
    // addRecommendedSurface re-runs sink placement from the pre-update sink list,
    // which replaced the faucet-carrying fixture with a faucet-less one.
    expect(applySink).not.toContain("addRecommendedSurface(");
    expect(applySink).toContain("setSelectedSurfaces((prevSurfaces) => [");
  });
});
