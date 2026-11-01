import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const designer = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("regular Designer Handles access beyond the main toolbar", () => {
  it("makes the existing hardware chooser recognizable as Handles in More tools", () => {
    expect(designer).toContain('data-testid="designer-more-handles"');
    expect(designer).toContain("Handles &amp; knobs");
    expect(designer).toContain("setHardwareSheetOpen(true)");
  });
});
