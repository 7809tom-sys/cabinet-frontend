// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, describe, expect, it, vi } from "vitest";
import AffiliateGuidePage, { AffiliateGuideViewer } from "@/pages/AffiliateGuide";
import { LanguageProvider } from "@/contexts/LanguageContext";

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

function renderAt(path: string, element: React.ReactNode) {
  const { hook } = memoryLocation({ path, static: true });
  return render(
    <Router hook={hook}>
      <LanguageProvider>{element}</LanguageProvider>
    </Router>,
  );
}

function renderGuideRoute(path: string) {
  const { hook } = memoryLocation({ path, static: true });
  return render(
    <Router hook={hook}>
      <LanguageProvider>
        <Route path="/affiliate/guide/:slug">
          {(params) => <AffiliateGuideViewer slug={params.slug} />}
        </Route>
      </LanguageProvider>
    </Router>,
  );
}

afterEach(() => {
  cleanup();
});

describe("affiliate guide route", () => {
  it("renders the guide markdown instead of NotFound for each legacy guide file", async () => {
    renderGuideRoute("/affiliate/guide/10-steps-to-a-sale");
    await waitFor(() => {
      expect(screen.getByTestId("affiliate-guide-body").textContent).toContain("Step 1: Prospect");
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("10 Steps to a Sale");
  });

  it("keeps working for a bookmark that still carries mixed case", async () => {
    renderAt("/affiliate/guide/Kitchen-Design-Fundamentals", <AffiliateGuideViewer slug="Kitchen-Design-Fundamentals" />);
    await waitFor(() => {
      expect(screen.getByTestId("affiliate-guide-body").textContent).toContain("Part 1: How to Measure Your Kitchen");
    });
  });

  it("links the other guides so a reader can move through the playbook", async () => {
    renderAt("/affiliate/guide/how-to-use-your-crm", <AffiliateGuideViewer slug="how-to-use-your-crm" />);
    await waitFor(() => expect(screen.getByTestId("markdown")).toBeTruthy());
    const links = Array.from(document.querySelectorAll("nav[aria-label='Other training guides'] a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/affiliate/guide/10-steps-to-a-sale",
      "/affiliate/guide/kitchen-design-fundamentals",
      "/affiliate/guide/marketing-scripts-and-templates",
    ]);
  });

  it("still shows the 404 for an unpublished guide file", () => {
    renderAt("/affiliate/guide/does-not-exist", <AffiliateGuideViewer slug="does-not-exist" />);
    expect(screen.queryByTestId("affiliate-guide-body")).toBeNull();
    expect(screen.queryByTestId("affiliate-guide")).toBeNull();
  });
});

describe("app route registration for legacy affiliate links", () => {
  it("registers the guide viewer and the digital-card redirect", () => {
    expect(appSource).toContain('const AffiliateGuide = lazy(() => import("@/pages/AffiliateGuide"))');
    expect(appSource).toContain('<Route path="/affiliate/guide/:slug">');
    expect(appSource).toContain("<AffiliateGuide />");
    expect(appSource).toContain('<Route path="/card/:slug">');
    expect(appSource).toContain("<AffiliateCardRedirect slug={params.slug} />");
  });

  it("sends a legacy /card/<slug> address to that affiliate's storefront", () => {
    expect(appSource).toContain("function AffiliateCardRedirect");
    expect(appSource).toContain("window.location.replace(affiliateStorefrontPath(slug))");
  });

  it("keeps routed guides out of the affiliate-owner dashboard redirect", () => {
    const urlSource = readFileSync(resolve(process.cwd(), "client/src/lib/affiliateStorefrontUrl.ts"), "utf8");
    expect(urlSource).toContain("AFFILIATE_GUIDE_ROOT");
    expect(urlSource).toContain("pathname.startsWith(`${AFFILIATE_GUIDE_ROOT}/`)");
  });
});
