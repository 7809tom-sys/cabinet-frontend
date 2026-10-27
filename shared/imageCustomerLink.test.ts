import { describe, expect, it } from "vitest";
import { ATTACH_CUSTOMER_MESSAGE, shouldAttachCustomer, withAttachedCustomer } from "./imageCustomerLink";

describe("image customer retry input", () => {
  it("merges the picked customer into an object input", () => {
    expect(withAttachedCustomer({ prompt: "kitchen", designId: 4 }, { customerId: 9, customerKind: "user" })).toEqual({
      prompt: "kitchen",
      designId: 4,
      customerId: 9,
      customerKind: "user",
    });
  });

  it("asks for a customer only on the first matching mutation error", () => {
    expect(shouldAttachCustomer("mutation", ATTACH_CUSTOMER_MESSAGE, false)).toBe(true);
    expect(shouldAttachCustomer("mutation", ATTACH_CUSTOMER_MESSAGE, true)).toBe(false);
    expect(shouldAttachCustomer("query", ATTACH_CUSTOMER_MESSAGE, false)).toBe(false);
    expect(shouldAttachCustomer("mutation", "Image generation failed.", false)).toBe(false);
  });
});
