import { describe, expect, it } from "vitest";
import { homepageWelcomeName } from "./homepageWelcome";

describe("homepageWelcomeName", () => {
  it("uses the authenticated user's first name", () => {
    expect(homepageWelcomeName({ name: "Tom Reaves", email: "tom@example.com" })).toBe("Tom");
  });

  it("falls back to company name when a personal name is unavailable", () => {
    expect(homepageWelcomeName({ name: "  ", companyName: "Reaves Way Cabinet Shop" })).toBe("Reaves Way Cabinet Shop");
  });

  it("creates a readable fallback from the email local part", () => {
    expect(homepageWelcomeName({ email: "first.last@example.com" })).toBe("First");
  });

  it("uses a neutral fallback without exposing account identifiers", () => {
    expect(homepageWelcomeName({})).toBe("there");
  });
});
