// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import DistributorPreviewPage from "./DistributorPreview";
import { BACK_OFFICE_GROUPS, StoreSettingsCard } from "./DistributorBackOffice";
import { useElapsedTimer } from "./DistributorCatalogImport";
import { PUBLIC_PRICING_STORAGE_KEY, setStoredPublicPricing } from "@/lib/demoPricing";

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => window.localStorage.clear());

describe("demo back office structure", () => {
  it("uses the real admin's group names in the same order (distributor items only)", () => {
    const src = readFileSync(resolve(__dirname, "../components/admin/AdminGroupedTabs.tsx"), "utf8");
    const adminGroups = Array.from(src.matchAll(/^\s{4}label: "([^"]+)",$/gm)).map((m) => m[1]);
    const ours = BACK_OFFICE_GROUPS.map((g) => g.label);
    let at = -1;
    for (const label of ours) {
      const idx = adminGroups.indexOf(label);
      expect(idx, label).toBeGreaterThan(at);
      at = idx;
    }
    const catalog = BACK_OFFICE_GROUPS.find((g) => g.label === "Products & Catalog")!.items.map((i) => i.label);
    for (const label of ["Door Styles", "Product Images", "Spreadsheet Import", "Catalog"]) expect(catalog).toContain(label);
    expect(BACK_OFFICE_GROUPS.find((g) => g.label === "Settings")!.items[0].label).toBe("Store Settings");
  });
});

describe("Show prices to the public (default off)", () => {
  it("is off by default, and turning it on in Store settings shows prices across the demo", () => {
    window.history.replaceState(null, "", "/distributor-preview/shop");
    render(<DistributorPreviewPage section="shop" />);
    expect(document.querySelectorAll('[data-testid="demo-price"]').length).toBe(0);
    expect(screen.getByText("Sign in for your price")).toBeTruthy();
    act(() => setStoredPublicPricing(true));
    expect(document.querySelectorAll('[data-testid="demo-price"]').length).toBeGreaterThan(100);
    expect(screen.queryByText("Sign in for your price")).toBeNull();
  });

  it("the switch writes the setting", () => {
    window.history.replaceState(null, "", "/distributor-preview/dashboard?tab=store");
    render(<StoreSettingsCard />);
    const sw = screen.getByRole("switch", { name: "Show prices to the public" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(window.localStorage.getItem(PUBLIC_PRICING_STORAGE_KEY)).toBe("1");
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });
});

describe("import elapsed timer", () => {
  it("counts real elapsed time, freezes on stop and resets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
    const { result } = renderHook(() => useElapsedTimer());
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(1250); });
    expect(result.current.running).toBe(true);
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(1200);
    act(() => { vi.advanceTimersByTime(3000); result.current.stop(); });
    const frozen = result.current.elapsedMs;
    expect(frozen).toBe(4250);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.elapsedMs).toBe(frozen);
    act(() => result.current.reset());
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.running).toBe(false);
  });
});
