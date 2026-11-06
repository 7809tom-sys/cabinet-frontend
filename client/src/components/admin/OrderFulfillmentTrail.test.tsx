// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrderFulfillmentTrail, { ORDER_TRAIL_ACTION_KEYS } from "./OrderFulfillmentTrail";

afterEach(cleanup);

describe("order fulfillment trail", () => {
  it("shows Email sent with the time and address, then the later steps as waiting", () => {
    render(<OrderFulfillmentTrail order={{
      distributorEmailStatus: "sent",
      distributorEmailSentAt: "2026-10-27T15:04:00.000Z",
      distributorEmailTo: "orders@mill.com",
      imageGeneratedCount: 2,
      lastImageGeneratedAt: "2026-10-27T17:00:00.000Z",
      crmSyncStatus: "new_sale",
    }} />);
    const email = screen.getByTestId("order-step-email_sent");
    expect(email.getAttribute("data-done")).toBe("true");
    expect(email.textContent).toContain("Email sent");
    expect(email.textContent).toContain("orders@mill.com");
    expect(screen.getByTestId("order-step-verified").getAttribute("data-done")).toBe("false");
    expect(screen.getByTestId("distributor-email-sent").textContent).toContain("orders@mill.com");
    expect(screen.getByTestId("order-image-generated").textContent).toContain("Image generated · 2");
    expect(screen.getByTestId("crm-sync-new-sale").textContent).toContain("New Sale");
  });

  it("warns when the distributor has no order email and shows a failure", () => {
    render(<OrderFulfillmentTrail order={{ distributorEmailStatus: "failed", distributorEmailError: "timeout" }} />);
    expect(screen.getByTestId("distributor-email-failed").textContent).toContain("timeout");
    render(<OrderFulfillmentTrail order={{ distributorEmailStatus: "no_email" }} />);
    expect(screen.getByTestId("distributor-email-missing").textContent).toContain("No order email set");
  });

  it("only makes verified, shipped and signed actionable", () => {
    expect(ORDER_TRAIL_ACTION_KEYS).toEqual(["verified", "shipped", "signed"]);
  });

  it("renders plain steps when no actions are supplied", () => {
    render(<OrderFulfillmentTrail order={{ distributorEmailStatus: "sent" }} />);
    expect(screen.queryByTestId("order-step-action-verified")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("turns each of verified, shipped and signed into a button that runs its action", () => {
    const run = { verified: vi.fn(), shipped: vi.fn(), signed: vi.fn() };
    render(<OrderFulfillmentTrail
      order={{ orderVerifiedAt: "2026-10-28T12:00:00.000Z", orderShippedAt: "2026-11-02T15:00:00.000Z" }}
      actions={{ verified: { run: run.verified }, shipped: { run: run.shipped }, signed: { run: run.signed } }}
    />);
    for (const key of ["verified", "shipped", "signed"] as const) {
      const button = screen.getByTestId(`order-step-action-${key}`);
      expect(button.getAttribute("aria-label")).toContain("Mark Order");
      fireEvent.click(button);
    }
    expect(run.verified).toHaveBeenCalledOnce();
    expect(run.shipped).toHaveBeenCalledOnce();
    expect(run.signed).toHaveBeenCalledOnce();
  });

  it("does not run a locked step and shows why", () => {
    const run = vi.fn();
    render(<OrderFulfillmentTrail
      order={{}}
      actions={{ signed: { run, disabled: true, hint: "Mark the order shipped first." } }}
    />);
    const button = screen.getByTestId("order-step-action-signed") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByTestId("order-step-signed").textContent).toContain("Mark the order shipped first.");
  });

  it("shows a spinner and stays disabled while the step is saving", () => {
    render(<OrderFulfillmentTrail order={{}} actions={{ verified: { run: vi.fn(), pending: true } }} />);
    const button = screen.getByTestId("order-step-action-verified") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
