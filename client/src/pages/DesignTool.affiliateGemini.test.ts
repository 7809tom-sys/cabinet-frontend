import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("affiliate Gemini Designer wiring", () => {
  it("passes affiliate Designer access to both real 3D viewers", () => {
    expect(source).toContain("const canAffiliateGeminiImageTest = !!affiliateSlug && affiliatePriceAccess.data?.accessDesigner === true;");
    const viewers = source.split("<InteractiveRoom3D").slice(1).map((block) => block.slice(0, block.indexOf("/>")));
    expect(viewers).toHaveLength(2);
    for (const viewer of viewers) {
      expect(viewer).toContain("canAffiliateGeminiImageTest={canAffiliateGeminiImageTest}");
      expect(viewer).toContain("savedDesignId={currentSavedDesignId ?? null}");
      expect(viewer).toContain("isCurrentPlanSaved={isCurrentPlanSaved}");
    }
  });
});
