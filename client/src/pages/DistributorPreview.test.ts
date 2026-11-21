import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./DistributorPreview.tsx", import.meta.url), "utf8");
const libSource = readFileSync(new URL("../lib/demoDistributor.ts", import.meta.url), "utf8");
const affiliatesAdminSource = readFileSync(new URL("../components/admin/AffiliatesAdmin.tsx", import.meta.url), "utf8");
const groupedTabsSource = readFileSync(new URL("../components/admin/AdminGroupedTabs.tsx", import.meta.url), "utf8");

describe("demo distributor preview page", () => {
  it("registers the preview routes next to the affiliate template preview", () => {
    expect(appSource).toContain('const DistributorPreview = lazy(() => import("@/pages/DistributorPreview"))');
    expect(appSource).toContain('<Route path="/distributor-preview/:section">');
    expect(appSource).toContain('<Route path="/distributor-preview">');
    expect(appSource.indexOf('<Route path="/store-preview/:template">')).toBeLessThan(appSource.indexOf('<Route path="/distributor-preview/:section">'));
  });

  it("mounts the unchanged DesignTool inside the demo distributor shell at /distributor-preview/design", () => {
    const design = appSource.indexOf('<Route path="/distributor-preview/design">');
    const section = appSource.indexOf('<Route path="/distributor-preview/:section">');
    expect(design).toBeGreaterThan(-1);
    expect(design).toBeLessThan(section);
    const block = appSource.slice(design, section);
    expect(block).toContain("<DistributorDesignerShell>");
    expect(block).toContain("<DesignTool />");
    expect(block).not.toContain("affiliateSlug");
    expect(appSource).toContain('<Route path="/distributor-preview/designer">');
  });

  it("never sends the demo designer to the sales demo storefront", () => {
    expect(pageSource).not.toContain("sales-demo");
    expect(libSource).not.toMatch(/=\s*"sales-demo"/);
  });

  it("labels the page as demo data and keeps the four nav entries", () => {
    expect(pageSource).toContain("Demo Data");
    expect(pageSource).toContain("StorefrontSection");
    expect(pageSource).toContain("DashboardSection");
    expect(pageSource).toContain("SignupSection");
    expect(pageSource).toContain("label: DEMO_DESIGNER_LABEL");
  });

  it("does not import the frozen designer files and makes no API calls", () => {
    expect(pageSource).not.toMatch(/InteractiveRoom3D|pages\/DesignTool/);
    expect(pageSource).not.toContain("trpc");
  });

  it("sets share metadata for emailing the page", () => {
    expect(pageSource).toContain("useSeo({");
    expect(pageSource).toContain("image: DEMO_SHARE.image");
    expect(libSource).toContain('url: "https://www.cabinetdealz.com/distributor-preview"');
  });

  it("gates the signup CTA on the terms checkbox and routes to the existing application", () => {
    expect(pageSource).toContain('href="/become-a-vendor?type=distributor"');
    expect(pageSource).toContain("Direct CSV orders:");
    expect(pageSource).toContain("{agreed ? (");
  });

  it("names no supplier in the page copy", () => {
    expect(`${pageSource}\n${libSource}`).not.toMatch(/US Cabinet Depot|USCD|Pelican|StoneCreek/);
  });

  it("links the demo from Affiliates admin and from the Vendors tab", () => {
    expect(affiliatesAdminSource).toContain('href="/distributor-preview"');
    expect(affiliatesAdminSource).toContain("Cabinet Deals Demo Distributor");
    const vendors = groupedTabsSource.indexOf('<TabsContent value="vendors"');
    const next = groupedTabsSource.indexOf('<TabsContent value="approved-vendors"');
    const block = groupedTabsSource.slice(vendors, next);
    expect(block).toContain('href="/distributor-preview"');
    expect(block).toContain("Demo Distributor</Button>");
  });
});
