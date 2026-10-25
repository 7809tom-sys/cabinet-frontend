import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("customer hosted checkout flow", () => {
  it("labels Cart as a secure checkout transition instead of a request-only finish", () => {
    const cart = source("client/src/pages/Cart.tsx");
    expect(cart).toContain("Continue to secure checkout");
    expect(cart).toContain("Review delivery and the final Stripe payment total");
  });

  it("uses the hosted Stripe handoff after a submitted Order Review", () => {
    const review = source("client/src/components/order/OrderReview.tsx");
    expect(review).toContain('import PayWithStripe from "@/components/order/PayWithStripe"');
    expect(review).toContain("Order ready for secure checkout");
    expect(review).toContain("Sign in to continue to secure checkout.");
    expect(review).not.toContain("<PayWithCard");
  });

  it("shows an explicit secure payment action and opens Stripe in a new tab", () => {
    const handoff = source("client/src/components/order/PayWithStripe.tsx");
    expect(handoff).toContain("trpc.orders.createStripeCheckout.useMutation");
    expect(handoff).toContain('window.open(url, "_blank", "noopener,noreferrer")');
    expect(handoff).toContain("Proceed to secure payment");
    expect(handoff).toContain("server-calculated merchandise, verified shipping, and sales tax");
    expect(handoff).toContain("Affiliate-only cost fees are never added to a customer checkout");
  });

  it("provides payment-confirmed and cancelled return pages", () => {
    const app = source("client/src/App.tsx");
    expect(app).toContain('path="/store/:slug/order"');
    expect(app).toContain('path="/store/:slug/order/new"');
    expect(app).toContain('path="/checkout/success"');
    expect(app).toContain('path="/checkout/cancelled"');
    expect(app).toContain('path="/store/:slug/checkout/success"');
    expect(app).toContain('path="/store/:slug/checkout/cancelled"');
    expect(source("client/src/pages/CheckoutSuccess.tsx")).toContain("Confirming your Stripe payment");
    expect(source("client/src/pages/CheckoutCancelled.tsx")).toContain("Checkout cancelled");
  });
});
