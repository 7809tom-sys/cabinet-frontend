import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";
import DistributorPreviewPage, { DistributorDesignerShell, HERO_COPY, PITCH_COPY } from "./DistributorPreview";
import { DEMO_LINES, productsForLine } from "@/lib/demoDistributor";

function render(section?: string, search = "") {
  return renderToStaticMarkup(
    <Router ssrPath={`/distributor-preview/${section ?? ""}`} ssrSearch={search}>
      <DistributorPreviewPage section={section} />
    </Router>,
  );
}

describe("DistributorPreview render", () => {
  it.each(["storefront", "dashboard", "signup", undefined, "unknown"])("renders the %s section with the demo banner and brand", (section) => {
    const html = render(section);
    expect(html).toContain("Demo Data");
    expect(html).toContain("Cabinet Deals Demo Distributor");
    expect(html).toContain("Demo Distributor Designer");
  });

  it("opens with the pitch banner, then the three-line hero", () => {
    const html = render("storefront");
    expect(html).toContain(PITCH_COPY.headline);
    expect(html).toContain(PITCH_COPY.cta);
    expect(html).toContain(HERO_COPY.headline);
    expect(html).toContain(HERO_COPY.cta);
    expect(html.indexOf(PITCH_COPY.headline)).toBeLessThan(html.indexOf(HERO_COPY.headline));
    for (const line of DEMO_LINES) {
      expect(html).toContain(`Shop ${line.name}`);
      expect(html).toContain(`Design with ${line.name}`);
      expect(html).toContain(`/distributor-preview/design?line=${line.id}`);
    }
  });

  it("shows the selected line's full catalog grouped into Bases, Walls, Talls and Specialties", () => {
    const html = render("storefront", "line=raised-panel");
    for (const group of ["Bases", "Walls", "Talls", "Specialties"]) expect(html).toContain(`Demo Raised Panel · ${group}`);
    expect(html).toContain(`${productsForLine("raised-panel").length} cabinets and parts in Demo Raised Panel`);
    expect(html).toContain("SB36");
    expect(html).toContain("W3630");
    expect(html).not.toContain("OL-B24");
  });

  it("shows sinks and faucets with sink-base compatibility", () => {
    const html = render("storefront");
    expect(html).toContain("Sinks &amp; Faucets");
    expect(html).toContain("Sinks that fit");
    expect(html).toContain("Faucets that fit");
  });

  it("shows orders, leads, affiliates, labor and CRM on the back office", () => {
    const html = render("dashboard");
    for (const label of ["Orders", "Leads", "Affiliates (distributor-owned)", "Labor analytics", "CRM activity", "DEMO-1042"]) {
      expect(html).toContain(label);
    }
  });

  it("keeps the signup CTA disabled until terms are agreed", () => {
    const html = render("signup");
    expect(html).toContain("3%–4%");
    expect(html).not.toContain("/become-a-vendor?type=distributor");
  });

  it("wraps the designer in the demo distributor shell with the designer label", () => {
    const html = renderToStaticMarkup(
      <Router ssrPath="/distributor-preview/design" ssrSearch="line=gray-shaker">
        <DistributorDesignerShell><div id="designer-slot" /></DistributorDesignerShell>
      </Router>,
    );
    expect(html).toContain("Demo Distributor Designer");
    expect(html).toContain("Line: Demo Gray Shaker");
    expect(html).toContain('id="designer-slot"');
    expect(html).toContain("live Cabinet Deals catalog");
  });
});
