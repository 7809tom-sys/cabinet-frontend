// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CabinetAttributesDialog } from "./CabinetAttributesDialog";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/design/RollOutTrayPicker", () => ({
  RollOutTrayPicker: () => null,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    masterSku: {
      getAliasesForCabinet: { useQuery: () => ({ data: [] }) },
      similarForCabinet: { useQuery: () => ({ data: [] }) },
      confirmCabinetLink: { useMutation: () => ({ mutate: vi.fn() }) },
    },
    useUtils: () => ({
      masterSku: {
        getAliasesForCabinet: { invalidate: vi.fn() },
        similarForCabinet: { invalidate: vi.fn() },
      },
    }),
  },
}));

beforeAll(() => {
  // jsdom has no matchMedia; the dialog's responsive hook observes this browser API.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(cleanup);

const wallCabinet = {
  uid: "w3024",
  cabinetId: 1,
  masterCode: "W3024",
  description: "30 inch by 24 inch wall cabinet",
  placement: "wall",
  x: 0,
  y: 0,
  width: 30,
  height: 24,
  depth: 12,
  numberOfDoors: 2,
  numberOfDrawers: 0,
} as any;

function renderDialog(onSetMountBottom = vi.fn(), onSetHandleSide = vi.fn(), onApplyHandleSideToAll?: ReturnType<typeof vi.fn>, hardwareApplyCount = 0, cabinet = wallCabinet, onSetIslandWallBaseTreatment = vi.fn(), onSetRefrigeratorSidePanels = vi.fn()) {
  const onMoveInOut = vi.fn();
  render(
    <CabinetAttributesDialog
      cabinet={cabinet}
      open
      onOpenChange={vi.fn()}
      customFee={0}
      onSetWidth={vi.fn()}
      onSetHeight={vi.fn()}
      onSetDepth={vi.fn()}
      mountBottom={72}
      maxMountBottom={72}
      onSetMountBottom={onSetMountBottom}
      onMoveInOut={onMoveInOut}
      onResetSize={vi.fn()}
      onSetSwing={vi.fn()}
      onSetNoDoor={vi.fn()}
      onSetHandleSide={onSetHandleSide}
      onApplyHandleSideToAll={onApplyHandleSideToAll}
      hardwareApplyCount={hardwareApplyCount}
	      designStyleId={null}
	      distributorId={null}
	      pricingTier="homeowner"
	      onSetRolloutQty={vi.fn()}
      onSetGlassDoor={vi.fn()}
      onSetDecorativeEnd={vi.fn()}
      glassDoorAvailable={false}
      onAddGlassDoorToCart={vi.fn()}
      onSetBlindPull={vi.fn()}
      onSetWaterfall={vi.fn()}
      onSetCategory={vi.fn()}
	      onSetCustomProfile={vi.fn()}
	      onSetOvenType={vi.fn()}
	      onSetIslandWallBaseTreatment={onSetIslandWallBaseTreatment}
	      onSetRefrigeratorSidePanels={onSetRefrigeratorSidePanels}
	    />
	  );
	  return { onSetMountBottom, onMoveInOut, onSetHandleSide, onSetIslandWallBaseTreatment, onSetRefrigeratorSidePanels };
}

describe("CabinetAttributesDialog wall cabinet elevation controls", () => {
  it("keeps optional cabinet controls compact until More cabinet options is opened", () => {
    renderDialog();
    const dialog = screen.getAllByRole("dialog").at(-1)!;
    const options = within(dialog).getByTestId("cabinet-attributes-more-options") as HTMLDetailsElement;
    expect(options.open).toBe(false);
    expect(within(dialog).getByText("More cabinet options")).toBeTruthy();
		expect(within(dialog).getByLabelText("Open optional cabinet settings")).toBeTruthy();
		expect(within(dialog).getByTestId("cabinet-attributes-door-hardware")).toBeTruthy();
		expect(within(dialog).getByText("Hardware placement")).toBeTruthy();
		expect(within(dialog).queryByText("Door & Drawer Layout")).toBeNull();

    fireEvent.click(within(options).getByText("More cabinet options"));
    expect(options.open).toBe(true);
    expect(within(options).getByText("Elevation position")).toBeTruthy();
    expect(within(options).queryByText("Hardware placement")).toBeNull();
  });

  it("exposes right-click up/down mounting controls and sends the selected height", () => {
    const { onSetMountBottom, onMoveInOut } = renderDialog();
    fireEvent.click(screen.getByText("More cabinet options"));
    expect(screen.getByText("End Panel Treatment")).toBeTruthy();
    expect((screen.getByLabelText("Cabinet mounting height from floor") as HTMLInputElement).value).toBe("72");
    fireEvent.click(screen.getByTitle("Move down one inch"));
    expect(onSetMountBottom).toHaveBeenCalledWith("w3024", 71);
    fireEvent.click(screen.getByText("Reset 54″"));
    expect(onSetMountBottom).toHaveBeenCalledWith("w3024", 54);
    fireEvent.change(screen.getByLabelText("Cabinet mounting height from floor"), { target: { value: "65" } });
    expect(onSetMountBottom).toHaveBeenCalledWith("w3024", 65);
	    fireEvent.click(screen.getByTitle("Move out 1 inches toward the wall"));
	    fireEvent.click(screen.getByTitle("Move in 1 inches into the room"));
	    expect(onMoveInOut).toHaveBeenNthCalledWith(1, "w3024", "out", 1);
    expect(onMoveInOut).toHaveBeenNthCalledWith(2, "w3024", "in", 1);
  });

  it("offers knee-drawer mounting presets and a standard 34.5-inch base-body top alignment action", () => {
    const onSetMountBottom = vi.fn();
    const kneeDrawer = {
      ...wallCabinet,
      uid: "knee-drawer",
      masterCode: "SW-VKD36",
      description: "Knee Drawer - 36 inch wide",
      category: "Accessory",
      subCategory: "Drawer",
      placement: "baseTop",
      height: 7,
      depth: 21,
      numberOfDoors: 0,
      numberOfDrawers: 1,
    } as never;
    renderDialog(onSetMountBottom, vi.fn(), undefined, 0, kneeDrawer);
    fireEvent.click(screen.getByText("More cabinet options"));
    expect(screen.getByText("Knee-drawer position")).toBeTruthy();
    expect(screen.getByTestId("knee-drawer-height-presets")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "24″" }));
    fireEvent.click(screen.getByRole("button", { name: "30″" }));
    fireEvent.click(screen.getByRole("button", { name: "Align top 34.5″" }));
	    expect(onSetMountBottom).toHaveBeenNthCalledWith(1, "knee-drawer", 24);
	    expect(onSetMountBottom).toHaveBeenNthCalledWith(2, "knee-drawer", 30);
	    expect(onSetMountBottom).toHaveBeenNthCalledWith(3, "knee-drawer", 27.5);
	  });

	  it("adds or removes both refrigerator side panels directly from properties", () => {
	    const onSetRefrigeratorSidePanels = vi.fn();
	    const refrigerator = {
	      ...wallCabinet,
	      uid: "fridge-36",
	      masterCode: "FRIDGE-36",
	      description: "36 inch refrigerator",
	      placement: "appliance",
	      width: 36,
	      depth: 24,
	      height: 70,
	      refrigeratorPanelMode: "none",
	    } as never;
	    renderDialog(vi.fn(), vi.fn(), undefined, 0, refrigerator, vi.fn(), onSetRefrigeratorSidePanels);
	    const panelToggle = screen.getByRole("switch", { name: "Add refrigerator side panels" });
	    expect(panelToggle.getAttribute("data-state")).toBe("unchecked");
	    fireEvent.click(panelToggle);
	    expect(onSetRefrigeratorSidePanels).toHaveBeenCalledWith("fridge-36", true);
	    expect(screen.getByTestId("refrigerator-side-panel-toggle").textContent).toContain("Add both finished side panels");
	  });

	  it("mounts safely when a cabinet becomes selected after an initially empty dialog", () => {
    const props = {
      onOpenChange: vi.fn(), customFee: 0, onSetWidth: vi.fn(), onSetHeight: vi.fn(), onSetDepth: vi.fn(),
      mountBottom: 72, maxMountBottom: 72, onSetMountBottom: vi.fn(), onResetSize: vi.fn(), onSetSwing: vi.fn(),
      onMoveInOut: vi.fn(),
	      onSetNoDoor: vi.fn(), onSetHandleSide: vi.fn(), designStyleId: null, distributorId: null, pricingTier: "homeowner" as const,
      onSetRolloutQty: vi.fn(), onSetGlassDoor: vi.fn(), onSetDecorativeEnd: vi.fn(), glassDoorAvailable: false,
      onAddGlassDoorToCart: vi.fn(), onSetBlindPull: vi.fn(), onSetWaterfall: vi.fn(), onSetCategory: vi.fn(),
      onSetCustomProfile: vi.fn(), onSetOvenType: vi.fn(), onSetIslandWallBaseTreatment: vi.fn(),
    };
    const { rerender } = render(<CabinetAttributesDialog cabinet={null} open={false} {...props} />);

    expect(() => rerender(<CabinetAttributesDialog cabinet={wallCabinet} open {...props} />)).not.toThrow();
  });

  it("keeps every door on a framed edge while offering automatic, left, right, and paired-door choices", () => {
    const { onSetHandleSide } = renderDialog();
    const dialog = screen.getAllByRole("dialog").at(-1)!;
    const attributes = within(dialog);
    expect(attributes.getAllByText("Hardware placement").length).toBeGreaterThan(0);
    expect(attributes.getByText(/exactly 1.5 inches from the selected edge/i)).toBeTruthy();
    expect(attributes.queryByRole("button", { name: "Center" })).toBeNull();
    fireEvent.click(attributes.getByRole("button", { name: "dt_ca_left" }));
    fireEvent.click(attributes.getByRole("button", { name: "dt_ca_right" }));
    fireEvent.click(attributes.getByRole("button", { name: "Automatic" }));
    fireEvent.click(attributes.getByRole("button", { name: "Paired doors — pulls at the center meeting edge" }));
    expect(onSetHandleSide).toHaveBeenNthCalledWith(1, "w3024", "left");
    expect(onSetHandleSide).toHaveBeenNthCalledWith(2, "w3024", "right");
    expect(onSetHandleSide).toHaveBeenNthCalledWith(3, "w3024", "auto");
    expect(onSetHandleSide).toHaveBeenNthCalledWith(4, "w3024", "paired");
  });

  it("offers a centered top-rail pull only for the requested B15/B18 base family", () => {
    const onSetHandleSide = vi.fn();
    const b15 = { ...wallCabinet, uid: "b15", masterCode: "B15", placement: "base", width: 15, numberOfDoors: 1 } as never;
    renderDialog(vi.fn(), onSetHandleSide, undefined, 0, b15);
    const dialog = screen.getAllByRole("dialog").at(-1)!;
    const choice = within(dialog).getByRole("switch", { name: "Move B15/B18 door handle to top center" });
    fireEvent.click(choice);
    expect(onSetHandleSide).toHaveBeenCalledWith("b15", "top-center");
  });

  it("exposes the same visible top-center handle toggle for B18", () => {
    const onSetHandleSide = vi.fn();
    const b18 = { ...wallCabinet, uid: "b18", masterCode: "B18", placement: "base", width: 18, numberOfDoors: 1 } as never;
    renderDialog(vi.fn(), onSetHandleSide, undefined, 0, b18);
    const dialog = screen.getAllByRole("dialog").at(-1)!;
    const choice = within(dialog).getByRole("switch", { name: "Move B15/B18 door handle to top center" });
    fireEvent.click(choice);
    expect(onSetHandleSide).toHaveBeenCalledWith("b18", "top-center");
  });

  it("shows the automatic upward-pull rule without the former handle toggle for an island wall cabinet", () => {
    const onSetHandleSide = vi.fn();
    const onSetIslandWallBaseTreatment = vi.fn();
    const islandWall = { ...wallCabinet, uid: "island-wall", masterCode: "W2430", height: 30, numberOfDoors: 2, islandFace: "front", islandCounterHeightWallCabinet: true } as never;
    renderDialog(vi.fn(), onSetHandleSide, undefined, 0, islandWall, onSetIslandWallBaseTreatment);
    const dialog = screen.getAllByRole("dialog").at(-1)!;
    expect(within(dialog).getByTestId("island-wall-cabinet-base-treatment")).toBeTruthy();
    expect(within(dialog).getByTestId("island-base-preview-toe-kick")).toBeTruthy();
    expect(within(dialog).getByTestId("island-base-preview-base-molding")).toBeTruthy();
    expect(within(dialog).getByLabelText("Learn about island base finishes")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /base molding/i }));
    expect(onSetIslandWallBaseTreatment).toHaveBeenCalledWith("island-wall", "base-molding");
    expect(within(dialog).getByTestId("automatic-raised-floor-wall-pull")).toBeTruthy();
    expect(within(dialog).getByText(/keeps each vertical pull on its existing hinge-aware door rail/i)).toBeTruthy();
    expect(within(dialog).queryByRole("switch", { name: /island wall cabinet door handle/i })).toBeNull();
    expect(onSetHandleSide).not.toHaveBeenCalled();
  });

  it("uses the same automatic upward-pull rule for a non-island wall cabinet seated on the 4½-inch toe kick", () => {
    const floorWall = { ...wallCabinet, uid: "floor-wall", masterCode: "W1830", mountBottom: 4.5, hardwarePosition: "top-center" } as never;
    const onSetHandleSide = vi.fn();
    renderDialog(vi.fn(), onSetHandleSide, undefined, 0, floorWall);
    const dialog = screen.getAllByRole("dialog").at(-1)!;
    expect(within(dialog).getByTestId("automatic-raised-floor-wall-pull")).toBeTruthy();
    expect(within(dialog).queryByRole("switch", { name: /handle/i })).toBeNull();
    expect(onSetHandleSide).not.toHaveBeenCalled();
  });

  it("confirms before applying the selected door hardware position to every eligible cabinet", () => {
    const onApplyHandleSideToAll = vi.fn();
    renderDialog(vi.fn(), vi.fn(), onApplyHandleSideToAll, 4);
    const dialog = screen.getAllByRole("dialog").at(-1)!;
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply to All Cabinets" }));
    expect(screen.getByText(/apply Automatic to 4 eligible cabinets/i)).toBeTruthy();
    expect(screen.getByText(/every drawer pull remains centered automatically/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply to 4 cabinets" }));
    expect(onApplyHandleSideToAll).toHaveBeenCalledWith("auto");
  });
});
