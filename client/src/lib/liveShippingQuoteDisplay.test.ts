import { describe, expect, it } from "vitest";
import { checkoutTotalWithLiveShipping, liveShippingQuotePanel } from "./liveShippingQuoteDisplay";

describe("live shipping quote display", () => {
  it("shows a returned rate before name, email, or phone are filled", () => {
    expect(liveShippingQuotePanel({
      hasItems: true,
      addressReady: true,
      fetching: false,
      available: true,
    })).toBe("quote");
  });

  it("keeps the rate on screen while a refresh is in flight", () => {
    expect(liveShippingQuotePanel({
      hasItems: true,
      addressReady: true,
      fetching: true,
      available: true,
    })).toBe("quote");
  });

  it("asks for the delivery address until that quote can run", () => {
    expect(liveShippingQuotePanel({
      hasItems: true,
      addressReady: false,
      fetching: false,
      available: false,
    })).toBe("need-address");
    expect(liveShippingQuotePanel({
      hasItems: false,
      addressReady: true,
      fetching: false,
      available: false,
    })).toBe("need-address");
  });

  it("includes the live shipping cents in the checkout total", () => {
    expect(checkoutTotalWithLiveShipping({
      merchandise: 1200,
      tax: 72,
      shippingCents: 18550,
    })).toBeCloseTo(1457.5);
    expect(checkoutTotalWithLiveShipping({
      merchandise: 1200,
      tax: 0,
      shippingCents: 0,
    })).toBe(1200);
  });
});
