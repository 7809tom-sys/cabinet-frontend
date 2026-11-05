// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateAddresses = vi.hoisted(() => vi.fn());
const forward = vi.hoisted(() => vi.fn());
const listQuery = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ vendorEmails: { list: { invalidate: vi.fn() } } }),
    vendorEmails: {
      list: { useQuery: () => listQuery() },
      get: { useQuery: () => ({ data: null, isLoading: false, isError: false }) },
      updateAddresses: { useMutation: () => ({ mutate: updateAddresses, mutateAsync: vi.fn(), isPending: false }) },
      forward: { useMutation: () => ({ mutate: forward, mutateAsync: vi.fn(), isPending: false }) },
    },
  },
}));

import VendorSupportAdmin from "./VendorSupportAdmin";

const vendor = {
  id: 7,
  name: "US Cabinet Depot",
  addresses: [{ purpose: "claims", address: "claims@uscd.example" }],
};

afterEach(() => {
  cleanup();
  updateAddresses.mockReset();
  forward.mockReset();
  listQuery.mockReset();
});

describe("vendor support mailboxes", () => {
  it("gives each vendor the four purpose sections with editable addresses", () => {
    listQuery.mockReturnValue({ data: { vendors: [vendor], mail: [] }, isLoading: false, isError: false });
    render(<VendorSupportAdmin />);
    const section = screen.getByTestId("vendor-mailboxes-7");
    for (const purpose of ["claims", "support", "sales", "sales_communication"]) {
      expect(within(section).getByTestId(`vendor-email-section-${purpose}`)).toBeTruthy();
    }
    expect((within(section).getByTestId("vendor-email-input-claims") as HTMLInputElement).value).toBe("claims@uscd.example");
    // A purpose with no saved address still shows an empty, editable field.
    expect((within(section).getByTestId("vendor-email-input-support") as HTMLInputElement).value).toBe("");
  });

  it("saves a typed address only when it changes", () => {
    listQuery.mockReturnValue({ data: { vendors: [vendor], mail: [] }, isLoading: false, isError: false });
    render(<VendorSupportAdmin />);
    const save = screen.getByTestId("vendor-email-save-support") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("vendor-email-input-support"), { target: { value: "support@uscd.example" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(updateAddresses).toHaveBeenCalledWith({ vendorLineId: 7, purpose: "support", address: "support@uscd.example" });
  });

  it("refuses to save an address that is not an email", () => {
    listQuery.mockReturnValue({ data: { vendors: [vendor], mail: [] }, isLoading: false, isError: false });
    render(<VendorSupportAdmin />);
    fireEvent.change(screen.getByTestId("vendor-email-input-sales"), { target: { value: "not-an-email" } });
    expect((screen.getByTestId("vendor-email-save-sales") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows an empty state when no vendor is set up", () => {
    listQuery.mockReturnValue({ data: { vendors: [], mail: [] }, isLoading: false, isError: false });
    render(<VendorSupportAdmin />);
    expect(screen.getByTestId("vendor-mailboxes-empty")).toBeTruthy();
    expect(screen.getByTestId("vendor-inbox-empty")).toBeTruthy();
  });

  it("lists incoming mail by type with the assigned staff and never forwards on its own", () => {
    listQuery.mockReturnValue({
      data: {
        vendors: [vendor],
        mail: [{
          id: 91,
          vendorName: "US Cabinet Depot",
          purpose: "claims",
          subject: "Claim 4417 — cracked door",
          toAddress: "claims@cabinetdealz.com",
          assignedToName: "Dana Reed",
          receivedAt: "2026-11-03T14:00:00.000Z",
        }],
      },
      isLoading: false,
      isError: false,
    });
    render(<VendorSupportAdmin />);
    const row = screen.getByTestId("vendor-mail-91");
    expect(row.textContent).toContain("Claims");
    expect(row.textContent).toContain("Claim 4417");
    expect(row.textContent).toContain("Dana Reed");
    // Nothing is forwarded until the admin opens the panel and confirms.
    expect(forward).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByTestId("vendor-mail-forward-91"));
    expect(forward).not.toHaveBeenCalled();
    const panel = screen.getByTestId("vendor-mail-forward-panel");
    expect((within(panel).getByTestId("vendor-mail-forward-to") as HTMLInputElement).value).toBe("");
    fireEvent.click(within(panel).getByTestId("vendor-mail-forward-cancel"));
    expect(forward).not.toHaveBeenCalled();
  });

  it("forwards only after the admin supplies a recipient and presses Forward", () => {
    listQuery.mockReturnValue({
      data: {
        vendors: [vendor],
        mail: [{ id: 91, vendorName: "US Cabinet Depot", purpose: "sales", subject: "Q4 pricing", assignedToEmail: "dana@cabinetdealz.com" }],
      },
      isLoading: false,
      isError: false,
    });
    render(<VendorSupportAdmin />);
    fireEvent.click(screen.getByTestId("vendor-mail-forward-91"));
    const panel = screen.getByTestId("vendor-mail-forward-panel");
    expect((within(panel).getByTestId("vendor-mail-forward-to") as HTMLInputElement).value).toBe("dana@cabinetdealz.com");
    fireEvent.click(within(panel).getByTestId("vendor-mail-forward-send"));
    expect(forward).toHaveBeenCalledWith({ id: 91, to: "dana@cabinetdealz.com", note: undefined });
  });

  it("degrades to empty states when the backend procedures are not deployed", () => {
    listQuery.mockReturnValue({ data: null, isLoading: false, isError: true });
    render(<VendorSupportAdmin />);
    expect(screen.getByTestId("vendor-inbox-unavailable")).toBeTruthy();
    expect(screen.getByTestId("vendor-inbox-empty")).toBeTruthy();
    expect(screen.getByTestId("vendor-mailboxes-empty")).toBeTruthy();
  });
});
