// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AffiliateEmailSettingsView } from "@shared/affiliateEmailSettings";

const { mutate, testMutate, updateOptions, testOptions, updatePending, testPending, settings, queryError, invalidate } = vi.hoisted(() => ({
  mutate: vi.fn(),
  testMutate: vi.fn(),
  updateOptions: {
    current: null as null | {
      onSuccess?: (result: AffiliateEmailSettingsView, input: Record<string, unknown>) => void;
      onError?: (error: { message: string }) => void;
    },
  },
  testOptions: {
    current: null as null | {
      onMutate?: () => void;
      onSettled?: () => void;
      onSuccess?: (result: { ok: boolean; to: string; error: string | null }) => void;
      onError?: (error: { message: string }) => void;
    },
  },
  updatePending: { current: false },
  testPending: { current: false },
  settings: { current: { data: undefined as AffiliateEmailSettingsView | undefined, isLoading: false, error: null as { message: string } | null } },
  queryError: { current: null as { message: string } | null },
  invalidate: vi.fn(async () => undefined),
}));

vi.mock("@/lib/trpc", () => ({ trpc: {} }));

vi.mock("@/lib/affiliateEmailSettingsProcedures", () => ({
  useAffiliateEmailSettingsProcedures: () => ({
    useUtils: () => ({ affiliateEmailSettings: { get: { invalidate } } }),
    affiliateEmailSettings: {
      get: { useQuery: () => settings.current },
      update: {
        useMutation: (options: typeof updateOptions.current) => {
          updateOptions.current = options ?? null;
          return { mutate, isPending: updatePending.current };
        },
      },
      sendTest: {
        useMutation: (options: typeof testOptions.current) => {
          testOptions.current = options ?? null;
          return { mutate: testMutate, isPending: testPending.current };
        },
      },
    },
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), message: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { AffiliateEmailSettingsPanel } from "./AffiliateEmailSettingsPanel";

const savedView: AffiliateEmailSettingsView = {
  affiliateId: 7,
  email: "rich@reaveswaycabinets.com",
  provider: "yahoo",
  smtpHost: "smtp.mail.yahoo.com",
  smtpPort: 465,
  secure: true,
  username: "rich@reaveswaycabinets.com",
  enabled: true,
  hasAppPassword: true,
  configured: true,
  canEdit: true,
  lastTestedAt: "2026-11-01T12:00:00.000Z",
  lastTestOk: true,
};

afterEach(() => {
  cleanup();
  mutate.mockReset();
  testMutate.mockReset();
  invalidate.mockReset();
  updateOptions.current = null;
  testOptions.current = null;
  updatePending.current = false;
  testPending.current = false;
  settings.current = { data: undefined, isLoading: false, error: null };
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

function configure(view: AffiliateEmailSettingsView | undefined, props: Partial<Parameters<typeof AffiliateEmailSettingsPanel>[0]> = {}) {
  settings.current = { data: view, isLoading: false, error: null };
  return render(<AffiliateEmailSettingsPanel affiliateId={7} canEdit storeName="Reaves Way Cabinet Shop" {...props} />);
}

describe("affiliate Email settings area", () => {
  it("collects the customer email, provider preset, username, and a write-only app password", () => {
    configure(savedView);
    expect(screen.getByRole("heading", { name: "Email" })).toBeTruthy();
    expect((screen.getByLabelText("Your email address") as HTMLInputElement).value).toBe("rich@reaveswaycabinets.com");
    expect((screen.getByLabelText("Username") as HTMLInputElement).value).toBe("rich@reaveswaycabinets.com");
    const host = screen.getByLabelText("Mail server") as HTMLInputElement;
    expect(host.value).toBe("smtp.mail.yahoo.com");
    expect(host.readOnly).toBe(true);
    expect((screen.getByLabelText("Port") as HTMLInputElement).value).toBe("465");

    const password = screen.getByLabelText("Yahoo app password") as HTMLInputElement;
    expect(password.type).toBe("password");
    expect(password.value).toBe("");
    expect(password.autocomplete).toBe("new-password");
  });

  it("shows 'Configured' from the saved flag and never renders the saved password", () => {
    configure(savedView);
    expect(screen.getAllByText("Configured").length).toBeGreaterThan(0);
    expect(screen.getByText("Sending is on")).toBeTruthy();
    expect(screen.getByText(/A password is already saved. We never show it again/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("ciphertext");
  });

  it("explains the Yahoo app password with the exact menu path", () => {
    configure(savedView);
    expect(screen.getByText("Yahoo needs an app password.")).toBeTruthy();
    expect(screen.getByText(/Account Info, then Account Security, then Generate app password/)).toBeTruthy();
  });

  it("swaps the app-password hint to the provider that is selected", () => {
    configure({ ...savedView, provider: "gmail", smtpHost: "smtp.gmail.com", username: "rich@reaveswaycabinets.com" });
    expect(screen.getByText("Gmail needs an app password.")).toBeTruthy();
    expect(screen.getByText(/2-Step Verification, then open App passwords/)).toBeTruthy();
    expect(screen.queryByText("Yahoo needs an app password.")).toBeNull();
    expect(screen.getByLabelText("Google app password")).toBeTruthy();
  });

  it("shows the read-only invoice copy note", () => {
    configure(savedView);
    const note = screen.getByTestId("affiliate-invoice-copy-note");
    expect(note.textContent).toContain("Copy to CabinetDealz");
    expect(note.textContent).toContain("CabinetDealz gets a copy of every invoice you send to a customer");
    expect(note.textContent).toContain("cannot be turned off");
    expect(note.querySelector("input, textarea, [role=switch]")).toBeNull();
  });
  it("saves the entered address and a new app password", () => {
    configure(savedView);
    fireEvent.change(screen.getByLabelText("Your email address"), { target: { value: "hello@reaveswaycabinets.com" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "hello@reaveswaycabinets.com" } });
    fireEvent.change(screen.getByLabelText("Yahoo app password"), { target: { value: "abcd wxyz abcd wxyz" } });
    fireEvent.click(screen.getByRole("button", { name: /Save email settings/ }));
    expect(mutate).toHaveBeenCalledWith({
      affiliateId: 7,
      email: "hello@reaveswaycabinets.com",
      provider: "yahoo",
      smtpHost: "smtp.mail.yahoo.com",
      smtpPort: 465,
      secure: true,
      username: "hello@reaveswaycabinets.com",
      enabled: true,
      appPassword: "abcdwxyzabcdwxyz",
    });
  });

  it("keeps the saved password when the field is left blank", () => {
    configure(savedView);
    fireEvent.change(screen.getByLabelText("Your email address"), { target: { value: "hello@reaveswaycabinets.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Save email settings/ }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).not.toHaveProperty("appPassword");
  });

  it("requires a new app password after the provider changes", () => {
    configure(savedView);
    fireEvent.click(screen.getByLabelText("Email provider"));
    const gmail = screen.getByRole("option", { name: "Gmail" });
    fireEvent.click(gmail);
    expect(screen.getByText(/You changed the provider, so paste the app password/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Save email settings/ }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Enter the app password from your email provider.")).toBeTruthy();
    expect(screen.queryByText("Configured")).toBeNull();
  });

  it("saves a test email button state that matches the saved settings", () => {
    configure(savedView);
    const button = screen.getByRole("button", { name: /Send test email/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it("blocks the save with a plain error when the address is incomplete", () => {
    configure({ ...savedView, hasAppPassword: false, configured: false, lastTestedAt: null });
    fireEvent.change(screen.getByLabelText("Your email address"), { target: { value: "rich@" } });
    fireEvent.click(screen.getByRole("button", { name: /Save email settings/ }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a complete email address, like you@yourstore.com.")).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith("Enter a complete email address, like you@yourstore.com.");
  });

  it("sends a test email and reports success with the address it reached", () => {
    configure(savedView);
    fireEvent.click(screen.getByRole("button", { name: /Send test email/ }));
    expect(testMutate).toHaveBeenCalledWith({ affiliateId: 7 });
    act(() => {
      testOptions.current?.onSuccess?.({ ok: true, to: "rich@reaveswaycabinets.com", error: null });
    });
    expect(screen.getByRole("status").textContent).toContain("Test email sent to rich@reaveswaycabinets.com");
    expect(toast.success).toHaveBeenCalledWith("Test email sent to rich@reaveswaycabinets.com");
    // The saved "delivered" line must not compete with the fresh result.
    expect(screen.queryByText(/Previous test/)).toBeNull();
  });

  it("shows the provider's exact error when the test fails", () => {
    configure(savedView);
    fireEvent.click(screen.getByRole("button", { name: /Send test email/ }));
    act(() => {
      testOptions.current?.onSuccess?.({
        ok: false,
        to: "rich@reaveswaycabinets.com",
        error: "Invalid login: 535 5.7.8 [AUTHENTICATIONFAILED] Invalid credentials",
      });
    });
    expect(screen.getByTestId("affiliate-email-test-error").textContent)
      .toBe("Invalid login: 535 5.7.8 [AUTHENTICATIONFAILED] Invalid credentials");
    expect(toast.error).toHaveBeenCalledWith("Invalid login: 535 5.7.8 [AUTHENTICATIONFAILED] Invalid credentials");
  });

  it("shows a thrown test error verbatim", () => {
    configure(savedView);
    act(() => {
      testOptions.current?.onError?.({ message: "SMTP connection timed out after 10000ms" });
    });
    expect(screen.getByTestId("affiliate-email-test-error").textContent).toBe("SMTP connection timed out after 10000ms");
  });

  it("requires a save before a test can be sent", () => {
    configure(savedView);
    fireEvent.change(screen.getByLabelText("Your email address"), { target: { value: "hello@reaveswaycabinets.com" } });
    const button = screen.getByRole("button", { name: /Send test email/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Save your changes before sending a test email.")).toBeTruthy();
  });

  it("hides the test button until the mailbox is fully set up", () => {
    configure({ ...savedView, hasAppPassword: false, configured: false });
    const button = screen.getByRole("button", { name: /Send test email/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Fill in your email address, username, and app password, then save before testing.")).toBeTruthy();
  });

  it("shows the server message when the save is rejected", () => {
    configure(savedView);
    act(() => {
      updateOptions.current?.onError?.({ message: "Only the store owner or a CabinetDealz administrator can change these email settings." });
    });
    expect(screen.getByRole("alert").textContent)
      .toContain("Only the store owner or a CabinetDealz administrator can change these email settings.");
    expect(toast.error).toHaveBeenCalled();
  });

  it("stays read-only for a team member who is not the owner", () => {
    configure(savedView, { canEdit: false });
    expect(screen.getByTestId("affiliate-email-settings-read-only")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Save email settings/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Send test email/ })).toBeNull();
    expect(screen.queryByLabelText("Yahoo app password")).toBeNull();
    expect(screen.getByText(/Only the store owner or a CabinetDealz administrator/)).toBeTruthy();
    // No address or server leaks to a login that is not this store's owner.
    expect(document.body.textContent).not.toContain("rich@reaveswaycabinets.com");
    expect(document.body.textContent).not.toContain("smtp.mail.yahoo.com");
  });

  it("shows the access error instead of the form when the server refuses", () => {
    settings.current = {
      data: undefined,
      isLoading: false,
      error: { message: "You can only change email settings for your own store." },
    };
    render(<AffiliateEmailSettingsPanel affiliateId={7} canEdit />);
    expect(screen.getByRole("alert").textContent).toBe("You can only change email settings for your own store.");
    expect(screen.queryByLabelText("Your email address")).toBeNull();
  });

  it("asks for a store instead of guessing one", () => {
    render(<AffiliateEmailSettingsPanel canEdit />);
    expect(screen.getByText("Choose a store to edit its email settings.")).toBeTruthy();
    expect(screen.queryByLabelText("Your email address")).toBeNull();
  });
});

describe("affiliate Email setup instructions in the panel", () => {
  it("offers Yahoo, Gmail, Outlook, and Other tabs with numbered steps", () => {
    configure(savedView);
    for (const label of ["Yahoo", "Gmail", "Outlook", "Other"]) {
      expect(screen.getAllByRole("tab", { name: label }).length).toBe(1);
    }
    const yahooSteps = screen.getByTestId("affiliate-email-steps-yahoo");
    expect(yahooSteps.querySelectorAll("li").length).toBeGreaterThanOrEqual(4);
    expect(yahooSteps.textContent).toContain("Account Info");
    expect(yahooSteps.textContent).toContain("Account Security");
    expect(yahooSteps.textContent).toContain("Generate app password");
    expect(yahooSteps.textContent).toContain("Send test email");
    expect(screen.getByTestId("affiliate-email-setup-guide").textContent)
      .toContain("Account Info > Account Security > Generate app password");
    expect(screen.getByTestId("affiliate-email-setup-guide").textContent)
      .toContain("If the test email does not arrive");
  });

  it("links the source files from the dashboard so the section cannot drift out of the sidebar", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/AffiliateDashboard.tsx"), "utf8");
    const layout = readFileSync(resolve(process.cwd(), "client/src/components/affiliate/AffiliateDashboardLayout.tsx"), "utf8");
    expect(layout).toContain('{ icon: Mail, label: "Email", section: "email" }');
    expect(layout).toContain('if (item.section === "email") return canOpenEmail;');
    expect(layout).toContain("const canOpenEmail = Boolean(isAffiliateOwner || isAdmin);");
    expect(dashboard).toContain('"email",');
    expect(dashboard).toContain('case "email":');
    expect(dashboard).toContain("<AffiliateEmailSettingsPanel");
    expect(dashboard).toContain('(section === "email" && !access.isOwner)');
  });
});
