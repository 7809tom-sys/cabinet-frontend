import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("DesignTool Auto Design subscription gate wiring", () => {
  it("gates the Build action, not opening the dialog", () => {
    expect(source).toContain("onBuild={gatedBuildAutoDesignLayout}");
    expect(source).not.toContain("onBuild={buildAutoDesignLayout}");
    const opener = source.slice(source.indexOf("const openAutoDesign = useCallback"), source.indexOf("const openAutoDesign = useCallback") + 600);
    expect(opener).not.toContain("autoDesignAccess");
  });
  it("only renders the subscribe prompt when the gate flag is on", () => {
    expect(source).toContain("autoDesignAvailable && autoDesignAccess.gateEnabled && (");
    expect(source).toContain("<AutoDesignAccessDialog");
  });
});
