import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ApprovedVendorsAdmin.tsx", import.meta.url), "utf8");
const nav = readFileSync(new URL("./AdminGroupedTabs.tsx", import.meta.url), "utf8");

describe("Approve Vendors cabinet choice and pending review", () => {
  it("asks for the cabinet checkbox when a vendor is added or edited", () => {
    expect(source).toContain("Is cabinet vendor");
    expect(source).toContain('data-testid="is-cabinet-vendor-field"');
    expect(source).toContain("Not a cabinet vendor");
    expect(source).toContain("isCabinetVendor: form.isCabinetVendor");
    expect(source).toContain("Choose whether this is a cabinet vendor before approving it.");
    expect(source).toContain('data-testid="cabinet-vendor-badge"');
  });

  it("lists vendors that need review without approving them", () => {
    expect(source).toContain("Pending / Needs review");
    expect(source).toContain("trpc.vendors.pendingReview.useQuery");
    expect(source).toContain("Nothing here is approved automatically.");
    expect(source).toContain('data-testid="pending-vendor-review"');
  });

  it("shows the pending count on the People group and the Approve Vendors tab", () => {
    expect(nav).toContain("<PendingVendorCount />");
    expect(nav).toContain('t.value === "approved-vendors" && <PendingVendorCount compact />');
    expect(nav).toContain('data-testid="admin-pending-vendor-count"');
  });
});
