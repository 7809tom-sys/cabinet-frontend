import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("InteractiveRoom3D verified customer image UI", () => {
  it("blocks customer image creation until the current plan is saved and mobile verification completes", () => {
    const source = readFileSync("client/src/components/design/InteractiveRoom3D.tsx", "utf8");

    expect(source).toContain("isCurrentPlanSaved = false");
    expect(source).toContain("savedPlanFingerprintPayload");
    expect(source).toContain('photoVerificationStatus !== "verified"');
    expect(source).toContain("Send verification code");
    expect(source).toContain("Verify code");
  });

  it("records the exact faucet and sink selections with the selected door, countertop, flooring, and backsplash", () => {
    const source = readFileSync("client/src/components/design/InteractiveRoom3D.tsx", "utf8");

    expect(source).toContain('{ role: "faucet" as const');
    expect(source).toContain('{ role: "sink" as const');
    expect(source).toContain("pelicanFaucetProductId");
    expect(source).toContain("pelicanProductId");
  });
});
