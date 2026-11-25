import { describe, expect, it, vi } from "vitest";
import { customerPageLinkWantsNewTab, isCustomerPageLinkActivationKey, openCustomerPage } from "./crmCustomerPageLink";

const nav = () => ({ assign: vi.fn(), open: vi.fn() });

describe("customer page link helpers", () => {
  it("opens the customer page in the same tab on a plain activation", () => {
    const n = nav();
    expect(openCustomerPage("/affiliate?section=customers&customer=user%3A4&scope=house", {}, n)).toBe(true);
    expect(n.assign).toHaveBeenCalledWith("/affiliate?section=customers&customer=user%3A4&scope=house");
    expect(n.open).not.toHaveBeenCalled();
  });

  it("opens a new tab, without opener access, when asked", () => {
    const n = nav();
    openCustomerPage("/affiliate?section=customers&customer=user%3A4&viewAs=7", { newTab: true }, n);
    expect(n.open).toHaveBeenCalledWith("/affiliate?section=customers&customer=user%3A4&viewAs=7", "_blank", "noopener,noreferrer");
    expect(n.assign).not.toHaveBeenCalled();
  });

  it("does nothing for an empty href", () => {
    const n = nav();
    expect(openCustomerPage("", {}, n)).toBe(false);
    expect(openCustomerPage("   ", {}, n)).toBe(false);
    expect(openCustomerPage(undefined, {}, n)).toBe(false);
    expect(n.assign).not.toHaveBeenCalled();
    expect(n.open).not.toHaveBeenCalled();
  });

  it("reads Ctrl, Cmd, Shift and middle click as new-tab gestures", () => {
    expect(customerPageLinkWantsNewTab({})).toBe(false);
    expect(customerPageLinkWantsNewTab({ button: 0 })).toBe(false);
    expect(customerPageLinkWantsNewTab({ ctrlKey: true })).toBe(true);
    expect(customerPageLinkWantsNewTab({ metaKey: true })).toBe(true);
    expect(customerPageLinkWantsNewTab({ shiftKey: true })).toBe(true);
    expect(customerPageLinkWantsNewTab({ button: 1 })).toBe(true);
  });

  it("treats Enter and Space as activation keys", () => {
    expect(isCustomerPageLinkActivationKey("Enter")).toBe(true);
    expect(isCustomerPageLinkActivationKey(" ")).toBe(true);
    expect(isCustomerPageLinkActivationKey("Tab")).toBe(false);
    expect(isCustomerPageLinkActivationKey("a")).toBe(false);
  });
});
