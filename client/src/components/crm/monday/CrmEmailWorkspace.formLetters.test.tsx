// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CrmSenderProfile } from "@shared/crmFormLetters";

vi.mock("@/lib/trpc", () => ({ trpc: {} }));

import { CrmEmailWorkspaceView, type EmailContact } from "./CrmEmailWorkspace";

const contacts: EmailContact[] = [
  { id: 2, title: "Osprey bath quote", contactName: "Ana Ruiz", contactEmail: "ana@example.com", stage: "quoted", estimatedValue: "9200" },
];

const storeProfile: CrmSenderProfile = {
  role: "affiliate",
  companyName: "Reaves Way Cabinet Shop",
  location: "1200 Main St, Sarasota, FL",
  phone: "941-555-0100",
  email: "hello@reavesway.test",
};

type SendInput = { dealId: number; to: string; subject: string; body: string; html: string; draftId?: number };

function renderWorkspace(overrides: Partial<Parameters<typeof CrmEmailWorkspaceView>[0]> = {}) {
  const onSend = vi.fn(async (_input: SendInput) => undefined);
  render(
    <CrmEmailWorkspaceView
      audience="affiliate"
      contacts={contacts}
      mailbox={[]}
      templates={[]}
      settings={null}
      connections={[]}
      prefill={{ dealId: 2, to: "ana@example.com", contactName: "Ana Ruiz", dealTitle: "Osprey bath quote" }}
      senderRole="affiliate"
      senderProfile={storeProfile}
      onSend={onSend}
      onSaveDraft={async () => undefined}
      onDeleteDraft={async () => undefined}
      onSaveSetup={async () => undefined}
      onTestSetup={async () => undefined}
      onSaveTemplate={async () => undefined}
      onDeleteTemplate={async () => undefined}
      {...overrides}
    />,
  );
  return { onSend };
}

function subjectInput() {
  return screen.getByLabelText("Subject") as HTMLInputElement;
}

function bodyBox() {
  return screen.getByLabelText("Email body") as HTMLDivElement;
}

function picker() {
  return screen.getByRole("button", { name: "Insert a form letter" });
}

afterEach(() => cleanup());

describe("CRM one-click form letters", () => {
  it("keeps the picker collapsed until asked, then lists the eight starter letters", () => {
    renderWorkspace();
    expect(screen.queryByRole("group", { name: "Form letters" })).toBeNull();
    fireEvent.click(picker());
    const group = screen.getByRole("group", { name: "Form letters" });
    expect(group.querySelectorAll("button")).toHaveLength(8);
    expect(screen.getByTestId("crm-form-letter-quote_ready").textContent).toBe("Quote is ready");
    expect(screen.getByTestId("crm-form-letter-order_shipped").textContent).toBe("Your order has shipped (tracking)");
    expect(screen.getByTestId("crm-form-letter-post_delivery_check_in").textContent).toBe("Checking in after delivery / review request");
  });

  it("fills the subject and body from the deal and the signed-in store, without sending", () => {
    const { onSend } = renderWorkspace();
    fireEvent.click(picker());
    fireEvent.click(screen.getByTestId("crm-form-letter-quote_ready"));

    expect(subjectInput().value).toBe("Your quote is ready — Osprey bath quote");
    expect(bodyBox().innerHTML).toContain("Hi Ana Ruiz,");
    expect(bodyBox().innerHTML).toContain("Reaves Way Cabinet Shop");
    expect(bodyBox().innerHTML).toContain("941-555-0100");
    expect(bodyBox().innerHTML).not.toContain("{{");
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("does not ask before replacing the greeting that was already in the box", () => {
    renderWorkspace();
    expect(bodyBox().textContent).toContain("Hi Ana Ruiz,");
    fireEvent.click(picker());
    fireEvent.click(screen.getByTestId("crm-form-letter-order_received"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(subjectInput().value).toContain("[order number]");
  });

  it("confirms before overwriting text the user typed, and keeps it when declined", () => {
    renderWorkspace();
    fireEvent.change(subjectInput(), { target: { value: "My own subject" } });
    fireEvent.click(picker());
    expect(screen.getByRole("button", { name: "Hide form letters" })).toBeTruthy();
    fireEvent.click(screen.getByTestId("crm-form-letter-quote_ready"));

    const prompt = screen.getByRole("alertdialog", { name: "Replace the current email" });
    expect(prompt.textContent).toContain("Quote is ready");
    expect(prompt.textContent).toContain("Nothing is sent until you press Send.");

    fireEvent.click(screen.getByRole("button", { name: "Keep my text" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(subjectInput().value).toBe("My own subject");
  });

  it("replaces the text once the overwrite is confirmed, still without sending", () => {
    const { onSend } = renderWorkspace();
    fireEvent.change(subjectInput(), { target: { value: "My own subject" } });
    fireEvent.click(picker());
    fireEvent.click(screen.getByTestId("crm-form-letter-quote_follow_up"));
    fireEvent.click(screen.getByRole("button", { name: "Replace text" }));

    expect(subjectInput().value).toBe("Following up on your quote — Osprey bath quote");
    expect(bodyBox().innerHTML).toContain("Checking in from Reaves Way Cabinet Shop");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("still sends only from the Send button, with the edited letter text", async () => {
    const { onSend } = renderWorkspace();
    fireEvent.click(picker());
    fireEvent.click(screen.getByTestId("crm-form-letter-quote_ready"));
    fireEvent.change(subjectInput(), { target: { value: "Edited subject" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0][0]).toMatchObject({ dealId: 2, subject: "Edited subject", to: "ana@example.com" });
  });

  it("uses the contractor letter set and leaves unknown contractor details as brackets", () => {
    renderWorkspace({
      audience: "admin",
      senderRole: "contractor",
      senderProfile: { role: "contractor", companyName: "Hale Builds", location: null, phone: "941-555-0177", email: null },
    });
    expect(screen.getByText(/Form letters · your business/)).toBeTruthy();
    fireEvent.click(picker());
    fireEvent.click(screen.getByTestId("crm-form-letter-need_measurements"));
    expect(bodyBox().innerHTML).toContain("[business location]");
    expect(bodyBox().innerHTML).toContain("[business email]");
    expect(bodyBox().innerHTML).toContain("I need a few numbers from the room");
  });

  it("labels the house letter set for an admin", () => {
    renderWorkspace({
      audience: "admin",
      senderRole: "admin",
      senderProfile: { role: "admin", companyName: "Cabinet Dealz", location: null, phone: null, email: null },
    });
    expect(screen.getByText(/Form letters · Cabinet Dealz/)).toBeTruthy();
    expect(screen.getByText(/\[Brackets\] are details only you know/)).toBeTruthy();
  });
});
