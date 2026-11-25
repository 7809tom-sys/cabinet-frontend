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
const shop: TableDeal = {
  ...base, id: 3, contactName: "Creative Kitchen Designs", company: "Cabinet shop prospect",
  notes: "cabinet_shop_list_2026-11-24\nLocation: Altamonte Springs, FL | State: FL | Region: Central FL\nWebsite: http://www.ckdflorida.com",
};

describe("CRM table site comparison for cabinet shops", () => {
  it("shows the column for cabinet shop rows, with 'not measured' when the list has no site check", () => {
    render(<CrmTableView deals={[base, shop]} lang="en" showAffiliate onOpen={vi.fn()} onPatch={vi.fn()} />);
    expect(screen.getByText("Site vs Cabinetdealz")).toBeTruthy();
    expect(screen.getAllByTestId("crm-distributor-compare")).toHaveLength(1);
    expect(screen.getByTestId("crm-compare-theirs").textContent).toContain("Quality not measured · Mobile not measured · platform unknown · not assessed");
    expect(screen.queryByTestId("crm-compare-ahead")).toBeNull();
  });
});

describe("CRM table contact line for cabinet shops", () => {
  it("shows city and a tap-to-call phone only on cabinet shop rows", () => {
    render(
      <CrmTableView
        deals={[{ ...base, contactPhone: "(555) 000-1111", location: "Nowhere, FL" }, { ...shop, contactPhone: "(407) 774-4400", location: "Altamonte Springs, FL" }]}
        lang="en"
        showAffiliate
        onOpen={vi.fn()}
        onPatch={vi.fn()}
      />,
    );
    const lines = screen.getAllByTestId("crm-shop-contact");
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toBe("Altamonte Springs, FL · (407) 774-4400");
    expect(lines[0].querySelector("a")?.getAttribute("href")).toBe("tel:4077744400");
  });
});
