import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");
const storefront = readFileSync(new URL("../../pages/Storefront.tsx", import.meta.url), "utf8");
const vendor = readFileSync(new URL("../../pages/VendorPortal.tsx", import.meta.url), "utf8");

describe("store corner menu wiring", () => {
  it("places the same corner menu on the affiliate shell and the storefront home nav", () => {
    expect(app).toContain('<StoreCornerMenu slug={slug} storeId={data?.id ?? null} />');
    expect(storefront).toContain("<StoreCornerMenu slug={slug} storeId={storeId} className={cls} />");
    expect(storefront).toContain("<StoreCornerMenu slug={slug} storeId={storeId} stacked />");
    expect(storefront).not.toMatch(/["'`]\/admin/);
  });

  it("shows the existing-account message on supplier registration", () => {
    expect(vendor).toContain("isRepeatedSignup(data.user)");
    expect(vendor).toContain("ACCOUNT_ALREADY_EXISTS_MESSAGE");
    expect(vendor).toContain(">Sign in</button>");
    expect(vendor).toContain('href="/signin"');
  });
});
