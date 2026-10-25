import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./EmailSettingsAdmin.tsx", import.meta.url), "utf8");

describe("Email Settings administration UX", () => {
  it("shows a clear configured and sending state", () => {
    expect(source).toContain('"Active" : isConfigured ? "Configured (disabled)" : "Not configured"');
    expect(source).toContain('form.enabled ? "On — sending enabled" : "Off — sending paused"');
    expect(source).toContain('aria-label="Enable email sending"');
  });

  it("requires saved current settings before a test email can be sent", () => {
    expect(source).toContain("const hasUnsavedChanges = Boolean(");
    expect(source).toContain("const canSendTest = Boolean(testEmail.trim() && isConfigured && !testing && !hasUnsavedChanges)");
    expect(source).toContain("disabled={!canSendTest}");
    expect(source).toContain("Save your email-setting changes before sending a test message.");
  });

  it("preserves in-progress SMTP entries through a background refetch and offers a Hostinger preset", () => {
    expect(source).toContain("const savedSettingsKeyRef = useRef<string | null>(null)");
    expect(source).toContain("const previousSavedKey = savedSettingsKeyRef.current");
    expect(source).toContain("previousSavedKey !== savedKey");
    expect(source).toContain('const HOSTINGER_SMTP_HOST = "smtp.hostinger.com"');
    expect(source).toContain('const HOSTINGER_SMTP_PORT = "465"');
    expect(source).toContain("Use Hostinger preset");
    expect(source).toContain("Test unavailable until the saved settings include");
  });

  it("does not claim that database persistence itself is the security feature", () => {
    expect(source).toContain("Saved passwords are never returned to this page.");
    expect(source).not.toContain("Credentials are stored securely in the database; you never need to touch environment variables.");
    expect(source).not.toContain("Titan Email SMTP Quick Reference");
  });
});
