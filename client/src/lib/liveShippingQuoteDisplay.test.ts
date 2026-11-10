import { describe, expect, it } from "vitest";
import {
  AFFILIATE_LIVE_RATE_UNAVAILABLE,
  affiliateLiveRateFailureMessage,
  checkoutTotalWithLiveShipping,
  freightQuoteIsLiveCarrier,
  liveShippingQuotePanel,
} from "./liveShippingQuoteDisplay";

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

  it("accepts a carrier parcel or LTL rate and rejects flat and weight-table results", () => {
    expect(freightQuoteIsLiveCarrier({
      available: true,
      zoneName: "Live freight",
      rateGroups: [{ source: "live" }],
    })).toBe(true);
    expect(freightQuoteIsLiveCarrier({
      available: true,
      rateGroups: [{ source: "parcel" }, { source: "live" }],
    })).toBe(true);
    expect(freightQuoteIsLiveCarrier({
      available: true,
      rateGroups: [{ source: "plan_b" }],
    })).toBe(false);
    expect(freightQuoteIsLiveCarrier({
      available: true,
      zoneName: "Estimated LTL freight · Southeast",
      rateGroups: [{ source: "live" }],
    })).toBe(false);
    expect(freightQuoteIsLiveCarrier({
      available: false,
      rateGroups: [{ source: "live" }],
    })).toBe(false);
    expect(freightQuoteIsLiveCarrier({ available: true, rateGroups: [] })).toBe(false);
  });

  it("tells an affiliate shopper to retry or request a quote when the live rate is missing", () => {
    expect(affiliateLiveRateFailureMessage()).toBe(AFFILIATE_LIVE_RATE_UNAVAILABLE);
    expect(affiliateLiveRateFailureMessage(AFFILIATE_LIVE_RATE_UNAVAILABLE)).toBe(AFFILIATE_LIVE_RATE_UNAVAILABLE);
    expect(affiliateLiveRateFailureMessage("Shaker White does not have a Shipping Origin ZIP in Featured Door Styles.")).toBe(
      `${AFFILIATE_LIVE_RATE_UNAVAILABLE} Shaker White does not have a Shipping Origin ZIP in Featured Door Styles.`,
    );
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
