import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./NotificationSettingsAdmin.tsx", import.meta.url), "utf8");

describe("CRM help team notification settings", () => {
  it("lets an administrator separately configure and opt into Design Help and Shipping Cost Help alerts", () => {
    expect(source).toContain("onCrmDesignHelp: string");
    expect(source).toContain("onCrmShippingHelp: string");
    expect(source).toContain("notifyOnCrmDesignHelp: boolean");
    expect(source).toContain("notifyOnCrmShippingHelp: boolean");
    expect(source).toContain("CRM Design Help");
    expect(source).toContain("CRM Shipping Cost Help");
  });

  it("makes clear that recipient lists are inactive until the team-specific alert is enabled", () => {
    expect(source).toContain("Enable Design Help alerts");
    expect(source).toContain("Enable Shipping Cost Help alerts");
    expect(source).toContain("Recipient lists can be saved while alerts are off");
    expect(source).toContain("no email sends until the matching switch");
  });
});
