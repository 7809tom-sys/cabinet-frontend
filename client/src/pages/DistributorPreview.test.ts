import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./DistributorPreview.tsx", import.meta.url), "utf8");
const adminSource = readFileSync(new URL("../components/admin/AffiliatesAdmin.tsx", import.meta.url), "utf8");

describe("demo distributor preview page", () => {
  it("registers the preview routes next to the affiliate template preview", () => {
    expect(appSource).toContain('const DistributorPreview = lazy(() => import("@/pages/DistributorPreview"))');
    expect(appSource).toContain('<Route path="/distributor-preview/:section">');
    expect(appSource).toContain('<Route path="/distributor-preview">');
    expect(appSource.indexOf('<Route path="/store-preview/:template">')).toBeLessThan(appSource.indexOf('<Route path="/distributor-preview/:section">'));
  });

  it("labels the page as demo data and offers all four sections", () => {
    expect(pageSource).toContain("Demo Data");
    expect(pageSource).toContain("StorefrontSection");
    expect(pageSource).toContain("DesignerSection");
    expect(pageSource).toContain("DashboardSection");
    expect(pageSource).toContain("SignupSection");
  });

  it("does not import the frozen designer files and makes no API calls", () => {
    expect(pageSource).not.toMatch(/InteractiveRoom3D|pages\/DesignTool/);
    expect(pageSource).not.toContain("trpc");
  });

  it("gates the signup CTA on the terms checkbox and routes to the existing application", () => {
    expect(pageSource).toContain('href="/become-a-vendor?type=distributor"');
    expect(pageSource).toContain("Direct CSV orders:");
    expect(pageSource).toContain("{agreed ? (");
  });

  it("links the demo from the affiliates admin next to the demo storefront", () => {
    expect(adminSource).toContain('href="/distributor-preview/storefront"');
    expect(adminSource).toContain("Demo Distributor");
  });
});
