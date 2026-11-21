import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";
import DistributorPreviewPage, { DEMO_NOTICE, DistributorDesignerShell, GUIDE_HEADING, GUIDE_STEPS, HERO_COPY, ORDER_STEPS, PITCH_COPY } from "./DistributorPreview";
import { DEMO_LINES, productsForLine } from "@/lib/demoDistributor";

function render(section?: string, search = "") {
  return renderToStaticMarkup(
    <Router ssrPath={`/distributor-preview/${section ?? ""}`} ssrSearch={search}>
      <DistributorPreviewPage section={section} />
    </Router>,
  );
}

describe("DistributorPreview render", () => {
  it.each(["storefront", "dashboard", "signup", undefined, "unknown"])("renders the %s section with one demo notice and the brand", (section) => {
    const html = render(section);
    expect(html.split(DEMO_NOTICE).length - 1).toBe(1);
    expect(html).not.toContain("Demo price, not a quote");
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

  it("explains every section in the 'How this demo works' guide", () => {
    for (const section of ["storefront", "dashboard", "signup"]) {
      const html = render(section);
      expect(html).toContain(GUIDE_HEADING);
      for (const step of GUIDE_STEPS) expect(html).toContain(step.text);
    }
    const home = render("storefront");
    expect(home.indexOf(PITCH_COPY.headline)).toBeLessThan(home.indexOf(HERO_COPY.headline));
    expect(home.indexOf(HERO_COPY.headline)).toBeLessThan(home.indexOf(GUIDE_HEADING));
  });

  it("shows the selected line's full catalog grouped into Bases, Walls, Talls and Specialties", () => {
    const html = render("storefront", "line=raised-panel");
    for (const group of ["Bases", "Walls", "Talls", "Specialties"]) expect(html).toContain(`Raised Panel · ${group}`);
    expect(html).toContain(`${productsForLine("raised-panel").length} cabinets and parts in Raised Panel`);
    // Product cards are links into the designer with their line.
    expect(html).toContain('aria-label="SB36: design with Raised Panel"');
    expect(html).toContain("Design with this line");
    expect(html).toContain("SB36");
    expect(html).toContain("W3630");
    expect(html).not.toContain("OL-B24");
  });

  it("shows the Design, Price, Order strip and clickable line photos", () => {
    const html = render("storefront");
    for (const step of ORDER_STEPS) {
      expect(html).toContain(step.title);
      expect(html).toContain(step.text);
    }
    for (const line of DEMO_LINES) expect(html).toContain(`aria-label="Shop ${line.name}"`);
    expect(html).not.toContain("lucide-box");
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
    expect(html).toContain("Line: Gray Shaker");
    expect(html).toContain('id="designer-slot"');
    expect(html).toContain("live Cabinet Deals catalog");
    expect(html).toContain(GUIDE_STEPS[1].text);
  });
});
