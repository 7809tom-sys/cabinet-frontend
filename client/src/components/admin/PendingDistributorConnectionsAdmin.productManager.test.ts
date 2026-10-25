import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Supplier Product Manager", () => {
  const source = readFileSync(
    resolve(process.cwd(), "client/src/components/admin/PendingDistributorConnectionsAdmin.tsx"),
    "utf8",
  );

  it("offers direct add, draft, edit, publish, and unpublish controls", () => {
    expect(source).toContain("Supplier Product Manager");
    expect(source).toContain("Add Product");
    expect(source).toContain("Save Draft");
    expect(source).toContain("Publish Product");
    expect(source).toContain("Unpublish");
    expect(source).toContain("Edit Supplier Product");
  });

  it("uses the administrator product procedures and explains unmapped-item safety", () => {
    expect(source).toContain("trpc.distributorPortal.adminProductList.useQuery");
    expect(source).toContain("trpc.distributorPortal.adminSaveProduct.useMutation");
    expect(source).toContain("Master Product Code");
    expect(source).toContain("Standalone items remain safely outside");
    expect(source).toContain("customer cabinet catalog or 3D Designer");
  });
});
