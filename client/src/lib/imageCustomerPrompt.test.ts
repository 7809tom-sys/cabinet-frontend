import { describe, expect, it } from "vitest";
import { imageCustomerPromptOpen, requestImageCustomerLink, settleImageCustomerPrompt } from "./imageCustomerPrompt";

describe("image customer prompt", () => {
  it("opens until a customer is chosen, then closes", async () => {
    const pending = requestImageCustomerLink();
    expect(imageCustomerPromptOpen()).toBe(true);
    settleImageCustomerPrompt({ customerId: 4, customerKind: "user" });
    await expect(pending).resolves.toEqual({ customerId: 4, customerKind: "user" });
    expect(imageCustomerPromptOpen()).toBe(false);
  });

  it("resolves null when the picker is dismissed", async () => {
    const pending = requestImageCustomerLink();
    settleImageCustomerPrompt(null);
    await expect(pending).resolves.toBeNull();
  });
});