import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("DesignTool saved-design ownership loading", () => {
	it("requires authentication and permits an authorized CRM link to verify before the customer email gate", () => {
    expect(source).toContain("const { user, isAuthenticated } = useAuth();");
	  expect(source).toContain("enabled: currentSavedDesignId != null && isAuthenticated && (verified || crmDealId != null)");
	  expect(source).toContain("if (verified || crmDealId == null || !savedDesign || !isAuthenticated) return");
  });
});
