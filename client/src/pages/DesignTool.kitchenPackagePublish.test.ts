import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Kitchen Package publishing", () => {
  it("allows the owning affiliate as well as an admin to create a package", () => {
    expect(source).toContain("const canPublishKitchenPackage = isAdmin || (!!affiliateSlug && (affiliatePriceAccess.data?.isOwner === true || affiliatePriceAccess.data?.accessDesigner === true))");
    expect(source).toContain("{canPublishKitchenPackage && (");
  });

  it("uses Kitchen Package naming in the owner action", () => {
    expect(source).toContain("Save as Kitchen Package");
    expect(source).toContain("Create Kitchen Package");
  });
});
