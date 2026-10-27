// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mutate, mutationOptions } = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutationOptions: {
    current: null as null | {
      onSuccess?: (result: { id: number }) => void;
      onError?: (error: { message: string }) => void;
    },
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    vendorReferrals: {
      submit: {
        useMutation: (options: typeof mutationOptions.current) => {
          mutationOptions.current = options ?? null;
          return { mutate, isPending: false };
        },
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReferVendorForm } from "./ReferVendorForm";

afterEach(() => {
  cleanup();
  mutate.mockReset();
  mutationOptions.current = null;
});

function typeIn(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("ReferVendorForm", () => {
  it("sits on the affiliate overview and calls vendorReferrals.submit", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/AffiliateDashboard.tsx"), "utf8");
    const overview = dashboard.slice(dashboard.indexOf('case "overview"'), dashboard.indexOf('case "crm"'));
    expect(overview).toContain("{!isAdmin && <ReferVendorForm />}");
    expect(overview.indexOf("Your links")).toBeLessThan(overview.indexOf("<ReferVendorForm />"));
    const form = readFileSync(resolve(process.cwd(), "client/src/components/affiliate/ReferVendorForm.tsx"), "utf8");
    expect(form).toContain("vendorReferrals.submit");
  });

  it("requires a vendor name and an email or phone before submitting", () => {
    render(<ReferVendorForm />);
    expect(screen.getByRole("heading", { name: "Please refer vendors to us." })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter the vendor name.");
    expect(mutate).not.toHaveBeenCalled();

    typeIn(/vendor name/i, "Northwind Cabinets");
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter an email or a phone number.");
    expect(mutate).not.toHaveBeenCalled();

    typeIn("Email", "not-an-email");
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter a valid email address.");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("submits the referral, then clears the form and shows success", () => {
    render(<ReferVendorForm />);
    typeIn(/vendor name/i, " Northwind Cabinets ");
    typeIn("Contact name", "Ada Lopez");
    typeIn("Email", "ada@northwind.example");
    typeIn("Notes", "Met them at a showroom.");
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));

    expect(mutate).toHaveBeenCalledWith({
      vendorName: "Northwind Cabinets",
      contactName: "Ada Lopez",
      email: "ada@northwind.example",
      notes: "Met them at a showroom.",
    });

    act(() => {
      mutationOptions.current?.onSuccess?.({ id: 41 });
    });
    expect(screen.getByRole("status").textContent).toBe("Thanks. We received this vendor referral.");
    expect((screen.getByLabelText(/vendor name/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Contact name") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe("");
  });

  it("shows the mutation error and keeps the entered referral", () => {
    render(<ReferVendorForm />);
    typeIn(/vendor name/i, "Northwind Cabinets");
    typeIn("Phone", "555-0100");
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    expect(mutate).toHaveBeenCalledWith({ vendorName: "Northwind Cabinets", phone: "555-0100" });

    act(() => {
      mutationOptions.current?.onError?.({ message: "Affiliate sign-in required." });
    });
    expect(screen.getByRole("alert").textContent).toBe("Affiliate sign-in required.");
    expect((screen.getByLabelText(/vendor name/i) as HTMLInputElement).value).toBe("Northwind Cabinets");
    expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe("555-0100");
  });
});
