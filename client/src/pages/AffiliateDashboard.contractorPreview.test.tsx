// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContractorPreviewCard } from "@/components/affiliate/ContractorPreviewCard";

const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/AffiliateDashboard.tsx"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "client/src/components/affiliate/AffiliateDashboardLayout.tsx"), "utf8");
const contractor = readFileSync(resolve(process.cwd(), "client/src/pages/ContractorDashboard.tsx"), "utf8");
const card = readFileSync(resolve(process.cwd(), "client/src/components/affiliate/ContractorPreviewCard.tsx"), "utf8");

afterEach(cleanup);

describe("affiliate dashboard contractor preview", () => {
  it("sits on the overview and repeats on the Add a contractor section", () => {
    const overview = dashboard.slice(dashboard.indexOf('case "overview"'), dashboard.indexOf('case "crm"'));
    expect(overview).toContain("<ContractorPreviewCard");
    expect(overview).toContain("<AffiliateTierCard");
    expect(overview.indexOf("<AffiliateTierCard")).toBeLessThan(overview.indexOf("<ContractorPreviewCard"));

    const contractors = dashboard.slice(dashboard.indexOf('case "contractors"'), dashboard.indexOf('case "email"'));
    expect(contractors).toContain("<ContractorPreviewCard");
    expect(contractors).toContain("<AddContractorPanel");
    expect(contractors.indexOf("<ContractorPreviewCard")).toBeLessThan(contractors.indexOf("<AddContractorPanel"));
  });

  it("shows the preview to affiliates/partners and to an admin viewing a store", () => {
    // Both call sites pass the signed-in role so the URL can pick staff-preview or sample data.
    expect(dashboard.match(/<ContractorPreviewCard role=\{user\?\.role\}/g)).toHaveLength(2);
    expect(dashboard.match(/storeSlug=\{affiliate\.slug\}/g)?.length).toBeGreaterThanOrEqual(2);

    // The view-as admin is already handled: admins resolve to staff-preview too.
    expect(layout).toContain("const canPreviewContractor = Boolean(isAffiliateOwner || isAdmin);");
    expect(layout).toContain("contractorPreviewHref(user?.role, storeSlug)");
    expect(layout).toContain('data-testid="sidebar-contractor-preview"');
    expect(layout).toContain("Preview contractor page");
  });

  it("opens /contractor in a new tab and never offers a write action", () => {
    render(<ContractorPreviewCard role="partner" storeSlug="reaves-way-cabinet-shop" />);
    const link = screen.getByRole("link", { name: /Preview contractor page/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/contractor?store=reaves-way-cabinet-shop");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("heading", { name: /Preview the contractor page/i })).toBeTruthy();
    expect(card).not.toMatch(/useMutation|mutate\(/);
  });

  it("falls back to sample data for a login that would hit the applicant form", () => {
    render(<ContractorPreviewCard role="user" storeSlug="reaves-way-cabinet-shop" />);
    const link = screen.getByRole("link", { name: /Preview contractor page/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/contractor?preview=1&store=reaves-way-cabinet-shop");
    expect(screen.getByText(/shows sample data/)).toBeTruthy();
  });

  it("keeps the contractor portal read-only in staff-preview", () => {
    // Sample mode never touches the contractor procedures…
    expect(contractor).toContain("enabled: !preview");
    expect(contractor).toContain("if (preview || staffPreview) return");
    // …and staff-preview disables every write control it renders.
    expect(contractor).toContain("disabled={preview || staffPreview || createCustomer.isPending}");
    expect(contractor).toContain("disabled={preview || staffPreview || assignDesign.isPending}");
    expect(contractor).toContain('audience="contractor" contractorUserId={contractorUserId} readOnly={staffPreview}');
    expect(contractor).toContain("staffPreviewEmptyCopy(\"orders\")");
    expect(contractor).toContain("STAFF_PREVIEW_ACTION_TITLE");
  });
});
