// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrmCustomerLookup } from "./CrmCustomerLookup";
import type { CustomerLookupResult } from "@/lib/crmCustomerLookupProcedures";

const state: { data?: CustomerLookupResult; isFetching: boolean; error: { message: string } | null } = {
  isFetching: false,
  error: null,
};

vi.mock("@/lib/crmCustomerLookupProcedures", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crmCustomerLookupProcedures")>();
  return {
    ...actual,
    useCustomerLookup: () => ({
      useQuery: () => state,
    }),
  };
});

const design = (id: number, name: string) => ({
  id,
  name,
  thumbnailUrl: null,
  assistLabel: null,
  updatedAt: "2026-11-04T15:20:00Z",
  linkKind: "deal" as const,
  linkId: id,
  affiliateSlug: null,
});

const hit = (outcome: "none" | "one" | "several", designs: ReturnType<typeof design>[]): CustomerLookupResult => ({
  ok: true,
  identifier: "5192",
  dealId: 5192,
  customerName: "Riley Rivera",
  contactEmail: "riley@example.com",
  affiliateId: 7,
  designs,
  outcome,
  openUrl: null,
});

function typeAndSubmit(value: string) {
  fireEvent.change(screen.getByLabelText("Customer number"), { target: { value } });
  fireEvent.click(screen.getByTestId("crm-customer-lookup-submit"));
}

afterEach(cleanup);
beforeEach(() => {
  state.data = undefined;
  state.isFetching = false;
  state.error = null;
});

describe("CrmCustomerLookup", () => {
  it("opens the design immediately when the customer has exactly one", async () => {
    state.data = hit("one", [design(4401, "Rivera kitchen — final")]);
    const onOpen = vi.fn();
    render(<CrmCustomerLookup onOpen={onOpen} />);
    typeAndSubmit("5192");
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    expect(onOpen).toHaveBeenCalledWith("/design?load=4401&crmDeal=5192");
  });

  it("shows only that customer's designs to pick from when there are several", async () => {
    state.data = hit("several", [design(4401, "Rivera kitchen"), design(4402, "Rivera pantry")]);
    const onOpen = vi.fn();
    render(<CrmCustomerLookup onOpen={onOpen} />);
    typeAndSubmit("5192");
    const list = await screen.findByTestId("crm-customer-lookup-designs");
    expect(list.getAttribute("data-linked-design-count")).toBe("2");
    expect(screen.getByText("Rivera kitchen")).toBeTruthy();
    expect(screen.getByText("Rivera pantry")).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
    // One design out of the two, not "open whatever is first".
    fireEvent.click(screen.getByTestId("crm-customer-lookup-open-4402"));
    expect(onOpen).toHaveBeenCalledWith("/design?load=4402&crmDeal=5192");
  });

  it("says so when the customer has no linked design", async () => {
    state.data = hit("none", []);
    const onOpen = vi.fn();
    render(<CrmCustomerLookup onOpen={onOpen} />);
    typeAndSubmit("5192");
    expect(await screen.findByTestId("crm-customer-lookup-empty")).toBeTruthy();
    expect(screen.getByText("That customer has no design linked yet.")).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("says the number is not in scope instead of showing a design", async () => {
    state.data = { ok: false, reason: "not-found", identifier: "5192", dealId: 5192 };
    render(<CrmCustomerLookup onOpen={vi.fn()} />);
    typeAndSubmit("5192");
    expect(await screen.findByTestId("crm-customer-lookup-miss")).toBeTruthy();
    expect(screen.getByText(/No customer with that number is in your CRM scope/)).toBeTruthy();
  });

  it("refuses free text without asking the server, so it cannot browse designs", () => {
    state.data = hit("one", [design(4401, "Rivera kitchen")]);
    render(<CrmCustomerLookup onOpen={vi.fn()} />);
    typeAndSubmit("rivera");
    expect(screen.getByTestId("crm-customer-lookup-invalid")).toBeTruthy();
    expect(screen.queryByTestId("crm-customer-lookup-designs")).toBeNull();
  });

  it("accepts a customer number with a # or label", async () => {
    state.data = hit("one", [design(4401, "Rivera kitchen")]);
    const onOpen = vi.fn();
    render(<CrmCustomerLookup onOpen={onOpen} />);
    typeAndSubmit("customer #5192");
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
  });

  it("keeps the typed number visible so staff can read it back", async () => {
    state.data = hit("several", [design(4401, "Rivera kitchen"), design(4402, "Rivera pantry")]);
    render(<CrmCustomerLookup onOpen={vi.fn()} />);
    typeAndSubmit("5192");
    expect(await screen.findByText(/Riley Rivera/)).toBeTruthy();
    expect((screen.getByLabelText("Customer number") as HTMLInputElement).value).toBe("5192");
  });

  it("clears back to the prompt", async () => {
    state.data = hit("none", []);
    render(<CrmCustomerLookup onOpen={vi.fn()} />);
    typeAndSubmit("5192");
    await screen.findByTestId("crm-customer-lookup-empty");
    fireEvent.click(screen.getByLabelText("Clear lookup"));
    expect(screen.queryByTestId("crm-customer-lookup-empty")).toBeNull();
    expect(screen.getByText(/Type the customer number/)).toBeTruthy();
  });

  it("does not open twice when the same answer arrives again", async () => {
    state.data = hit("one", [design(4401, "Rivera kitchen — final")]);
    const onOpen = vi.fn();
    const { rerender } = render(<CrmCustomerLookup onOpen={onOpen} />);
    typeAndSubmit("5192");
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    rerender(<CrmCustomerLookup onOpen={onOpen} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("works with no open handler, navigating the current tab", async () => {
    state.data = hit("one", [design(4401, "Rivera kitchen")]);
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { value: { assign }, writable: true, configurable: true });
    render(<CrmCustomerLookup />);
    typeAndSubmit("5192");
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/design?load=4401&crmDeal=5192"));
    Object.defineProperty(window, "location", { value: original, writable: true, configurable: true });
  });
});
