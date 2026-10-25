import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/admin/GeminiImageProviderAdmin.tsx"), "utf8");

describe("Gemini image provider Operations panel", () => {
  it("offers an administrator-only connection test and does not render a credential field", () => {
    expect(source).toContain("getGeminiProviderStatus.useQuery");
    expect(source).toContain("testGeminiProvider.useMutation");
    expect(source).toContain("Test connection");
    expect(source).not.toContain('type="password"');
    expect(source).toContain("API key is never displayed");
  });

  it("states the exact saved-plan, phone-verification, and CRM safeguards", () => {
    expect(source).toContain("save the current kitchen plan");
    expect(source).toContain("verify a phone number");
    expect(source).toContain("qualified leads follow the existing CRM path");
  });
});
