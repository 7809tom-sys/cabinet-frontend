import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("direct Designer startup", () => {
  it("warms the route-split Designer module only for direct Designer URLs", () => {
    expect(appSource).toContain('const designToolModule = isDirectDesignerRoute ? import("@/pages/DesignTool") : null;');
    expect(appSource).toContain('window.location.pathname === "/design"');
    expect(appSource).toContain("/^\\/store\\/[^/]+\\/design\\/?$/");
    expect(appSource).toContain('lazy(() => designToolModule ?? import("@/pages/DesignTool"))');
  });

  it("keeps the Designer route split for non-Designer pages", () => {
    expect(appSource).toContain("const DesignTool = lazy");
    expect(appSource).toContain('designToolModule ?? import("@/pages/DesignTool")');
  });
});
