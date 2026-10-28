// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { changedCabinetVisibilityFlags } from "./CabinetConfigAdmin";

const harness = vi.hoisted(() => {
  const updateCabinet = vi.fn();
  const submitMasterChange = vi.fn();
  const row = {
    id: 42,
    masterCode: "LWR3015",
    description: "30 inch lower wine rack",
    category: "Accessories",
    subCategory: null,
    width: "30",
    height: "34.5",
    depth: "24",
    numberOfDoors: 0,
    numberOfDrawers: 0,
    numberOfFixedShelves: null,
    numberOfAdjShelves: null,
    altSku1: null,
    altSku2: null,
    altSku3: null,
    showInCatalog: true,
    showInDesigner: true,
    designerEligible: true,
    showIn2020: true,
    isActive: true,
    isNotCabinet: false,
    catalogImageUrl: null,
    weight: null,
    physicalWidth: null,
    pkgLength: null,
    pkgWidth: null,
    pkgHeight: null,
    pkgWeight: null,
    minPull: null,
    maxPull: null,
    openingWidth: null,
    openingHeight: null,
    openingType: null,
    doorHeight: null,
    drawerHeight: null,
    cornerType: null,
    shelfRadius: null,
    shelfCount: null,
    cabinetSquare: null,
    faceWidth: null,
    legWidth: null,
    configuredAt: null,
    configVerified: false,
    configVerifiedAt: null,
    doorOrientation: null,
    doorsPerRow: null,
    drawerLayout: null,
    grainDirection: null,
    isDecorativeDoor: false,
    layoutSpec: null,
    specImageUrl: null,
    specNotes: null,
  };
  return { updateCabinet, submitMasterChange, row };
});

function queryResult(data: unknown) {
  return { data, isLoading: false, error: null, refetch: vi.fn() };
}

function procedure(path: string[]): unknown {
  const key = path.join(".");
  return new Proxy(function noop() {}, {
    get(_target, prop) {
      if (prop === "useQuery") {
        return () => {
          if (key === "cabinets.adminListCabinetConfig") {
            return queryResult({ rows: [harness.row], total: 1 });
          }
          if (key === "cabinetCategories.list") {
            return queryResult([
              { name: "Accessory", subCategories: [] },
              { name: "Base", subCategories: [] },
            ]);
          }
          if (key === "cabinets.getDistributorsForCabinet") return queryResult([]);
          if (key === "distributors.list") return queryResult([]);
          if (key === "masterSku.getAliasesForCabinet") return queryResult([]);
          if (key === "cabinetOverrides.configForCabinet") return queryResult([]);
          if (key === "cabinetOverrides.configHistory") return queryResult({ changes: [], saves: [], days: 5 });
          return queryResult(undefined);
        };
      }
      if (prop === "useMutation") {
        return () => {
          if (key === "cabinets.adminUpdateCabinet") return { mutate: harness.updateCabinet, isPending: false };
          if (key === "masterChanges.submit") return { mutate: harness.submitMasterChange, isPending: false };
          return { mutate: vi.fn(), isPending: false };
        };
      }
      if (prop === "invalidate") return vi.fn();
      if (typeof prop !== "string") return undefined;
      return procedure([...path, prop]);
    },
  });
}

vi.mock("@/lib/trpc", () => ({
  trpc: new Proxy({}, {
    get(_target, prop) {
      if (prop === "useUtils") return () => procedure([]);
      if (typeof prop !== "string") return undefined;
      return procedure([prop]);
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), message: vi.fn() },
}));

vi.mock("./CabinetAvailabilityPanel", () => ({ CabinetAvailabilityPanel: () => null }));
vi.mock("./CabinetConfigHistoryPanel", () => ({ CabinetConfigHistoryPanel: () => null }));
vi.mock("@/components/design/DoorDrawerDiagram", () => ({ DoorDrawerDiagram: () => null }));

import { CabinetConfigAdmin } from "./CabinetConfigAdmin";

beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => undefined;
  proto.releasePointerCapture ??= () => undefined;
  proto.scrollIntoView ??= () => undefined;
});

afterEach(() => {
  cleanup();
  harness.updateCabinet.mockClear();
  harness.submitMasterChange.mockClear();
});

function rowElement() {
  const code = screen.getByText("LWR3015");
  const row = code.closest("tr");
  if (!row) throw new Error("cabinet row not found");
  return row;
}

describe("changedCabinetVisibilityFlags", () => {
  const original = {
    isActive: true,
    showInCatalog: true,
    showInDesigner: true,
    designerEligible: true,
    showIn2020: false,
    configVerified: false,
  };

  it("omits flags the admin did not change", () => {
    expect(changedCabinetVisibilityFlags(original, { ...original, showInDesigner: false })).toEqual({
      showInDesigner: false,
    });
  });

  it("omits every flag when the draft matches the opened row", () => {
    expect(changedCabinetVisibilityFlags(original, original)).toEqual({});
  });
});

describe("Cabinet Config edit flow", () => {
  it("opens the editor when the row is clicked and ignores the checkbox", () => {
    render(<CabinetConfigAdmin />);
    const row = rowElement();
    expect(row.className).toContain("cursor-pointer");

    fireEvent.click(within(row).getByRole("checkbox"));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(within(row).getByText("30 inch lower wine rack"));
    expect(screen.getByRole("dialog", { name: "LWR3015" })).toBeTruthy();
  });

  it("opens the editor from the pencil", () => {
    render(<CabinetConfigAdmin />);
    fireEvent.click(within(rowElement()).getByRole("button", { name: "Edit LWR3015" }));
    expect(screen.getByRole("dialog", { name: "LWR3015" })).toBeTruthy();
  });

  it("renders a category option for a stored value missing from the list", () => {
    render(<CabinetConfigAdmin />);
    fireEvent.click(within(rowElement()).getByText("30 inch lower wine rack"));
    const dialog = screen.getByRole("dialog", { name: "LWR3015" });
    const categoryBlock = within(dialog).getByText("Category", { selector: "label" }).parentElement;
    if (!categoryBlock) throw new Error("category field not found");
    fireEvent.keyDown(within(categoryBlock).getByRole("combobox"), { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Accessories" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Accessory" })).toBeTruthy();
  });

  it("sends only the visibility flag the admin changed", () => {
    render(<CabinetConfigAdmin />);
    fireEvent.click(within(rowElement()).getByText("30 inch lower wine rack"));
    const dialog = screen.getByRole("dialog", { name: "LWR3015" });
    const label = within(dialog).getByText("Show in Designer");
    const switchRow = label.closest("div.flex");
    if (!(switchRow instanceof HTMLElement)) throw new Error("Show in Designer switch not found");
    fireEvent.click(within(switchRow).getByRole("switch"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(harness.updateCabinet).toHaveBeenCalledTimes(1);
    const payload = harness.updateCabinet.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.showInDesigner).toBe(false);
    expect(payload).not.toHaveProperty("isActive");
    expect(payload).not.toHaveProperty("showInCatalog");
    expect(payload).not.toHaveProperty("designerEligible");
    expect(payload).not.toHaveProperty("showIn2020");
    expect(payload).not.toHaveProperty("configVerified");
  });

  it("requests a master change when no distributor carries the cabinet", () => {
    render(<CabinetConfigAdmin />);
    fireEvent.click(within(rowElement()).getByText("30 inch lower wine rack"));
    const dialog = screen.getByRole("dialog", { name: "LWR3015" });
    fireEvent.change(within(dialog).getByPlaceholderText("Enter cabinet description…"), {
      target: { value: "Lower wine rack" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    const scope = screen.getByTestId("cabinet-config-save-scope");
    expect(within(scope).getByRole("button", { name: /Save for/ }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(within(scope).getByRole("button", { name: "Request master change" }));

    expect(harness.submitMasterChange).toHaveBeenCalledTimes(1);
    expect(harness.submitMasterChange).toHaveBeenCalledWith({
      cabinetId: 42,
      sourceDistributorId: null,
      proposed: { description: "Lower wine rack" },
    });
    expect(harness.updateCabinet).not.toHaveBeenCalled();
  });
});
