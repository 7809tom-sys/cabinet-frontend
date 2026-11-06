// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerLinkedDesigns } from "./CustomerLinkedDesigns";
import { NO_LINKED_DESIGN_COPY, CUSTOMER_DESIGN_LINK_NOTE, CUSTOMER_DESIGNS_UNAVAILABLE_COPY } from "@shared/crmCustomerDesigns";

afterEach(cleanup);

describe("CustomerLinkedDesigns", () => {
  it("shows only the designs the server proved linked to this customer", () => {
    render(
      <CustomerLinkedDesigns
        designs={[
          { id: 4401, name: "Rivera kitchen", linkKind: "deal", href: "/design?load=4401" },
          { id: 5501, name: "Rivera bath", linkKind: "customerFolder", href: "/design?load=5501" },
        ]}
      />,
    );
    expect(screen.getAllByTestId("customer-linked-design")).toHaveLength(2);
    expect(screen.getByText("Rivera kitchen")).toBeTruthy();
    expect(screen.getByText("Rivera bath")).toBeTruthy();
    expect(screen.queryByTestId("customer-design-empty")).toBeNull();
  });

  it("says no design is linked and offers a link action", () => {
    render(
      <CustomerLinkedDesigns
        designs={[]}
        attach={{ label: "Link a saved design", href: "https://example.test/crm" }}
      />,
    );
    expect(screen.getByTestId("customer-design-empty")).toBeTruthy();
    expect(screen.getByText(NO_LINKED_DESIGN_COPY)).toBeTruthy();
    const attach = screen.getByTestId("customer-design-attach") as HTMLAnchorElement;
    expect(attach.getAttribute("href")).toBe("https://example.test/crm");
    expect(attach.textContent).toBe("Link a saved design");
  });

  it("links a picked saved design by id", () => {
    const onSelect = vi.fn();
    render(
      <CustomerLinkedDesigns
        designs={[]}
        attach={{
          label: "Link a saved design",
          options: [{ id: 4402, name: "Rivera kitchen — option B", storeName: "Maple Kitchens" }],
          onSelect,
        }}
      />,
    );
    const picker = screen.getByTestId("customer-design-picker-select") as HTMLSelectElement;
    expect(picker.textContent).toContain("Rivera kitchen — option B · Maple Kitchens");
    fireEvent.change(picker, { target: { value: "4402" } });
    fireEvent.click(screen.getByTestId("customer-design-attach"));
    expect(onSelect).toHaveBeenCalledWith(4402);
  });

  it("keeps the link action reachable when one design is already linked", () => {
    render(
      <CustomerLinkedDesigns
        designs={[{ id: 4401, name: "Rivera kitchen", linkKind: "deal" }]}
        attach={{ label: "Link", options: [{ id: 4402, name: "Option B" }], onSelect: vi.fn() }}
      />,
    );
    expect(screen.getByTestId("customer-design-picker")).toBeTruthy();
  });

  it("disables the picker when no saved design is left to link", () => {
    render(
      <CustomerLinkedDesigns
        designs={[{ id: 4401, name: "Rivera kitchen", linkKind: "deal" }]}
        attach={{ label: "Link", options: [], onSelect: vi.fn(), emptyCopy: "No saved designs available" }}
      />,
    );
    const picker = screen.getByTestId("customer-design-picker-select") as HTMLSelectElement;
    expect(picker.disabled).toBe(true);
    expect(picker.textContent).toContain("No saved designs available");
  });

  it("never renders a list count for a customer with no link", () => {
    render(<CustomerLinkedDesigns designs={[]} />);
    expect(screen.getByTestId("customer-linked-designs").getAttribute("data-linked-design-count")).toBe("0");
    expect(screen.queryAllByTestId("customer-linked-design")).toHaveLength(0);
  });

  it("shows where each design's link is stored when asked", () => {
    render(<CustomerLinkedDesigns designs={[{ id: 4401, name: "Rivera kitchen", linkKind: "deal" }]} showLinkSource />);
    expect(screen.getByTestId("customer-design-link-source").textContent).toBe("Linked to this deal");
  });

  it("hides the source note when the drawer does not ask for it", () => {
    render(<CustomerLinkedDesigns designs={[{ id: 4401, name: "Rivera kitchen", linkKind: "deal" }]} />);
    expect(screen.queryByTestId("customer-design-link-source")).toBeNull();
  });

  it("explains an empty list that means the filter is not deployed yet", () => {
    render(<CustomerLinkedDesigns designs={[]} error={CUSTOMER_DESIGNS_UNAVAILABLE_COPY} />);
    expect(screen.getByText(CUSTOMER_DESIGNS_UNAVAILABLE_COPY)).toBeTruthy();
    expect(screen.queryByText(NO_LINKED_DESIGN_COPY)).toBeNull();
  });

  it("does not show a zero count as loading once the query settled", () => {
    render(<CustomerLinkedDesigns designs={[]} loading />);
    expect(screen.getByText("Loading designs…")).toBeTruthy();
    expect(screen.queryByText(NO_LINKED_DESIGN_COPY)).toBeNull();
  });

  it("renders extra per-design actions without an Open link when none is known", () => {
    const onPackage = vi.fn();
    render(
      <CustomerLinkedDesigns
        designs={[{ id: 4401, name: "Rivera kitchen", linkKind: "deal" }]}
        actions={(design) => <button type="button" onClick={() => onPackage(design.id)}>Save as Kitchen Package</button>}
      />,
    );
    expect(screen.queryByText("Open in Designer")).toBeNull();
    fireEvent.click(screen.getByText("Save as Kitchen Package"));
    expect(onPackage).toHaveBeenCalledWith(4401);
  });

  it("keeps the link note visible alongside a linked design", () => {
    render(<CustomerLinkedDesigns designs={[{ id: 4401, name: "Rivera kitchen", linkKind: "deal" }]} />);
    expect(screen.getByTestId("customer-design-link-note").textContent).toBe(CUSTOMER_DESIGN_LINK_NOTE);
  });
});
