import { describe, expect, it } from "vitest";
import {
  CUSTOMER_IDENTIFIER_HINT,
  CUSTOMER_LOOKUP_COPY,
  lookupMessage,
  lookupOutcome,
  parseCustomerIdentifier,
} from "./crmCustomerLookup";

describe("customer identifier parsing", () => {
  it("takes a bare customer number", () => {
    expect(parseCustomerIdentifier("5192").dealId).toBe(5192);
    expect(parseCustomerIdentifier("  5192  ").dealId).toBe(5192);
    expect(parseCustomerIdentifier("#5192").dealId).toBe(5192);
  });

  it("takes the forms staff actually type", () => {
    expect(parseCustomerIdentifier("customer 5192").dealId).toBe(5192);
    expect(parseCustomerIdentifier("Customer #5192").dealId).toBe(5192);
    expect(parseCustomerIdentifier("deal 5192").dealId).toBe(5192);
    expect(parseCustomerIdentifier("client: 5192").dealId).toBe(5192);
    expect(parseCustomerIdentifier("account #5192").dealId).toBe(5192);
  });

  it("takes a pasted CRM link with a deal id", () => {
    expect(parseCustomerIdentifier("https://cabinetdealz.com/admin?deal=5192").dealId).toBe(5192);
    expect(parseCustomerIdentifier("/affiliate?section=crm&deal=5192").dealId).toBe(5192);
  });

  it("refuses a ?customer= link, which carries a different number space", () => {
    // /affiliate?section=customers&customer=user:5192 is a users.id key. Treating
    // it as crm_deals.id could open a different customer's plan, so it is
    // rejected instead of guessed at.
    expect(parseCustomerIdentifier("/affiliate?section=customers&customer=user:5192").dealId).toBeNull();
    expect(parseCustomerIdentifier("/affiliate?section=customers&customer=5192").dealId).toBeNull();
  });

  it("refuses anything that is not a customer number, so it cannot become a search", () => {
    expect(parseCustomerIdentifier("").dealId).toBeNull();
    expect(parseCustomerIdentifier("   ").dealId).toBeNull();
    expect(parseCustomerIdentifier("rivera").dealId).toBeNull();
    expect(parseCustomerIdentifier("kitchen").dealId).toBeNull();
    expect(parseCustomerIdentifier("5192abc").dealId).toBeNull();
    expect(parseCustomerIdentifier("0").dealId).toBeNull();
    expect(parseCustomerIdentifier("-5192").dealId).toBeNull();
  });

  it("echoes what was typed so the answer can name it", () => {
    expect(parseCustomerIdentifier("  #5192 ").raw).toBe("#5192");
  });
});

describe("customer lookup outcome", () => {
  it("opens one design straight away", () => {
    expect(lookupOutcome(1)).toBe("one");
  });

  it("asks which one when there are several", () => {
    expect(lookupOutcome(2)).toBe("several");
    expect(lookupOutcome(7)).toBe("several");
  });

  it("says so when there is none — it never falls back to every design", () => {
    expect(lookupOutcome(0)).toBe("none");
    expect(lookupMessage("none", "5192")).toBe("That customer has no design linked yet.");
    expect(CUSTOMER_LOOKUP_COPY.noneHint).toContain("Link a saved design");
  });

  it("names the customer when asking which design", () => {
    expect(lookupMessage("several", "5192")).toBe("5192: That customer has more than one linked design. Pick the right one.");
    expect(lookupMessage("one", "5192")).toBe("Opening their only design…");
  });

  it("shows the accepted identifier format in the input hint", () => {
    expect(CUSTOMER_IDENTIFIER_HINT).toBe("Customer # (e.g. 5192)");
  });
});
