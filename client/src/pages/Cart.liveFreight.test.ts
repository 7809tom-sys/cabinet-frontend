import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cartSource = readFileSync(resolve(process.cwd(), "client/src/pages/Cart.tsx"), "utf8");
const cartContextSource = readFileSync(resolve(process.cwd(), "client/src/contexts/CartContext.tsx"), "utf8");
const builderSource = readFileSync(resolve(process.cwd(), "client/src/pages/OrderBuilder.tsx"), "utf8");
const reviewSource = readFileSync(resolve(process.cwd(), "client/src/components/order/OrderReview.tsx"), "utf8");
const prefillSource = readFileSync(resolve(process.cwd(), "client/src/lib/cartCheckoutPrefill.ts"), "utf8");
const loadingSource = readFileSync(resolve(process.cwd(), "client/src/components/order/FreightCalculatingStatus.tsx"), "utf8");

describe("Cart address-first checkout", () => {
  it("keeps exact cart product identity when the customer continues into Order Review", () => {
    expect(builderSource).toContain("applyCartCheckoutPrefill(line, cartLine)");
    expect(prefillSource).toContain("cartDistributorId: item.distributorId ?? null");
    expect(prefillSource).toContain("vendorProductId: item.vendorProductId ?? null");
    expect(reviewSource).toContain("distributorId: optionalPositiveFreightId(line.cartDistributorId)");
  });

  it("shows the address-first shipping notice and an informational per-vendor quote", () => {
    const quoteBoxSource = readFileSync(resolve(process.cwd(), "client/src/components/shipping/ShippingQuoteBox.tsx"), "utf8");
    const liveSubtotalBlock = cartSource.slice(cartSource.indexOf("const liveSubtotal"), cartSource.indexOf("const separateGlassItems"));
    expect(cartSource).toContain('data-testid="checkout-address-shipping-notice"');
    expect(cartSource).toContain("Shipping is calculated after your delivery address is complete");
    expect(cartSource).toContain("street address, city, state, and ZIP");
    expect(cartSource).toContain("ShippingQuoteBox");
    expect(cartSource).not.toContain("trpc.freight.estimate.useQuery");
    expect(cartSource).not.toContain("trpc.location.availability.useQuery");
    expect(cartSource).not.toContain("Prefer a UPS package quote");
    expect(cartSource).not.toContain("Check UPS / freight");
    expect(cartSource).not.toContain('id="ups-parcel-quote"');
    expect(cartSource).not.toContain("Delivery ZIP code");
    expect(quoteBoxSource).toContain("Get shipping quote");
    expect(quoteBoxSource).toContain("not added to the Stripe total");
    expect(liveSubtotalBlock).not.toContain("shippingQuote");
    expect(liveSubtotalBlock).toContain("(liveUnitPrice(i) ?? 0) * i.qty");
  });

  it("never disables Cart-to-address navigation for supplier, hardware, or freight state", () => {
    const checkoutStart = cartSource.indexOf('onClick={requestOrder}');
    const checkoutEnd = cartSource.indexOf("</Button>", checkoutStart);
    const checkoutButton = cartSource.slice(checkoutStart, checkoutEnd);
    expect(checkoutStart).toBeGreaterThan(-1);
    expect(checkoutButton).not.toContain("disabled=");
    expect(cartSource).toContain("if (items.length === 0) return;");
  });

  it("allows every vendor line into the cart and leaves shipment quoting to checkout", () => {
    expect(cartContextSource).toContain("new carts intentionally accept every vendor");
    expect(cartContextSource).toContain("return [...prev, item]");
    expect(cartSource).toContain('data-testid="cart-vendor-section"');
  });

  it("requests carrier and hardware quotes only after complete delivery details are entered", () => {
    expect(reviewSource).toContain("deliveryAddress: {");
    expect(reviewSource).toContain("line1: addressLine1.trim()");
    expect(reviewSource).toContain("city: city.trim()");
    expect(reviewSource).toContain("state: taxState");
    expect(reviewSource).toContain("zip: zipDebounced");
    expect(reviewSource).toContain("trpc.freight.estimate.useQuery(freightInput");
    expect(reviewSource).toContain("trpc.hardware.quote.useQuery(hardwareQuoteInput");
    expect(reviewSource).toContain("customerInfoComplete");
  });

  it("retains separate address-stage carrier controls and accessible live-rate feedback", () => {
    expect(reviewSource).toContain("UPS package quote requested from cart.");
    expect(reviewSource).toContain('<FreightCalculatingStatus upsRequested={carrierPreference === "ups"} />');
    expect(loadingSource).toContain('role="status"');
    expect(loadingSource).toContain('aria-live="polite"');
    expect(loadingSource).toContain("Calculating freight...");
  });

  it("explains hardware free shipping only as a qualifying kitchen-order promotion", () => {
    expect(cartSource).toContain("Hardware ships free when it is ordered with qualifying kitchen cabinets.");
    expect(reviewSource).toContain("hardwareFreightQuote.data?.quoteToken");
    expect(cartSource).not.toContain("hardwareItems.length > 0 && !hardwareFreightQuote.data?.available");
  });

  it("keeps the temporary one-dollar test item separately freight-exempt", () => {
    expect(cartSource).toContain("isTemporaryOneDollarFreeShippingOrder(items)");
    expect(cartSource).toContain("Free test shipping");
    expect(reviewSource).toContain("hasOnlyTemporaryFreeShippingItems");
    expect(reviewSource).toContain("freight-exempt for this payment-flow test");
  });
});
