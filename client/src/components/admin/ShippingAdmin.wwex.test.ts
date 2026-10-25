import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/ShippingAdmin.tsx"),
  "utf8",
);

describe("ShippingAdmin WWEX verification controls", () => {
  it("provides a dedicated save action for the Client ID and Client Secret with clear safe-save feedback", () => {
    expect(source).toContain("saveWwexCredentials");
    expect(source).toContain("Save Client ID + Secret");
    expect(source).toContain("WWEX Client ID and Client Secret saved securely. The secret box clears by design.");
    expect(source).toContain("After saving, the secret field clears by design");
  });

  it("places the paired save action directly with the two credential inputs and supports Enter from the secret field", () => {
    const wwexSection = source.slice(source.indexOf("Worldwide Express (WWEX) — OAuth2 Credentials"));
    const credentialSection = wwexSection.slice(wwexSection.indexOf("<Label className=\"text-xs\">Client ID</Label>"), wwexSection.indexOf("<Label className=\"text-xs\">Account Number</Label>"));
    expect(credentialSection).toContain("Save Client ID + Secret");
    expect(credentialSection).toContain("handleSaveWwexCredentials();");
  });

  it("keeps a newly saved WWEX credential pair out of stale query hydration and generic settings saves", () => {
    expect(source).toContain("const [formInitialized, setFormInitialized] = useState(false);");
    expect(source).toContain("if (!data || formInitialized) return;");
    expect(source).toContain("an earlier cached response can never put an old Client ID back");
    expect(source).not.toContain("wwexClientId: form.wwexClientId || undefined");
    expect(source).not.toContain("wwexClientSecret: form.wwexClientSecret || undefined");
  });

  it("makes the persisted write-only status visible beside the credential save control", () => {
    expect(source).toContain("Securely saved:");
    expect(source).toContain("the WWEX Client ID and Client Secret are on file");
    expect(source).toContain("a blank secret box does");
    expect(source).toContain("<strong>not</strong> mean the secret was removed");
    expect(source).toContain("The main Shipping save button does not save this protected pair.");
  });

  it("stores separate verified token and rate URLs for sandbox and production", () => {
    expect(source).toContain("wwexSandboxTokenUrl");
    expect(source).toContain("wwexSandboxRateUrl");
    expect(source).toContain("wwexProductionTokenUrl");
    expect(source).toContain("wwexProductionRateUrl");
    expect(source).toContain("environment-specific token and rate URLs");
  });

  it("never claims a guessed endpoint and explains the HTTPS safety rule", () => {
    expect(source).toContain("will not send credentials to guessed or non-HTTPS hosts");
    expect(source).not.toContain("https://api-sandbox.wwex.com");
    expect(source).not.toContain("https://api.wwex.com");
  });

  it("distinguishes WWEX parcel services from the verified LTL shopFlow setup", () => {
    expect(source).toContain("SpeedShip supports WWEX/UPS parcel services");
    expect(source).toContain("verified LTL shopFlow route only");
    expect(source).toContain("Do not point carton parcels at the LTL rate URL");
    expect(source).toContain("account-authorized parcel endpoint, request/response schema");
  });
});
