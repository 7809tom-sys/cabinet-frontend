// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrmTableView, type TableDeal } from "./CrmTableView";

afterEach(cleanup);

// The table is where staff read the customer number off before typing it into
// the quick lookup, so it must be visible and be the identifier the lookup takes.
vi.mock("@/lib/trpc", () => ({ trpc: { crm: {} } }));

const deal: TableDeal = {
  id: 5192,
  title: "Rivera kitchen remodel",
  stage: "new",
  priority: "medium",
  contactName: "Riley Rivera",
  contactEmail: "riley@example.com",
  company: null,
  estimatedValue: "18400",
  nextFollowUpAt: null,
  affiliateId: 7,
  updatedAt: "2026-11-04T12:00:00Z",
};

describe("CRM table customer number", () => {
  it("shows the customer number the quick lookup accepts", () => {
    render(<CrmTableView deals={[deal]} lang="en" showAffiliate onOpen={vi.fn()} onPatch={vi.fn()} />);
    expect(screen.getByTestId("crm-customer-number").textContent).toBe("Customer #5192");
  });
});
