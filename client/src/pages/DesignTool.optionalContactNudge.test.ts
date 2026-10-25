import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const nudgeSource = readFileSync(new URL("../components/design/OptionalContactNudge.tsx", import.meta.url), "utf8");

describe("Designer optional contact nudge", () => {
  it("offers optional contact collection after first save or ninety seconds without blocking the workspace", () => {
    expect(source).toContain("window.setTimeout(() => setShowOptionalContactNudge(true), 90_000)");
    expect(source).toContain("if (!verifiedName && !verifiedPhone && !optionalContactDismissed)");
    expect(source).toContain("<OptionalContactNudge");
    expect(nudgeSource).toContain("You can continue without them.");
    expect(nudgeSource).toContain("Not now");
  });

  it("writes optional follow-up details back to the existing lead without changing the image-request gate", () => {
    expect(source).toContain('interaction: "contact_update"');
    expect(source).toContain("Contact details saved");
    expect(source).not.toContain("setPhotoVerificationStatus(\"verified\")");
  });
});
