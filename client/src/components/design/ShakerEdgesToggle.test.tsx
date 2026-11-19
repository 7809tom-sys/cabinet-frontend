// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShakerEdgesToggle } from "./ShakerEdgesToggle";
import { getShakerOutlinePolicy, setShakerOutlinePolicy } from "@/lib/shakerFrameOutline";

afterEach(() => {
  cleanup();
  setShakerOutlinePolicy({ enabled: true });
  localStorage.clear();
});

describe("ShakerEdgesToggle", () => {
  it("shows the state and flips the Designer's shaker edge policy", () => {
    render(<ShakerEdgesToggle />);
    const button = screen.getByTestId("shaker-edges-toggle");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toMatch(/On/);
    fireEvent.click(button);
    expect(getShakerOutlinePolicy().enabled).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toMatch(/Off/);
    expect(localStorage.getItem("shakerEdges.v1")).toBe("off");
    fireEvent.click(button);
    expect(getShakerOutlinePolicy().enabled).toBe(true);
  });

  it("sets the tier from the Designer's quality profile on mount", () => {
    setShakerOutlinePolicy({ tier: "high" });
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    render(<ShakerEdgesToggle />);
    expect(getShakerOutlinePolicy().tier).toBe("mobile");
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
  });

  it("is mounted with the Designer's floating quick actions in DesignTool", () => {
    const source = readFileSync("client/src/pages/DesignTool.tsx", "utf8");
    expect(source).toContain('import { ShakerEdgesToggle } from "@/components/design/ShakerEdgesToggle";');
    expect(source).toMatch(/<ShakerEdgesToggle \/>\s*<\/>\s*\);/);
  });
});
