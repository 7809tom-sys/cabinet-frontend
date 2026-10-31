import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designer = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");
const room = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("./ColorStyleQuickPicker.tsx", import.meta.url), "utf8");

describe("color style quick picker", () => {
  it("offers Select a color style on the Designer toolbar and the 3D front view", () => {
    expect(picker).toContain('aria-label="Select a color style"');
    expect(picker).toContain("Select a color style");
    expect(picker).toContain("inline-flex");
    expect(picker).not.toContain("hidden lg:");
    expect(designer).toContain("<ColorStyleQuickPicker");
    expect(designer).toContain('onChange={(id) => setSlotStyle(activeSlot, id)}');
    expect(room).toContain('testId="three-d-color-style-picker"');
    expect(room).toContain("bottom-3 left-3 z-30 flex");
    expect(room).not.toContain("three-d-color-style-picker\" className={`hidden");
  });
});
