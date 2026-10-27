// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import OrderFulfillmentTrail from "./OrderFulfillmentTrail";

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
});
