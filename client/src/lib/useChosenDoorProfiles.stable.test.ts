// @vitest-environment jsdom
/**
 * The Designer feeds this lookup into every style row the 3D view draws from.
 * It used to change on every window focus and tab return, which rebuilt the
 * whole 3D room each time the designer came back to the page.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY } from "@shared/aiDoorChosenProfile";
import { announceChosenDoorProfile, useChosenDoorProfiles, withChosenProfiles } from "./useChosenDoorProfiles";

afterEach(() => localStorage.clear());

describe("useChosenDoorProfiles only changes when a draft changes", () => {
  it("keeps the same lookup across focus and visibility events", () => {
    const { result } = renderHook(() => useChosenDoorProfiles());
    const first = result.current;
    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(first);
  });

  it("gives a new lookup once a profile is chosen in this tab", () => {
    const { result } = renderHook(() => useChosenDoorProfiles());
    const first = result.current;
    act(() => {
      localStorage.setItem(AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY, JSON.stringify({ 7: { doorStyle: "Shaker", railWidth: 2.25 } }));
      announceChosenDoorProfile(7);
    });
    expect(result.current).not.toBe(first);
    expect(result.current(7)?.doorStyle).toBe("Shaker");
  });
});

describe("withChosenProfiles", () => {
  it("returns the original list when no draft changes any row", () => {
    const styles = [{ id: 1, doorStyle: "Slab" }, { id: 2, doorStyle: "Shaker" }];
    expect(withChosenProfiles(styles, () => null)).toBe(styles);
  });
});
