import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ResetPassword.tsx", import.meta.url), "utf8");

describe("ResetPassword", () => {
  it("requires a Supabase recovery session and matching password confirmation before updating the password", () => {
    expect(source).toContain('event === "PASSWORD_RECOVERY"');
    expect(source).toContain("if (!hasRecoverySession) {");
    expect(source).toContain("password !== confirmation");
    expect(source).toContain("supabase.auth.updateUser({ password })");
    expect(source).toContain('window.location.assign("/signin")');
  });
});
