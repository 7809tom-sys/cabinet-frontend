import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/order/OrderReview.tsx"),
  "utf8",
);

describe("OrderReview freight accessorial controls", () => {
  it("requires complete contact and delivery details before enabling a quote", () => {
    expect(source).toContain("const customerInfoComplete = Boolean(");
    expect(source).toContain("name.trim() && emailValid && phone.trim() && addressLine1.trim() && city.trim() && taxState.length === 2");
    expect(source).toContain("Complete the required name, phone, street address, city, state, and ZIP above to calculate the shipping quote.");
    expect(source).toContain("enabled: deliveryMethod === \"ship\" && zipDebounced.length >= 5 && city.trim().length > 0 && taxState.length === 2 && addressLine1.trim().length > 0");
    expect(source).toContain("shippingAddressLine1: addressLine1.trim()");
    expect(source).toContain("shippingCity: city.trim()");
    expect(source).toContain("shippingState: taxState");
    expect(source).toContain("deliveryAddress: {");
    expect(source).toContain("line1: addressLine1.trim()");
  });

  it("uses only Business and Residential delivery types and never guesses from ZIP", () => {
    expect(source).toContain('useState<"business" | "residential">("business")');
    expect(source).toContain('(["business", "residential"] as const)');
    expect(source).toContain("A ZIP alone cannot reliably identify a residential address");
    expect(source).not.toContain('"rural"');
  });

  it("defaults lift-gate service on for Residential while retaining an explicit override", () => {
    expect(source).toContain('setLiftgateRequired(locationType === "residential")');
    expect(source).toContain('checked={liftgateRequired}');
    expect(source).toContain('onChange={(e) => setLiftgateRequired(e.target.checked)}');
    expect(source).toContain("does not have a loading dock or forklift");
  });

  it("requests a grouped freight quote with style provenance and the selected accessorials", () => {
    expect(source).toContain("trpc.freight.estimate.useQuery(freightInput");
    expect(source).toContain("optionalPositiveFreightId(line.cartStyleId)");
    expect(source).toContain("optionalPositiveFreightId(selectedStyle?.styleId)");
    expect(source).toContain('residential: deliveryLocationType === "residential"');
    expect(source).toContain("liftgate: liftgateRequired");
    expect(source).toContain("distributorId: optionalPositiveFreightId(line.cartDistributorId)");
    expect(source).toContain("isCabinetFreightLine(line)");
    expect(source).toContain("optionalPositiveFreightId(line.cartDistributorId) != null");
    expect(source).toContain("final pallet dimensions and loaded weight");
  });

  it("shows each live parcel, Plan A, or Plan B style-origin group and persists the exact quote before hosted payment", () => {
    expect(source).toContain('group.source === "parcel" ? "Live parcel" : group.source === "live" ? "Plan A live" : "Plan B fallback"');
    expect(source).toContain("freightEstimate.data.rateGroups");
    expect(source).toContain("group.parcelReviewWarnings?.length");
    expect(source).toContain("Carrier handling review:");
    expect(source).toContain("freightQuoteToken: deliveryMethod === \"ship\" && !hasOnlyTemporaryFreeShippingItems");
    expect(source).toContain("freightEstimate.data?.quoteToken");
    expect(source).not.toContain("hardwareFreightQuoteToken ??");
    expect(source).toContain("setSubmittedRequestNumber(res.requestNumber)");
    expect(source).toContain("<PayWithStripe");
    expect(source).toContain("orderRequestId={submittedId}");
    expect(source).toContain("total + taxAmount + (deliveryMethod === \"ship\" ? (freightCents + hardwareFreightCents) / 100 : 0)");
  });

  it("refreshes a stale or mismatched signed quote instead of submitting it", () => {
    expect(source).toContain("Refreshing your verified shipping quote");
    expect(source).toContain("freightEstimate.refetch()");
  });
});
