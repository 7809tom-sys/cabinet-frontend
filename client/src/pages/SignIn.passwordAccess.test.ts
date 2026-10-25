import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./SignIn.tsx", import.meta.url), "utf8");

describe("SignIn password access", () => {
  it("gives the person signing in a visible Show/Hide control and a reset-link request action", () => {
    expect(source).toContain('aria-label={showLoginPw ? "Hide password" : "Show password"}');
    expect(source).toContain('>Show</>');
    expect(source).toContain('>Hide</>');
    expect(source).toContain("supabase.auth.resetPasswordForEmail(email");
    expect(source).toContain('new URL("/reset-password", window.location.origin)');
    expect(source).toContain("Email password-reset link");
  });

  it("signs in, signs up and continues with Google through Supabase Auth", () => {
    expect(source).toContain("supabase.auth.signInWithPassword(");
    expect(source).toContain("supabase.auth.signUp(");
    expect(source).toContain("supabase.auth.signInWithOAuth({");
    expect(source).toContain('provider: "google",');
    expect(source).not.toContain("trpc.emailAuth.");
  });

  it("reloads the server-chosen destination after sign-in so the mounted Designer header reads the new session", () => {
    expect(source).toContain("await utils.auth.me.fetch()");
    expect(source).toContain("utils.auth.signInDestination.fetch({ returnPath: requestedReturn() })");
    expect(source).toContain("window.location.assign(destination)");
  });

  it("refuses to enter a requested Designer route as anonymous", () => {
    expect(source).toContain("if (!me) {");
    expect(source).toContain("Your sign-in could not be confirmed. Please try again.");
    expect(source).toContain("return isSafeSiteReturnPath(value) ? value : null;");
  });
});
