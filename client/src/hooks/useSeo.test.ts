import { describe, expect, it } from "vitest";
import { formatSeoTitle } from "./useSeo";

describe("formatSeoTitle", () => {
  it("keeps affiliate designer titles free of the Cabinet Dealz suffix", () => {
    const title = formatSeoTitle(
      "Reaves Way Cabinet Shop. Design Studio",
      "Reaves Way Cabinet Shop.",
      false,
    );

    expect(title).toBe("Reaves Way Cabinet Shop. Design Studio");
    expect(title).not.toContain("Cabinet Dealz");
  });

  it("preserves the platform title suffix for non-white-label pages", () => {
    expect(formatSeoTitle("Kitchen Design Tool")).toBe(
      "Kitchen Design Tool | Cabinet Dealz",
    );
  });
});
