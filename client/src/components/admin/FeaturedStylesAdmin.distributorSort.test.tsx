// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const styles = [
  { id: 1, ourName: "Zebra White", supplierBrandName: "Kitchen Crest", isFeatured: true, featuredRank: 1, isActive: true, distributorId: 1, roomScenes: [] },
  { id: 2, ourName: "Alpha Oak", supplierBrandName: "Ashford", isFeatured: true, featuredRank: 2, isActive: true, distributorId: 2, roomScenes: [] },
  { id: 3, ourName: "No Line", supplierBrandName: null, supplierName: "  ", isFeatured: true, featuredRank: 3, isActive: true, distributorId: 9, roomScenes: [] },
  { id: 4, ourName: "Beta Grey", supplierBrandName: "Kitchen Crest", isFeatured: true, featuredRank: 4, isActive: true, distributorId: 1, roomScenes: [] },
  { id: 5, ourName: "Cedar", supplierBrandName: "Ashford", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 2, roomScenes: [] },
  { id: 6, ourName: "Maple", supplierBrandName: "Kitchen Crest", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 1, roomScenes: [] },
  { id: 10, ourName: "Zebra Line", supplierBrandName: "Ashford", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 2, roomScenes: [] },
  { id: 8, ourName: "Unassigned", supplierBrandName: "", supplierName: "", isFeatured: false, featuredRank: 0, isActive: true, distributorId: 8, roomScenes: [] },
  { id: 7, ourName: "Hidden Maple", supplierBrandName: "Kitchen Crest", isFeatured: false, featuredRank: 0, isActive: false, distributorId: 1, roomScenes: [] },
  { id: 11, ourName: "Willow", supplierBrandName: "Ashford", isFeatured: false, featuredRank: 0, isActive: false, distributorId: 2, roomScenes: [] },
  { id: 9, ourName: "Retired", supplierBrandName: null, supplierName: null, isFeatured: false, featuredRank: 0, isActive: false, distributorId: 8, roomScenes: [] },
];

vi.mock("@/lib/trpc", () => {
  const mut = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  const q = (path: string) => () => ({
    data: path.includes("listForAdmin") ? styles : path.includes("skuCounts") ? [] : path.includes("listDoorMeasurementSubmissions") ? [] : undefined,
    isLoading: false,
  });
  const make = (path: string): unknown => new Proxy(() => {}, {
    get: (_t, k: string) => {
      if (k === "useQuery") return q(path);
      if (k === "useMutation") return mut;
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

afterEach(cleanup);

function namesIn(testId: string) {
  return Array.from(screen.getByTestId(testId).querySelectorAll('[data-testid="door-style-name"]')).map((node) => node.textContent);
}

describe("admin door selector distributor sort", () => {
  it("keeps saved order until a distributor sort is chosen, then sorts every list on this page", () => {
    render(<FeaturedStylesAdmin />);
    expect(namesIn("featured-door-style-list")).toEqual(["Zebra White", "Alpha Oak", "No Line", "Beta Grey"]);
    expect(namesIn("all-door-style-list")).toEqual(["Cedar", "Maple", "Unassigned", "Zebra Line"]);
    expect(namesIn("inactive-door-style-list")).toEqual(["Hidden Maple", "Retired", "Willow"]);
    expect((screen.getAllByLabelText("Move up")[1] as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("distributor-sort-reorder-hint")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Distributor A-Z" }));
    expect(namesIn("featured-door-style-list")).toEqual(["Alpha Oak", "Zebra White", "Beta Grey", "No Line"]);
    expect(namesIn("all-door-style-list")).toEqual(["Cedar", "Zebra Line", "Maple", "Unassigned"]);
    expect(namesIn("inactive-door-style-list")).toEqual(["Willow", "Hidden Maple", "Retired"]);
    expect(screen.getByTestId("distributor-sort-reorder-hint").textContent).toMatch(/manual order/i);
    for (const button of screen.getAllByLabelText("Move up")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of screen.getAllByLabelText("Move down")) expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Distributor Z-A" }));
    expect(namesIn("featured-door-style-list")).toEqual(["Zebra White", "Beta Grey", "Alpha Oak", "No Line"]);
    expect(namesIn("all-door-style-list")).toEqual(["Maple", "Cedar", "Zebra Line", "Unassigned"]);
    expect(namesIn("inactive-door-style-list")).toEqual(["Hidden Maple", "Willow", "Retired"]);

    fireEvent.click(screen.getByRole("button", { name: "Manual order" }));
    expect(namesIn("featured-door-style-list")).toEqual(["Zebra White", "Alpha Oak", "No Line", "Beta Grey"]);
    expect((screen.getAllByLabelText("Move up")[1] as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("distributor-sort-reorder-hint")).toBeNull();
  });

  it("hides the WalzCraft match card until the door edit screen, where approval still works", () => {
    render(<FeaturedStylesAdmin />);
    expect(screen.queryByText(/WalzCraft match/i)).toBeNull();
    expect(screen.queryByTestId("walzcraft-only-matches")).toBeNull();
    expect(screen.queryByText(/Distributor brochure/i)).toBeNull();
    expect(screen.queryByText(/Current site photo/i)).toBeNull();

    fireEvent.click(screen.getAllByLabelText("Edit style")[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('[data-testid="edit-dialog-walzcraft-match"]')).toBeTruthy();
    expect(dialog.textContent).toMatch(/WalzCraft match/i);
    const approve = dialog.querySelector('[data-testid^="walz-approve-"]') as HTMLButtonElement;
    expect(approve).toBeTruthy();
    fireEvent.click(approve);
    expect(dialog.querySelector('[data-testid^="walz-approve-"]')?.textContent).toBe("Approved");
  });

  it("is not added to other logged-in door lists", () => {
    const vendor = readFileSync(resolve(process.cwd(), "client/src/pages/VendorPortal.tsx"), "utf8");
    const publicDoorStyles = readFileSync(resolve(process.cwd(), "client/src/pages/DoorStyles.tsx"), "utf8");
    expect(vendor).not.toContain("door-style-distributor-sort");
    expect(vendor).not.toContain("Distributor A-Z");
    expect(publicDoorStyles).not.toContain("door-style-distributor-sort");
    expect(publicDoorStyles).not.toContain("sortDoorStylesByDistributor");
  });
});
