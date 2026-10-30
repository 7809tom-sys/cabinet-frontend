// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { queryState, mutationOptions } = vi.hoisted(() => ({
  queryState: { current: {} as Record<string, { data?: unknown; isLoading?: boolean; isFetching?: boolean; error?: unknown; refetch?: () => void; mutationData?: unknown }> },
  mutationOptions: { current: {} as Record<string, { onSuccess?: (value: unknown) => void; onError?: (error: { message: string }) => void } | null> },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: new Proxy({}, {
    get(_target, namespace) {
      if (namespace === "useUtils") {
        const invalidate = () => undefined;
        return () => ({
          freight: { adminGet: { invalidate } },
          hardware: { adminGetShippingProfile: { invalidate } },
          pelican: { adminShippingProfiles: { invalidate } },
          shippingQuotes: { vendorConfig: { invalidate } },
        });
      }
      if (typeof namespace !== "string") return undefined;
      return new Proxy({}, {
        get(_inner, procedure) {
          if (typeof procedure !== "string") return undefined;
          const key = `${namespace}.${procedure}`;
          return {
            useQuery: () => queryState.current[key] ?? { data: undefined, isLoading: false, isFetching: false, error: null, refetch: () => undefined },
            useMutation: (options?: { onSuccess?: (value: unknown) => void; onError?: (error: { message: string }) => void }) => {
              mutationOptions.current[key] = options ?? null;
              return { mutate: () => undefined, isPending: false, data: queryState.current[key]?.mutationData };
            },
          };
        },
      });
    },
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ShippingAdmin, { FreightApiLogsPanel, FreightQuoteHistoryPanel } from "./ShippingAdmin";
import { ShippingQuoteResults, VendorShippingQuoteCard } from "@/components/shipping/ShippingQuoteBox";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Element.prototype.scrollIntoView = () => undefined;
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
});

afterEach(() => {
  cleanup();
  queryState.current = {};
  mutationOptions.current = {};
});

const settings = {
  enabled: true,
  originZip: "30303",
  rateModel: "per_cwt",
  handlingFeeCents: "1500",
  minChargeCents: null,
  liftgateFeeCents: undefined,
  residentialFeeCents: "6500.00",
  insideDeliveryFeeCents: "0",
  markupBps: "1500",
  damageFeeBps: null,
  freeFreightThresholdCents: undefined,
  defaultCabinetWeightLbs: "45.5",
  quoteMode: "estimator",
  liveProvider: "estimator",
  standardPalletLengthIn: "48",
  palletLengthIn: null,
  palletWidthIn: "40",
  palletHeightIn: undefined,
  palletMaxWeightLbs: "1200.00",
  palletMaxCubicFt: null,
  palletTareLbs: "50",
  freightClass: "175",
  defaultCabinetCubicFt: "8.25",
};

function shippingQueries() {
  queryState.current = {
    "freight.adminGet": {
      data: {
        settings,
        zones: [
          { zoneName: "South", zipPrefixes: null, rateCents: "12345" },
          { zoneName: "West", zipPrefixes: "90,91", rateCents: null },
        ],
      },
      isLoading: false,
      error: null,
      refetch: () => undefined,
    },
    "hardware.adminGetShippingProfile": {
      data: {
        checkoutEnabled: false,
        vendorOriginZip: null,
        profile: {
          enabled: 1,
          packageLengthIn: "12.5",
          packageWidthIn: null,
          packageHeightIn: undefined,
          packageWeightLbs: "3.25",
          standaloneShippingCents: "2500",
          sourceReference: null,
        },
      },
      isLoading: false,
    },
    "freight.adminListSimulationDesigns": {
      data: [
        { id: 4, name: "Null units", cabinetUnits: null, readyForFreight: false },
        { id: 5, name: null, cabinetUnits: "2", readyForFreight: true },
      ],
      isLoading: false,
    },
    "pelican.adminShippingProfiles": {
      data: {
        items: [{
          productId: 9,
          pelicanCode: "QZ-NULL",
          name: "Quartz with string weight",
          category: "Quartz",
          profileId: 3,
          originZip: "33760",
          transportMode: "ltl",
          packageWeightLbs: "42.50",
          evidenceType: "supplier_verified",
          verifiedAt: "not-a-date",
          isEnabled: true,
        }],
        total: "1",
      },
      isLoading: false,
      isFetching: false,
    },
    "shippingQuotes.comparePelicanCatalogWeights": {
      mutationData: { mismatches: null, pagesRead: null, catalogSkus: null, quartzNote: null },
    },
  };
}

describe("ShippingAdmin null-safe rendering", () => {
  it("renders settings, zones, hardware, and pelican rows when numbers are strings or null and arrays are null", () => {
    shippingQueries();
    render(<ShippingAdmin />);

    expect(screen.getAllByDisplayValue("30303").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("15")).toBeTruthy();
    expect(screen.getByDisplayValue("45.5")).toBeTruthy();
    expect(screen.getByDisplayValue("8.25")).toBeTruthy();
    expect(screen.getByDisplayValue("96")).toBeTruthy();
    expect(screen.getByDisplayValue("South")).toBeTruthy();
    expect(screen.getByDisplayValue("123.45")).toBeTruthy();
    expect(screen.getAllByDisplayValue("0.00").length).toBeGreaterThan(0);
    expect(screen.getByText("No ZIP codes added")).toBeTruthy();
    expect(screen.getByText("90")).toBeTruthy();
    expect(screen.getByDisplayValue("25.00")).toBeTruthy();
    expect(screen.getByDisplayValue("12.5")).toBeTruthy();
    expect(screen.getByDisplayValue("3.25")).toBeTruthy();
    expect(screen.getByText("QZ-NULL")).toBeTruthy();
    expect(screen.getByText(/0 mismatches/)).toBeTruthy();
    expect(screen.queryByText("Invalid Date")).toBeNull();
  });

  it("renders freight API logs when weights are null, undefined, or numeric strings and accessorials are null", () => {
    queryState.current["freight.adminGetApiLogs"] = {
      data: [
        {
          id: 1,
          ts: null,
          broker: "worldwideexpress",
          fromZip: "30303",
          toZip: "10001",
          packages: null,
          totalWeightLbs: null,
          freightClass: null,
          accessorials: null,
          design: null,
          ok: true,
          amountCents: null,
          carrier: "WWEX",
          durationMs: null,
        },
        {
          id: 2,
          ts: undefined,
          broker: "ups",
          fromZip: null,
          toZip: undefined,
          packages: "not-an-array",
          totalWeightLbs: undefined,
          freightClass: 175,
          accessorials: undefined,
          design: null,
          ok: false,
          amountCents: undefined,
          carrier: null,
          error: null,
          durationMs: "42",
        },
        {
          id: 3,
          ts: "not-a-date",
          broker: "fedex",
          fromZip: "30303",
          toZip: "90210",
          packages: [{ kind: "pallet", index: 1, lengthIn: "96", widthIn: null, heightIn: "60", weightLbs: "400.2" }],
          totalWeightLbs: "845.4",
          freightClass: "175",
          accessorials: ["liftgate", null, "residential"],
          design: null,
          ok: true,
          amountCents: "15999",
          carrier: "FedEx",
          durationMs: 80,
        },
      ],
      isLoading: false,
      refetch: () => undefined,
    };

    render(<FreightApiLogsPanel />);

    expect(screen.getAllByText("0 lbs").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("845 lbs")).toBeTruthy();
    expect(screen.getByText("liftgate, residential")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show package details for quote 3" }));
    expect(screen.getByText(/96″ L × —″ W × 60″ H · 400\.2 lb/)).toBeTruthy();
    expect(screen.getByText(/\$159\.99/)).toBeTruthy();
    expect(screen.getByText(/\$0\.00/)).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("Invalid Date")).toBeNull();
  });

  it("renders quote history when weights and prices are numeric strings or null and accessorial arrays are null", () => {
    queryState.current["freight.adminQuoteHistory"] = {
      data: [
        {
          id: 11,
          createdAt: null,
          broker: "worldwideexpress",
          fromZip: "30303",
          toZip: "10001",
          palletCount: null,
          packages: null,
          totalWeightLbs: null,
          freightClass: null,
          accessorials: null,
          design: null,
          ok: true,
          amountCents: "2500.00",
          carrier: "WWEX",
          service: null,
          error: null,
        },
        {
          id: 12,
          createdAt: "not-a-date",
          broker: null,
          fromZip: null,
          toZip: null,
          packages: null,
          totalWeightLbs: undefined,
          freightClass: undefined,
          accessorials: undefined,
          design: null,
          ok: false,
          amountCents: null,
          error: null,
        },
        {
          id: 13,
          createdAt: "2026-10-30T15:04:00.000Z",
          broker: "ups",
          fromZip: "30303",
          toZip: "90210",
          packages: [{ kind: "carton", lengthIn: "20", widthIn: "10", heightIn: null, weightLbs: "12" }],
          totalWeightLbs: "120.6",
          freightClass: "70",
          accessorials: "liftgate",
          design: { id: 8, name: "Kitchen 8", url: "/design/8" },
          ok: true,
          amountCents: 9900,
          carrier: "UPS",
          service: "Ground",
        },
      ],
      isLoading: false,
      refetch: () => undefined,
    };

    render(<FreightQuoteHistoryPanel />);

    expect(screen.getAllByText("0 lb").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("121 lb")).toBeTruthy();
    expect(screen.getByText("liftgate")).toBeTruthy();
    expect(screen.getByText(/\$25\.00/)).toBeTruthy();
    expect(screen.getByText(/\$99\.00/)).toBeTruthy();
    expect(screen.getByText("Kitchen 8")).toBeTruthy();
    expect(screen.queryByText("Invalid Date")).toBeNull();
  });

  it("renders a saved-design freight result when weights, cubes, and cents are null or numeric strings", () => {
    shippingQueries();
    render(<ShippingAdmin />);
    act(() => {
      mutationOptions.current["freight.adminSimulateSavedDesignFreight"]?.onSuccess?.({
        mode: "saved_configuration",
        note: "String decimals from MySQL",
        provider: "worldwideexpress",
        providerEnvironment: "production",
        carrierRetryAt: null,
        savedDesign: {
          name: "Null weight kitchen",
          quotedCabinetUnits: "4",
          excludedPlacementUnits: null,
          unmatchedCatalogUnits: undefined,
          unpricedCatalogUnits: "0",
        },
        totalUnits: "12",
        totalBillableWeightLbs: "845.4",
        groups: [
          {
            key: "g1",
            label: "Origin A",
            originZip: "30303",
            palletCount: "2",
            totalCubicFt: null,
            source: "live_rate",
            planBFeeCents: null,
            baseAmountCents: "8000",
            liveError: null,
            usedOperationsOriginFallback: false,
            pallets: [
              { lengthIn: "96", widthIn: null, heightIn: "60", weightLbs: "400.2", contentsWeightLbs: undefined, contentsCubicFt: "12.5" },
              { lengthIn: 48, widthIn: 40, heightIn: 30, weightLbs: null, contentsWeightLbs: null, contentsCubicFt: null },
            ],
          },
          {
            key: "g2",
            label: "Origin B",
            originZip: null,
            palletCount: null,
            totalCubicFt: "3.456",
            source: null,
            planBFeeCents: "1500",
            baseAmountCents: undefined,
            pallets: null,
          },
        ],
        quote: {
          available: true,
          totalCents: "25999",
          lines: null,
          markupCents: null,
          damageFeeCents: "500",
          reason: null,
        },
      });
    });

    expect(screen.getByText("Null weight kitchen")).toBeTruthy();
    expect(screen.getByText(/4 catalog cabinet unit\(s\) tested/)).toBeTruthy();
    expect(screen.getByText("845 lbs")).toBeTruthy();
    expect(screen.getAllByText(/0\.00 cu ft/).length).toBeGreaterThan(0);
    expect(screen.getByText(/3\.46 cu ft/)).toBeTruthy();
    expect(screen.getByText(/12\.50 cu ft/)).toBeTruthy();
    expect(screen.getAllByText(/\$259\.99/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$80\.00/)).toBeTruthy();
    expect(screen.getByText(/\$15\.00/)).toBeTruthy();
    expect(screen.getByText(/\$5\.00/)).toBeTruthy();
    expect(screen.getAllByText(/Not configured/).length).toBeGreaterThan(0);
  });

  it("renders shipping quotes when item indexes are null and prices arrive as strings", () => {
    queryState.current["shippingQuotes.vendorConfig"] = {
      data: {
        serviceCodes: null,
        freightClass: null,
        shipFromZip: null,
        provider: "none",
        quoteUrl: null,
        authHeaderName: null,
        vendorEnabled: false,
        adminEnabled: true,
        hasSecret: false,
        customApiUrl: null,
        customApiAdminEnabled: false,
      },
      isLoading: false,
      error: null,
    };
    render(
      <>
        <ShippingQuoteResults quotes={[
          {
            vendorScope: "pelican",
            vendorName: "Pelican",
            itemIndexes: null,
            ok: true,
            source: null,
            sourceLabel: "Live",
            estimate: false,
            options: [{ carrier: "UPS", method: "Ground", costCents: "2599", transitDays: "2", expiresAt: null }],
            note: null,
            error: null,
            code: null,
          },
          {
            vendorScope: "cabinets",
            vendorName: "Cabinets",
            itemIndexes: undefined,
            ok: false,
            source: null,
            sourceLabel: null,
            estimate: false,
            options: null,
            note: null,
            error: "No rate",
            code: null,
          },
        ] as never} />
        <VendorShippingQuoteCard isAdmin vendorLineId={1} />
      </>,
    );

    expect(screen.getByText(/\$25\.99/)).toBeTruthy();
    expect(screen.getByText("No rate")).toBeTruthy();
    expect(screen.getByText("Shipping codes and live quote")).toBeTruthy();
  });
});
