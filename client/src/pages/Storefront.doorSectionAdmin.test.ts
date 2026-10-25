import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const shop = readFileSync(resolve(process.cwd(), "client/src/components/storefront/StorefrontShop.tsx"), "utf8");
const storefront = readFileSync(resolve(process.cwd(), "client/src/pages/Storefront.tsx"), "utf8");

describe("affiliate storefront front-page structure", () => {
  it("keeps one room-scene door-sample section with shopping and detail actions", () => {
    expect(shop.match(/Door samples/g)?.length).toBe(1);
    expect(shop).toContain("Buy now");
    expect(shop).toContain("Design");
    expect(shop).toContain("Door detail");
    expect(shop).not.toContain("Shop This Kitchen");
    expect(shop).not.toContain("grid gap-6 sm:grid-cols-2 lg:grid-cols-3");
  });

  it("renders the management tab only for signed-in admins or affiliates", () => {
    expect(storefront).toContain("<StorefrontManagementTab affiliateId={data.id}");
    expect(storefront).toContain('data-testid="storefront-admin-tab"');
    expect(storefront).toContain('user?.role === "admin" || !!data?.affiliate');
  });
});
