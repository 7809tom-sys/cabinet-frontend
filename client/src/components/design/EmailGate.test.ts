import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./EmailGate.tsx", import.meta.url), "utf8");
const translations = readFileSync(new URL("../../lib/i18n/site.ts", import.meta.url), "utf8");

describe("Design Tool email gate", () => {
  it("makes email the only clearly labeled launch requirement", () => {
    expect(source).toContain("Email address <span className=\"font-normal text-muted-foreground\">(required)</span>");
    expect(source).toContain("disabled={!valid}");
    expect(source).not.toContain("disabled={!valid || !name");
    expect(source).not.toContain("disabled={!valid || !phone");
  });

  it("keeps name and phone visibly optional with clear low-pressure help copy", () => {
    expect(source).toContain("Name (optional)");
    expect(source).toContain("Phone (optional)");
    expect(source).toContain("They are not required to open the Designer.");
    expect(source).toContain("We’ll use this to save your design and materials list.");
    expect(translations).toContain('dt_gate_sub: "We’ll use your email to save your design and materials list."');
    expect(translations).not.toContain("so a Cabinet Dealz rep can help if you'd like");
  });
});
