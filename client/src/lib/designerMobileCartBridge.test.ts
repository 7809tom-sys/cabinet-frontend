import { describe, expect, it, vi } from "vitest";
import {
  designerMobileCartCount,
  preventMobileRoomSheetAutoFocus,
  publishDesignerMobileCartCount,
  registerDesignerMobileCartOpener,
  requestDesignerMobileCartOpen,
  subscribeDesignerMobileCartCount,
} from "./designerMobileCartBridge";

describe("mobile Designer cart bridge", () => {
  it("publishes the authoritative drawing count and opens the registered Designer cart", () => {
    publishDesignerMobileCartCount(0);
    const counts: number[] = [];
    const unsubscribe = subscribeDesignerMobileCartCount((count) => counts.push(count));
    const open = vi.fn();
    const unregister = registerDesignerMobileCartOpener(open);

    publishDesignerMobileCartCount(3);

    expect(designerMobileCartCount()).toBe(3);
    expect(counts).toEqual([0, 3]);
    expect(requestDesignerMobileCartOpen()).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);

    unregister();
    unsubscribe();
    expect(requestDesignerMobileCartOpen()).toBe(false);
  });

  it("prevents Radix from focusing the first wall-size input when the mobile sheet opens", () => {
    const preventDefault = vi.fn();

    preventMobileRoomSheetAutoFocus({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
