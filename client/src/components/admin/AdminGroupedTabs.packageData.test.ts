import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"),
  "utf8",
);

describe("Admin package data workspace", () => {
  it("keeps the supplier-carton editor reachable from Products & Catalog", () => {
    expect(source).toContain('import { BulkDimensionsAdmin } from "@/components/admin/BulkDimensionsAdmin"');
    expect(source).toContain('{ value: "package-data", label: "📦 Package Data & Parcel" }');
    expect(source).toContain('<TabsContent value="package-data" className="mt-6"><BulkDimensionsAdmin /></TabsContent>');
  });
});
