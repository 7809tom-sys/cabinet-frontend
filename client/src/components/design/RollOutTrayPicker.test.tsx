// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RollOutTrayPicker } from "./RollOutTrayPicker";

const useQuery = vi.fn();

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string, vars?: Record<string, unknown>) => key === "dt_ca_rollout_hint" ? `Fits ${vars?.size}\" cabinets` : key,
  }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: { design: { resolveRollOutTray: { useQuery: (...args: unknown[]) => useQuery(...args) } } },
}));

const tray = {
  cabinetId: 81,
  masterCode: "RS-18",
  description: "18-inch rollout tray",
  width: 18,
  platformSku: "ASH-RS18",
  listPrice: "100.00",
  adjustedListPrice: "95.00",
  homeownerPrice: "90.00",
  contractorPrice: "70.00",
  wholesalePrice: "55.00",
};

const base18 = {
  uid: "base-18",
  cabinetId: 18,
  masterCode: "B18",
  description: "18-inch base cabinet",
  placement: "base",
  category: "Base",
  subCategory: "Single Door Base",
  x: 0,
  y: 0,
  width: 18,
  nominalWidth: 18,
  height: 34.5,
  depth: 24,
  numberOfDoors: 1,
  numberOfDrawers: 1,
};

afterEach(() => {
  useQuery.mockReset();
});

describe("RollOutTrayPicker", () => {
	it("shows selected-tier pricing and enforces the one-to-five quantity range for an 18-inch base", () => {
	  useQuery.mockReturnValue({ data: { ...tray, cabinetId: 10920002, masterCode: "UNIV-ROT18", platformSku: "UNIV-ROT18-S330002-D210001", listPrice: "44.52", adjustedListPrice: null, homeownerPrice: "73.46", contractorPrice: "57.43", wholesalePrice: "55.65" }, isLoading: false, isFetching: false });
	  const onSetQty = vi.fn();
	  const { rerender } = render(
	    <RollOutTrayPicker cabinet={base18 as never} designStyleId={330002} distributorId={210001} pricingTier="homeowner" qty={4} onSetQty={onSetQty} />,
	  );

	  expect(screen.getByText(/\$73\.46/)).toBeTruthy();
	  expect(screen.getByText(/UNIV-ROT18/)).toBeTruthy();
	  expect(useQuery).toHaveBeenCalledWith(
	    { styleId: 330002, width: 18, distributorId: 210001 },
	    expect.objectContaining({ enabled: true, retry: 2, staleTime: 0, refetchOnMount: "always" }),
	  );
	  fireEvent.click(screen.getByRole("button", { name: "dt_ca_rollout_qty +" }));
    expect(onSetQty).toHaveBeenCalledWith(5);

	  rerender(<RollOutTrayPicker cabinet={base18 as never} designStyleId={330002} distributorId={210001} pricingTier="homeowner" qty={5} onSetQty={onSetQty} />);
    expect(screen.getByRole("button", { name: "dt_ca_rollout_qty +" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("spinbutton", { name: "dt_ca_rollout_qty" }), { target: { value: "99" } });
    expect(onSetQty).toHaveBeenLastCalledWith(5);
    fireEvent.change(screen.getByRole("spinbutton", { name: "dt_ca_rollout_qty" }), { target: { value: "0" } });
    expect(onSetQty).toHaveBeenLastCalledWith(0);
  });

  it("renders for an eligible pantry and uses the same distributor/style tray query", () => {
    useQuery.mockReturnValue({ data: { ...tray, masterCode: "RS-24", width: 24 }, isLoading: false });
    const pantry = { ...base18, uid: "pantry-24", masterCode: "P2496", placement: "tall", subCategory: "Pantry / Utility", width: 24, nominalWidth: 24, height: 96, numberOfDoors: 4 } as never;
	    render(<RollOutTrayPicker cabinet={pantry} designStyleId={14} distributorId={6} pricingTier="contractor" qty={1} onSetQty={vi.fn()} />);
	    expect(screen.getByText(/RS-24/)).toBeTruthy();
	    expect(screen.getByText(/\$70\.00/)).toBeTruthy();
    expect(useQuery).toHaveBeenCalledWith(
      { styleId: 14, width: 24, distributorId: 6 },
      expect.objectContaining({ enabled: true }),
    );
  });

  it("shows the Clark & Son universal tray and exact owner-supplied price for an Aura Cream B21", () => {
    useQuery.mockReturnValue({
      data: {
        ...tray,
        cabinetId: 210021,
        masterCode: "UNIV-ROT21",
        description: "Universal rollout tray for 21-inch cabinet",
        width: 21,
        platformSku: "UNIV-ROT21-S330002-D210001",
        listPrice: "46.27",
        adjustedListPrice: null,
        homeownerPrice: "46.27",
        contractorPrice: "46.27",
        wholesalePrice: "46.27",
      },
      isLoading: false,
    });
    const b21 = { ...base18, uid: "aura-b21", masterCode: "B-21", width: 21, nominalWidth: 21 } as never;

    render(
      <RollOutTrayPicker
        cabinet={b21}
        designStyleId={330002}
        distributorId={210001}
        pricingTier="contractor"
        qty={1}
        onSetQty={vi.fn()}
      />,
    );

    expect(screen.getByText(/UNIV-ROT21/)).toBeTruthy();
    expect(screen.getByText(/\$46\.27/)).toBeTruthy();
    expect(useQuery).toHaveBeenCalledWith(
      { styleId: 330002, width: 21, distributorId: 210001 },
      expect.objectContaining({ enabled: true }),
    );
  });

	it("renders no controls below 18 inches, above 36 inches, or for an appliance tower", () => {
    useQuery.mockReturnValue({ data: tray, isLoading: false });
    const narrow = { ...base18, uid: "base-15", masterCode: "B15", width: 15, nominalWidth: 15 } as never;
    const { rerender, container } = render(<RollOutTrayPicker cabinet={narrow} designStyleId={4} distributorId={9} pricingTier="homeowner" qty={0} onSetQty={vi.fn()} />);
    expect(container.textContent).toBe("");

	  const ovenTower = { ...base18, uid: "oven-tall", masterCode: "UOC3396", placement: "tall", subCategory: "Oven Cabinet", width: 33, nominalWidth: 33, numberOfDoors: 2 } as never;
	  rerender(<RollOutTrayPicker cabinet={ovenTower} designStyleId={4} distributorId={9} pricingTier="homeowner" qty={0} onSetQty={vi.fn()} />);
	  expect(container.textContent).toBe("");

	  const wideBase = { ...base18, uid: "base-39", masterCode: "B39", width: 39, nominalWidth: 39 } as never;
	  rerender(<RollOutTrayPicker cabinet={wideBase} designStyleId={4} distributorId={9} pricingTier="homeowner" qty={0} onSetQty={vi.fn()} />);
	  expect(container.textContent).toBe("");

	  const widePantry = { ...base18, uid: "pantry-39", masterCode: "P3996", placement: "tall", subCategory: "Pantry / Utility", width: 39, nominalWidth: 39, numberOfDoors: 4 } as never;
	  rerender(<RollOutTrayPicker cabinet={widePantry} designStyleId={4} distributorId={9} pricingTier="homeowner" qty={0} onSetQty={vi.fn()} />);
	  expect(container.textContent).toBe("");
	});
});
