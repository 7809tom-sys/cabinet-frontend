import { describe, expect, it } from "vitest";
import {
  buildOrderCustomerEmail,
  buildOrderReceivedEmail,
  buildOrderVerifiedEmail,
} from "./orderCustomerEmails";

const order = { orderNumber: "CD-20261022-OLOUT", customerName: "Tom Reaves", styleName: "Carmel Shaker" };

describe("customer order emails", () => {
  it("acknowledges a received order without promising anything already shipped", () => {
    const email = buildOrderReceivedEmail(order);
    expect(email.subject).toContain("We received your order CD-20261022-OLOUT");
    expect(email.text).toContain("Hi Tom,");
    expect(email.text).toContain("we have your order CD-20261022-OLOUT");
    expect(email.text).toContain("Style: Carmel Shaker");
    expect(email.text).toContain("Cabinet Dealz");
  });

  it("compliments the order, promises shipping information soon, and thanks the customer", () => {
    const email = buildOrderVerifiedEmail(order);
    expect(email.subject).toContain("Your order CD-20261022-OLOUT is confirmed");
    expect(email.text).toContain("what a great choice");
    expect(email.text).toContain("Your Carmel Shaker cabinets are our favourite kind of project.");
    expect(email.text).toContain("verified");
    expect(email.text).toContain("We will be in touch soon with your shipping information.");
    expect(email.text).toContain("Thank you for your order");
  });

  it("keeps the received and verified notes as two clearly different messages", () => {
    const received = buildOrderCustomerEmail("received", order);
    const verified = buildOrderCustomerEmail("verified", order);
    expect(received.subject).not.toBe(verified.subject);
    expect(received.text).not.toBe(verified.text);
    expect(received.text).not.toContain("shipping information");
  });

  it("greets a nameless order politely and names pickup instead of shipping", () => {
    const email = buildOrderReceivedEmail({
      orderNumber: "CD-9",
      customerName: null,
      shipTo: "1200 Warehouse Rd",
      pickup: true,
    });
    expect(email.text.startsWith("Hi,\n")).toBe(true);
    expect(email.text).toContain("Pickup at: 1200 Warehouse Rd");
    expect(email.text).not.toContain("Shipping to:");
  });
});
