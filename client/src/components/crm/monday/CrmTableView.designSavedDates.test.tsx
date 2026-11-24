// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrmTableView, type TableDeal } from "./CrmTableView";

afterEach(cleanup);
vi.mock("@/lib/trpc", () => ({ trpc: { crm: {} } }));

const base: TableDeal = {
  id: 7001,
  title: "Kitchen",
  stage: "new",
  priority: "medium",
  contactName: "Dana Doe",
  contactEmail: "dana@example.com",
  company: null,
  estimatedValue: null,
  nextFollowUpAt: null,
  updatedAt: "2026-11-04T12:00:00Z",
};

describe("CRM table design-saved dates", () => {
  it("shows the automatic first and last design-saved dates, read-only", () => {
    const first = "2026-11-10T15:00:00Z";
    const last = "2026-11-20T15:00:00Z";
    render(<CrmTableView deals={[{ ...base, firstDesignSavedAt: first, lastDesignSavedAt: last }]} lang="en" showAffiliate={false} onOpen={vi.fn()} onPatch={vi.fn()} />);
    expect(screen.getByText("First design saved")).toBeTruthy();
    expect(screen.getByText("Last design saved")).toBeTruthy();
    const firstCell = screen.getByTestId("crm-first-design-saved");
    const lastCell = screen.getByTestId("crm-last-design-saved");
    expect(firstCell.textContent).toBe(new Date(first).toLocaleDateString("en-US"));
    expect(lastCell.textContent).toBe(new Date(last).toLocaleDateString("en-US"));
    // Not editable: no input, select or button inside the date cells.
    expect(firstCell.querySelector("input,select,button")).toBeNull();
    expect(lastCell.querySelector("input,select,button")).toBeNull();
  });

  it("shows a dash before any design is saved (or before SQL 0284 runs)", () => {
    render(<CrmTableView deals={[base]} lang="en" showAffiliate={false} onOpen={vi.fn()} onPatch={vi.fn()} />);
    expect(screen.getByTestId("crm-first-design-saved").textContent).toBe("—");
    expect(screen.getByTestId("crm-last-design-saved").textContent).toBe("—");
  });

  it("the empty-table row spans the two new columns", () => {
    const { container } = render(<CrmTableView deals={[]} lang="en" showAffiliate onOpen={vi.fn()} onPatch={vi.fn()} />);
    expect(container.querySelector("td")?.getAttribute("colspan")).toBe("10");
    expect(container.querySelectorAll("th").length).toBe(10);
  });
});
