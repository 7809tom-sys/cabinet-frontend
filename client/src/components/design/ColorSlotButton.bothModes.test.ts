import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { matchesStyleSearch } from "./ColorSlotButton";

describe("shared Designer color picker", () => {
  it("finds a finish by its source color, finish name, or SKU", () => {
    const style = {
      id: 1,
      ourName: "Oxford Blanc",
      color: "#F0F0F0",
      finish: "Oxford Blanc",
      styleCode: "OXFORD",
    };
    expect(matchesStyleSearch(style, "f0f0f0")).toBe(true);
    expect(matchesStyleSearch(style, "oxford")).toBe(true);
    expect(matchesStyleSearch(style, "not-a-finish")).toBe(false);
  });

  it("exposes the same touch-friendly color UI for both Designer modes", () => {
    const picker = readFileSync(
      resolve(process.cwd(), "client/src/components/design/ColorSlotButton.tsx"),
      "utf8",
    );
    const designer = readFileSync(
      resolve(process.cwd(), "client/src/pages/DesignTool.tsx"),
      "utf8",
    );

    expect(picker).toContain("Light → Dark");
    expect(picker).toContain("Search finish name, color, series or SKU");
    expect(picker).toContain("aria-label={`${label} selected color`}");
    expect(designer.match(/<ColorSlotButton/g)?.length).toBeGreaterThanOrEqual(4);
    expect(designer).toContain("roomType");
  });
});
