import { describe, expect, it } from "vitest";
import {
  AUTO_DESIGN_CREDIT_COPY,
  creditAmountForPayment,
  designQualifiesForPayment,
  firstKitchenOrderCredit,
  qualifyingDesigns,
  type AutoDesignFeePayment,
  type CreditableDesign,
} from "./autoDesignCredit";

const PHONE = "+15555551234";
const pay = (over: Partial<AutoDesignFeePayment> = {}): AutoDesignFeePayment => ({
  id: "p1", phoneE164: PHONE, channel: "app_store", grossCents: 999, storeFeeCents: 300, paidAt: "2026-11-01T12:00:00Z", ...over,
});
const design = (id: string, createdAt: string, over: Partial<CreditableDesign> = {}): CreditableDesign => ({
  id, phoneE164: PHONE, roomType: "kitchen", createdAt, ...over,
});
const order = { id: "o1", phoneE164: PHONE, merchandiseCents: 850000 };
const fresh = { priorKitchenOrdersForPhone: 0, creditAlreadyApplied: false };

describe("90-day window", () => {
  it("counts kitchen designs from payment through day 90", () => {
    const p = pay();
    expect(designQualifiesForPayment(p, design("a", "2026-11-01T12:00:00Z"))).toBe(true);
    expect(designQualifiesForPayment(p, design("b", "2027-01-30T12:00:00Z"))).toBe(true); // day 90
    expect(designQualifiesForPayment(p, design("c", "2027-01-30T12:00:01Z"))).toBe(false); // past 90 days
    expect(designQualifiesForPayment(p, design("d", "2026-10-31T12:00:00Z"))).toBe(false); // before paying
  });
  it("keys by phone, not account or email", () => {
    expect(designQualifiesForPayment(pay(), design("x", "2026-11-05T00:00:00Z", { phoneE164: "+15555559999" }))).toBe(false);
  });
  it("ignores non-kitchen designs and refunded payments", () => {
    expect(designQualifiesForPayment(pay(), design("bath", "2026-11-05T00:00:00Z", { roomType: "bathroom" }))).toBe(false);
    expect(designQualifiesForPayment(pay({ refunded: true }), design("a", "2026-11-05T00:00:00Z"))).toBe(false);
  });
  it("lists qualifying designs", () => {
    const ds = [design("a", "2026-11-02T00:00:00Z"), design("b", "2027-03-01T00:00:00Z")];
    expect(qualifyingDesigns(pay(), ds).map((d) => d.id)).toEqual(["a"]);
  });
});

describe("store-fee policy", () => {
  it("credits the full fee the customer paid, never the net after the store cut", () => {
    expect(creditAmountForPayment(pay({ grossCents: 999, storeFeeCents: 300 }))).toBe(999);
    expect(creditAmountForPayment(pay({ channel: "play_store", grossCents: 999, storeFeeCents: 150 }))).toBe(999);
  });
  it("says so in the customer copy", () => {
    expect(AUTO_DESIGN_CREDIT_COPY.join(" ")).toMatch(/full amount you paid/);
    expect(AUTO_DESIGN_CREDIT_COPY.join(" ")).toMatch(/never added to your kitchen price/);
    expect(AUTO_DESIGN_CREDIT_COPY.join(" ")).toMatch(/\$9\.99/);
  });
});

describe("firstKitchenOrderCredit", () => {
  const ds = [design("a", "2026-11-02T00:00:00Z"), design("b", "2026-12-20T00:00:00Z")];
  it("credits the fee on the first kitchen order", () => {
    const r = firstKitchenOrderCredit(order, [pay()], ds, fresh);
    expect(r).toMatchObject({ eligible: true, creditCents: 999, paymentId: "p1", designIds: ["a", "b"] });
  });
  it("applies once and only to the first kitchen order", () => {
    expect(firstKitchenOrderCredit(order, [pay()], ds, { ...fresh, creditAlreadyApplied: true })).toMatchObject({ eligible: false, reason: "already_applied" });
    expect(firstKitchenOrderCredit(order, [pay()], ds, { ...fresh, priorKitchenOrdersForPhone: 1 })).toMatchObject({ eligible: false, reason: "not_first_order" });
  });
  it("needs a payment and a qualifying design on the same phone", () => {
    expect(firstKitchenOrderCredit(order, [], ds, fresh)).toMatchObject({ eligible: false, reason: "no_payment" });
    expect(firstKitchenOrderCredit(order, [pay()], [design("late", "2027-06-01T00:00:00Z")], fresh)).toMatchObject({ eligible: false, reason: "no_qualifying_design" });
    expect(firstKitchenOrderCredit({ ...order, phoneE164: "" }, [pay()], ds, fresh)).toMatchObject({ eligible: false, reason: "no_phone" });
    expect(firstKitchenOrderCredit(order, [pay({ phoneE164: "+15555559999" })], ds, fresh)).toMatchObject({ eligible: false, reason: "no_payment" });
  });
  it("never stacks payments and never exceeds the merchandise total", () => {
    const two = [pay(), pay({ id: "p2", paidAt: "2026-11-10T00:00:00Z" })];
    expect(firstKitchenOrderCredit(order, two, ds, fresh).creditCents).toBe(999);
    expect(firstKitchenOrderCredit({ ...order, merchandiseCents: 500 }, [pay()], ds, fresh).creditCents).toBe(500);
  });
});
