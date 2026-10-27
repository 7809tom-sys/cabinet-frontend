import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createdOrderAccessToken,
  installationEstimateQueryEnabled,
  orderAccessTokenInput,
} from "./orderCheckoutAuth";

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("order access token inputs", () => {
  it("keeps a guest or owner token that createRequest returned", () => {
    expect(createdOrderAccessToken({ id: 5, accessToken: "  guest-token  " })).toBe("guest-token");
    expect(createdOrderAccessToken({ id: 5 })).toBeUndefined();
    expect(createdOrderAccessToken({ accessToken: "   " })).toBeUndefined();
    expect(createdOrderAccessToken({ accessToken: "x".repeat(257) })).toBeUndefined();
  });

  it("omits a missing token so the signed-in owner still matches a null column", () => {
    expect(orderAccessTokenInput(null)).toEqual({});
    expect(orderAccessTokenInput(undefined)).toEqual({});
    expect(orderAccessTokenInput(" token-1 ")).toEqual({ accessToken: "token-1" });
  });

  it("does not load the installation estimate for a guest token alone", () => {
    expect(installationEstimateQueryEnabled({
      submittedId: 5,
      emailValid: true,
      isAuthenticated: false,
    })).toBe(false);
    expect(installationEstimateQueryEnabled({
      submittedId: 5,
      emailValid: true,
      isAuthenticated: true,
    })).toBe(true);
  });
});

describe("customer checkout calls against locked confirm and charge", () => {
  it("requires a signed-in owner and forwards the order access token to the estimate", () => {
    const review = source("client/src/components/order/OrderReview.tsx");
    expect(review).toContain('toast.error("Sign in to continue to secure checkout.")');
    expect(review).toContain("setOrderAccessToken(createdOrderAccessToken(res) ?? null)");
    expect(review).toContain("...orderAccessTokenInput(orderAccessToken)");
    expect(review).toContain("installationEstimateQueryEnabled({ submittedId, emailValid, isAuthenticated })");
    expect(review).not.toContain("orders.confirm");
    expect(review).not.toContain("payments.charge");
    expect(review).not.toContain("<PayWithCard");
    expect(review).toContain("<PayWithStripe");
  });

  it("confirms a paid checkout from the Stripe session, not a public orders.confirm call", () => {
    const success = source("client/src/pages/CheckoutSuccess.tsx");
    expect(success).toContain("trpc.orders.stripeCheckoutStatus.useQuery");
    expect(success).toContain('get("session_id")');
    expect(success).not.toContain("orders.confirm");
    expect(success).toContain("CabinetDealz");
  });

  it("sends the order access token with a card charge when one was issued", () => {
    const card = source("client/src/components/order/PayWithCard.tsx");
    expect(card).toContain("...orderAccessTokenInput(accessToken)");
    expect(card).toContain("trpc.payments.charge.useMutation");
  });

  it("lets an admin confirm without a guest token", () => {
    const admin = source("client/src/components/admin/IncomingOrdersAdmin.tsx");
    expect(admin).toContain("confirm.mutate({ id: order.id })");
  });
});
