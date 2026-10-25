import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tabs = readFileSync(new URL("./AdminGroupedTabs.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("./DistributorFulfillmentEditor.tsx", import.meta.url), "utf8");

describe("Glass Policy administration tab", () => {
  it("makes the distributor-wide glass audit a first-class Products & Catalog tab", () => {
    expect(tabs).toContain('{ value: "glass-policy", label: "Glass Policy" }');
    expect(tabs).toContain('<TabsContent value="glass-policy" className="mt-6"><AdminTabHelp tab="glass-policy" /><DistributorFulfillmentEditor glassOnly /></TabsContent>');
    expect(editor).toContain('Distributor glass policy audit');
    expect(editor).toContain('data-testid={glassOnly ? "glass-policy-admin" : "distributor-fulfillment-admin"}');
    expect(editor).toContain('Save glass policy');
  });
});
