import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("Designer door frame source binding", () => {
  it("uses the Slim Shaker-aware resolver for elevation and both 3D profile paths", () => {
    expect(source).toContain('import { designerDoorFrameMetrics } from "@/lib/doorFrameMetrics";');
    expect(source).toContain("const frame = designerDoorFrameMetrics(s);");
    expect(source).toContain("const frame = designerDoorFrameMetrics(frameStyle);");
    expect(source).toContain("Slim Shaker family rule");
  });
});
