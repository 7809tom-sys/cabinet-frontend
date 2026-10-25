import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
const designActions = fs.readFileSync(path.join(process.cwd(), "client/src/components/design/DesignActions.tsx"), "utf8");

describe("Photo Quality saved-plan eligibility", () => {
  it("does not clear a recently saved plan when the route does not carry a load parameter", () => {
    expect(source).toContain("if (loadDesignId != null) setActiveSavedDesignId(loadDesignId);");
    expect(source).not.toContain("useEffect(() => {\n    setActiveSavedDesignId(loadDesignId);");
  });

  it("passes the retained saved-plan ID to both 3D render entry points", () => {
    expect(source).toContain("const currentSavedDesignId = activeSavedDesignId ?? loadDesignId;");
    expect(source.match(/savedDesignId=\{currentSavedDesignId \?\? null\}/g)).toHaveLength(2);
  });

  it("never turns a missing save response ID into the unusable zero plan reference", () => {
    expect(designActions).toContain("if (!res?.id)");
    expect(designActions).toContain("onSaveSuccess?.(savedName, res.id);");
    expect(designActions).not.toContain("onSaveSuccess?.(savedName, res?.id ?? 0);");
  });
});
