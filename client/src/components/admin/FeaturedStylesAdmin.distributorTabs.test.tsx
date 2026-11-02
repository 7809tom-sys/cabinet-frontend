// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const styles = [
  { id: 1, ourName: "Zebra White", supplierBrandName: "Kitchen Crest", doorStyle: "Shaker", color: "White", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 1, roomScenes: [] },
  { id: 2, ourName: "Alpha Oak", supplierBrandName: "Ashford", doorStyle: "Slab", color: "Natural", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 2, roomScenes: [] },
  { id: 3, ourName: "Beta Grey", supplierBrandName: "Kitchen Crest", doorStyle: "Shaker", color: "Grey", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 1, roomScenes: [] },
  { id: 4, ourName: "Cedar", supplierName: "Line B", doorStyle: null, color: null, isFeatured: false, featuredRank: 0, isActive: true, distributorId: 3, roomScenes: [] },
  // Featured and inactive doors never appear in the selector, so they get no say in the tabs.
  { id: 5, ourName: "Featured Only", supplierBrandName: "Ashford", doorStyle: "Shaker", color: "White", isFeatured: true, featuredRank: 1, isActive: true, distributorId: 2, roomScenes: [] },
  { id: 6, ourName: "Hidden Only", supplierBrandName: "Ashford", doorStyle: "Shaker", color: "White", isFeatured: false, featuredRank: 0, isActive: false, distributorId: 2, roomScenes: [] },
];

// Distributor 3 starts switched off; it is the only one with an admin record that is off.
const lines = [
  { id: 1, name: "Kitchen Crest", code: "KC", isActive: true },
  { id: 2, name: "Ashford", code: "AF", isActive: true },
  { id: 3, name: "Line B", code: "LB", isActive: false },
];

const setActiveCalls: Array<{ distributorId: number; isActive: boolean }> = [];

vi.mock("@/lib/trpc", () => {
  const mut = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  const q = (path: string) => () => ({
    data: path.includes("listForAdmin")
      ? styles
      : path.includes("adminList")
        ? lines
        : path.includes("skuCounts")
          ? []
          : path.includes("listDoorMeasurementSubmissions")
            ? []
            : undefined,
    isLoading: false,
  });
  const make = (path: string): unknown => new Proxy(() => {}, {
    get: (_t, k: string) => {
      if (k === "useQuery") return q(path);
      if (k === "useMutation") {
        return path.endsWith("distributorAdmin.setActive")
          ? () => ({
              mutate: (input: { distributorId: number; isActive: boolean }) => setActiveCalls.push(input),
              mutateAsync: vi.fn(),
              isPending: false,
            })
          : mut;
      }
      if (k === "useUtils") return () => make("utils");
      if (k === "invalidate" || k === "fetch") return vi.fn();
      return make(`${path}.${k}`);
    },
    apply: () => make(path),
  });
  return { trpc: make("trpc") };
});
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }) }));

import FeaturedStylesAdmin from "./FeaturedStylesAdmin";

afterEach(() => {
  cleanup();
  setActiveCalls.length = 0;
});

function tabLabels(): string[] {
  return Array.from(screen.getByTestId("door-style-distributor-tabs").querySelectorAll('[role="tab"]'))
    .map((node) => node.textContent ?? "");
}

function selectorNames(): string[] {
  const list = screen.queryByTestId("all-door-style-list");
  if (!list) return [];
  return Array.from(list.querySelectorAll('[data-testid="door-style-name"]')).map((node) => node.textContent ?? "");
}

function openTab(label: string) {
  const tab = within(screen.getByTestId("door-style-distributor-tabs"))
    .getAllByRole("tab")
    .find((node) => (node.textContent ?? "").startsWith(label));
  if (!tab) throw new Error(`no distributor tab for ${label}`);
  fireEvent.click(tab);
}

function chooseSort(label: string) {
  fireEvent.keyDown(screen.getByTestId("door-style-tab-sort"), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: label }));
}

describe("admin door selector distributor tabs", () => {
  it("puts All first and then one tab per distributor on the loaded doors, with counts", () => {
    render(<FeaturedStylesAdmin />);
    expect(tabLabels().map((text) => text.replace(/Off$/, "").replace(/\d+/g, "").trim())).toEqual(["All", "Ashford", "Kitchen Crest", "Line B"]);
    expect(screen.getByTestId("door-style-distributor-tab-all").getAttribute("aria-selected")).toBe("true");
    // Counts ignore featured and inactive doors.
    expect(screen.getByTestId("door-style-distributor-tab-1").textContent).toContain("2");
    expect(screen.getByTestId("door-style-distributor-tab-2").textContent).toContain("1");
  });

  it("shows only that distributor's doors inside its tab", () => {
    render(<FeaturedStylesAdmin />);
    expect(selectorNames()).toEqual(["Alpha Oak", "Beta Grey", "Zebra White"]);

    openTab("Kitchen Crest");
    expect(screen.getByTestId("door-style-distributor-tab-1").getAttribute("aria-selected")).toBe("true");
    expect(selectorNames()).toEqual(["Beta Grey", "Zebra White"]);

    openTab("Ashford");
    expect(selectorNames()).toEqual(["Alpha Oak"]);

    openTab("All");
    expect(selectorNames()).toEqual(["Alpha Oak", "Beta Grey", "Zebra White"]);
  });

  it("gives every tab a sort menu on the left ordering that tab's doors", () => {
    render(<FeaturedStylesAdmin />);
    openTab("Kitchen Crest");
    expect(selectorNames()).toEqual(["Beta Grey", "Zebra White"]);

    chooseSort("Door name");
    expect(selectorNames()).toEqual(["Beta Grey", "Zebra White"]);

    chooseSort("Color");
    expect(selectorNames()).toEqual(["Beta Grey", "Zebra White"]);

    openTab("All");
    chooseSort("Door style");
    expect(selectorNames()).toEqual(["Beta Grey", "Zebra White", "Alpha Oak"]);
    chooseSort("Door name");
    expect(selectorNames()).toEqual(["Alpha Oak", "Beta Grey", "Zebra White"]);
  });
});

describe("admin door selector distributor switch", () => {
  it("switches a distributor off through distributorAdmin.setActive, which hides its doors", () => {
    render(<FeaturedStylesAdmin />);
    openTab("Kitchen Crest");
    const toggle = screen.getByTestId("door-style-distributor-switch");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(selectorNames()).toEqual(["Beta Grey", "Zebra White"]);

    fireEvent.click(toggle);
    expect(setActiveCalls).toEqual([{ distributorId: 1, isActive: false }]);
  });

  it("shows a switched-off distributor's tab marked Off, hides its doors, and restores them when switched on", () => {
    render(<FeaturedStylesAdmin />);
    // Distributor 3 is off in the admin list, so it contributes no doors anywhere.
    expect(screen.getByTestId("door-style-distributor-tab-3").textContent).toContain("Off");
    expect(selectorNames()).not.toContain("Cedar");

    openTab("Line B");
    expect(selectorNames()).toEqual([]);
    expect(screen.getByTestId("door-style-tab-empty").textContent).toMatch(/switched off/i);
    const toggle = screen.getByTestId("door-style-distributor-switch");
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(toggle);
    expect(setActiveCalls).toEqual([{ distributorId: 3, isActive: true }]);
  });

  it("offers no distributor switch on the All tab", () => {
    render(<FeaturedStylesAdmin />);
    expect(screen.queryByTestId("door-style-distributor-switch")).toBeNull();
    openTab("Ashford");
    expect(screen.getByTestId("door-style-distributor-switch")).toBeTruthy();
    openTab("All");
    expect(screen.queryByTestId("door-style-distributor-switch")).toBeNull();
  });

  it("lays the tab row above the doors, the sort menu on the left and the switch on the right", () => {
    render(<FeaturedStylesAdmin />);
    openTab("Kitchen Crest");
    const tabs = screen.getByTestId("door-style-distributor-tabs");
    const toolbar = screen.getByTestId("door-style-tab-toolbar");
    const list = screen.getByTestId("all-door-style-list");

    // Tabs sit above the toolbar, which sits above the doors.
    expect(tabs.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toolbar.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Sort menu is the first thing in the toolbar; the switch is the last.
    const sort = within(toolbar).getByTestId("door-style-tab-sort");
    const toggle = within(toolbar).getByTestId("door-style-distributor-switch");
    expect(toolbar.firstElementChild?.contains(sort)).toBe(true);
    expect(toolbar.lastElementChild?.contains(toggle)).toBe(true);
    expect(sort.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("admin door selector tabs stay in the admin", () => {
  it("uses the existing distributorAdmin.setActive mutation and adds nothing to the designer", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const admin = readFileSync(resolve(process.cwd(), "client/src/components/admin/FeaturedStylesAdmin.tsx"), "utf8");
    expect(admin).toContain("trpc.distributorAdmin.setActive.useMutation");
    const designer = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
    expect(designer).not.toContain("door-style-distributor-tab");
    expect(designer).not.toContain("distributorAdmin.setActive");
  });
});
