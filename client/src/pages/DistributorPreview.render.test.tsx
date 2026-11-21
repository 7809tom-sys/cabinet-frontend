import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";
import DistributorPreviewPage from "./DistributorPreview";

function DistributorPreview({ section }: { section?: string }) {
  return (
    <Router ssrPath={`/distributor-preview/${section ?? ""}`}>
      <DistributorPreviewPage section={section} />
    </Router>
  );
}

describe("DistributorPreview render", () => {
  it.each(["storefront", "designer", "dashboard", "signup", undefined, "unknown"])("renders the %s section with the demo banner", (section) => {
    const html = renderToStaticMarkup(<DistributorPreview section={section} />);
    expect(html).toContain("Demo Data");
    expect(html).toContain("Demo Distributor");
  });

  it("shows only the distributor's products on the storefront", () => {
    const html = renderToStaticMarkup(<DistributorPreview section="storefront" />);
    expect(html).toContain("DB18-3");
    expect(html).not.toContain("OL-B24");
  });

  it("links the designer through the existing branded store path", () => {
    expect(renderToStaticMarkup(<DistributorPreview section="designer" />)).toContain('href="/store/sales-demo/design"');
  });

  it("shows orders, leads, affiliates, labor and CRM on the back office", () => {
    const html = renderToStaticMarkup(<DistributorPreview section="dashboard" />);
    for (const label of ["Orders", "Leads", "Affiliates (distributor-owned)", "Labor analytics", "CRM activity", "DEMO-1042"]) {
      expect(html).toContain(label);
    }
  });

  it("keeps the signup CTA disabled until terms are agreed", () => {
    const html = renderToStaticMarkup(<DistributorPreview section="signup" />);
    expect(html).toContain("3%–4%");
    expect(html).not.toContain("/become-a-vendor?type=distributor");
  });
});
