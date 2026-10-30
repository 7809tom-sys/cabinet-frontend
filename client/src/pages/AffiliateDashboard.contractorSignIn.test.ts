import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contractorSignInHref } from "../lib/portalSignIn";

const source = readFileSync(
  new URL("./AffiliateDashboard.tsx", import.meta.url),
  "utf8",
);
const layout = readFileSync(
  new URL(
    "../components/affiliate/AffiliateDashboardLayout.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("affiliate page contractor sign-in link", () => {
  it("shows Contractor sign in beside affiliate sign-in at the top of the public page", () => {
    const landing = source.slice(
      source.indexOf("function AffiliateLanding"),
      source.indexOf("function AffiliateStoreUnlinked"),
    );
    const top = landing.slice(0, landing.indexOf("{/* Hero */}"));
    expect(top).toContain(">Affiliate sign in</Link>");
    expect(top).toContain(">Contractor sign in</Link>");
    expect(top).toContain("href={affiliateHref}");
    expect(top).toContain("href={contractorHref}");
    expect(top).toContain("<Link ");
    expect(landing).toContain(
      "const contractorHref = contractorSignInHref({ pathname, search, storedRef });",
    );

    const chooserAt = landing.indexOf("<PortalSignInChooser />");
    expect(chooserAt).toBeGreaterThan(landing.indexOf("{/* Hero */}"));
    const besideChooser = landing.slice(chooserAt, chooserAt + 400);
    expect(besideChooser).toContain("href={contractorHref}");
    expect(besideChooser).toContain(">Contractor sign in</Link>");
  });

  it("links to /contractor/login and keeps referral and store context", () => {
    expect(
      contractorSignInHref({
        pathname: "/affiliate",
        search: "",
      }),
    ).toBe("/contractor/login?portal=contractor&returnTo=%2Fcontractor");

    expect(
      contractorSignInHref({
        pathname: "/affiliate",
        search: "?ref=FIRSTCLASS",
      }),
    ).toBe(
      "/contractor/login?portal=contractor&returnTo=%2Fcontractor&ref=FIRSTCLASS",
    );

    expect(
      contractorSignInHref({
        pathname: "/affiliate",
        search: "?store=reaves-way-cabinet-shop",
      }),
    ).toBe(
      "/contractor/login?portal=contractor&returnTo=%2Fcontractor%3Fstore%3Dreaves-way-cabinet-shop",
    );

    expect(
      contractorSignInHref({
        pathname: "/affiliate",
        search: "?ref=FIRSTCLASS&store=reaves-way-cabinet-shop",
      }),
    ).toBe(
      "/contractor/login?portal=contractor&returnTo=%2Fcontractor%3Fstore%3Dreaves-way-cabinet-shop&ref=FIRSTCLASS",
    );

    expect(
      contractorSignInHref({
        pathname: "/store/reaves-way-cabinet-shop/signin",
        search: "",
      }),
    ).toBe(
      "/contractor/login?portal=contractor&returnTo=%2Fcontractor%3Fstore%3Dreaves-way-cabinet-shop",
    );
  });

  it("leaves the signed-in affiliate dashboard free of a contractor sign-in link", () => {
    const dashboard = source.slice(
      source.indexOf("export default function AffiliateDashboard"),
    );
    expect(dashboard).not.toContain("Contractor sign in");
    expect(layout).not.toContain("Contractor sign in");
  });
});
