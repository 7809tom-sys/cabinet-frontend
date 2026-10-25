import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/design/DesignActions.tsx"), "utf8");

describe("DesignActions saved-design session recovery", () => {
  it("refreshes account state when My Designs is opened and waits for auth resolution", () => {
    expect(source).toContain("loading: isAuthLoading, error: authError, refresh");
    expect(source).toContain("void refresh();");
    expect(source.indexOf("{isAuthLoading ? (")).toBeLessThan(source.indexOf(": !isAuthenticated ? ("));
  });

  it("provides session recovery actions instead of an unexplained anonymous prompt", () => {
    expect(source).toContain("We could not confirm your session for this shop.");
    expect(source).toContain("Check account again");
    expect(source).toContain("Sign in again");
    expect(source).toContain("href={getLoginUrl()}");
  });

  it("does not present an anonymous visitor with a save action that cannot own a plan", () => {
    expect(source).toContain("{isAuthenticated ? (");
    expect(source).toContain("Sign in to save");
    expect(source).toContain("<a href={getLoginUrl()}>Sign in to save</a>");
  });
});
