import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { kitchenRuleSyncPlan } from "./kitchenRulesApi";

describe("kitchenRules.parameters failures", () => {
  it("falls back to seeded defaults and does not apply a missing procedure", () => {
    expect(kitchenRuleSyncPlan({ isError: true, data: undefined })).toBe("defaults");
    expect(kitchenRuleSyncPlan({ isError: false, data: undefined })).toBe("wait");
    expect(kitchenRuleSyncPlan({ isError: false, data: { values: { jog_max_in: 2 } } })).toBe("apply");
  });

  it("does not retry the query and keeps it out of the Designer load batch", () => {
    const api = readFileSync(new URL("./kitchenRulesApi.ts", import.meta.url), "utf8");
    const main = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
    expect(api).toContain("retry: false");
    expect(api).toContain("throwOnError: false");
    expect(main).toContain('op.path === "kitchenRules.parameters"');
    expect(main).toContain("httpLink(trpcHttpOptions)");
    expect(main).toContain("httpBatchLink(trpcHttpOptions)");
  });
});
