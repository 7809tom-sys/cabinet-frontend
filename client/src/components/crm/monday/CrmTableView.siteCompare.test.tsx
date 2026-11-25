// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrmTableView, type TableDeal } from "./CrmTableView";

afterEach(cleanup);
vi.mock("@/lib/trpc", () => ({ trpc: { crm: {} } }));

const base: TableDeal = {
  id: 1, title: "Deal", stage: "new", priority: "medium", contactName: "Name",
  contactEmail: null, company: null, estimatedValue: null, nextFollowUpAt: null, affiliateId: null,
};
const distributor: TableDeal = {
  ...base, id: 2, contactName: "Kabinet King", company: "Distributor prospect - needs new site",
  notes: "NEEDS NEW SITE: yes, rank 12 of 33.\nPlatform: Turbify (Yahoo Store)\nSite quality: 5/10 | Mobile PageSpeed: 29/100",
};

describe("CRM table site comparison", () => {
  it("hides the column when no distributor prospects are listed", () => {
    render(<CrmTableView deals={[base]} lang="en" showAffiliate onOpen={vi.fn()} onPatch={vi.fn()} />);
    expect(screen.queryByText("Site vs Cabinetdealz")).toBeNull();
  });

  it("shows their stats and the Cabinetdealz row with an indicator for distributor rows only", () => {
    render(<CrmTableView deals={[base, distributor]} lang="en" showAffiliate onOpen={vi.fn()} onPatch={vi.fn()} />);
    expect(screen.getByText("Site vs Cabinetdealz")).toBeTruthy();
    expect(screen.getAllByTestId("crm-site-compare-cell")).toHaveLength(2);
    expect(screen.getByTestId("crm-compare-theirs").textContent).toContain("Quality 5/10 · Mobile 29/100 · Turbify (Yahoo Store) · needs new site (#12)");
    const ours = screen.getByTestId("crm-compare-cabinetdealz").textContent ?? "";
    expect(ours).toContain("Quality not scored");
    expect(ours).toContain("Custom (React/Vite)");
    expect(ours).toContain("measured Nov 25, 2026");
    expect(screen.getByTestId("crm-compare-ahead").textContent).toBe("▲ 64");
  });
});
