// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectiveIslandOverhangIn, IslandAttributesDialog } from "./IslandAttributesDialog";

afterEach(cleanup);

const island = {
  x: 36,
  y: 36,
  width: 72,
  depth: 48,
  activeFace: "front" as const,
  countertopWidth: 78,
  countertopDepth: 54,
  countertopOffsetX: 0,
  countertopOffsetY: 0,
};

describe("IslandAttributesDialog", () => {
  it("keeps every work-zone and slab dimension editable and can return slab width to automatic", () => {
    const onApply = vi.fn();
    render(<IslandAttributesDialog open island={island} onOpenChange={vi.fn()} onApply={onApply} onRotate={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Left position (in.)"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("Slab left-to-right (in.)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ x: 42, countertopWidth: null, countertopDepth: 54 }));
  });

  it("accepts an exact island countertop overhang and can return it to the 1.5-inch default", () => {
	    const onApply = vi.fn();
	    render(<IslandAttributesDialog open island={island} onOpenChange={vi.fn()} onApply={onApply} onRotate={vi.fn()} onRemove={vi.fn()} />);
	    const overhang = screen.getByLabelText("Standard countertop overhang (in.)");
	    fireEvent.change(overhang, { target: { value: "3.125" } });
	    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
	    expect(onApply).toHaveBeenLastCalledWith(expect.objectContaining({ countertopOverhang: 3.125 }));
	    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
	    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
	    expect(onApply).toHaveBeenLastCalledWith(expect.objectContaining({ countertopOverhang: null }));
	    expect(screen.getByTestId("island-countertop-overhang-control")).toBeTruthy();
	  });

	  it("warns immediately when the front overhang exceeds the 1½-inch cabinet-front maximum", () => {
	    render(<IslandAttributesDialog open island={{ ...island, countertopOverhang: 3.125 }} onOpenChange={vi.fn()} onApply={vi.fn()} onRotate={vi.fn()} onRemove={vi.fn()} />);
	    const warning = screen.getByTestId("island-front-overhang-warning");
    expect(warning.getAttribute("role")).toBe("alert");
	    expect(warning.textContent).toContain("3.125 in.");
	    expect(warning.textContent).toContain("1.625 in.");
	    expect(warning.textContent).toContain("1½ in. maximum cabinet-front overhang");
	  });

	  it("warns with the selected material, verified limit, and exact structural excess", () => {
	    render(
	      <IslandAttributesDialog
	        open
	        island={{ ...island, countertopWidth: null, countertopDepth: null, countertopOverhang: 6 }}
	        countertopMaterial={{ name: "Verified Quartz", unsupportedOverhangLimitIn: 4 }}
	        onOpenChange={vi.fn()}
	        onApply={vi.fn()}
	        onRotate={vi.fn()}
	        onRemove={vi.fn()}
	      />,
	    );
	    fireEvent.click(screen.getByText(/Overhang support/i));
	    const warning = screen.getByTestId("island-overhang-limit-exceeded").textContent ?? "";
	    expect(warning).toContain("Verified Quartz");
	    expect(warning).toContain("6 in.");
	    expect(warning).toContain("4 in.");
	    expect(warning).toContain("2 in.");
    expect(screen.getByTestId("island-overhang-limit-exceeded").getAttribute("role")).toBe("alert");
	  });

	  it("shows verified-safe and unverified material guidance without inventing a limit", () => {
	    const props = { open: true, island: { ...island, countertopWidth: null, countertopDepth: null, countertopOverhang: 3 }, onOpenChange: vi.fn(), onApply: vi.fn(), onRotate: vi.fn(), onRemove: vi.fn() };
	    const view = render(<IslandAttributesDialog {...props} countertopMaterial={{ name: "Verified Quartz", unsupportedOverhangLimitIn: 4 }} />);
	    expect(screen.getByTestId("island-overhang-limit-within").textContent).toContain("4 in.");
	    view.rerender(<IslandAttributesDialog {...props} countertopMaterial={{ name: "Pending Quartz", unsupportedOverhangLimitIn: null }} />);
	    const unverified = screen.getByTestId("island-overhang-limit-unverified").textContent ?? "";
	    expect(unverified).toContain("Pending Quartz");
	    expect(unverified).toContain("does not yet have a verified");
	    expect(unverified).not.toMatch(/limit of \d/i);
	  });

	  it("checks the largest unsupported edge when an exact slab is offset for seating", () => {
	    expect(effectiveIslandOverhangIn({ ...island, countertopWidth: 78, countertopDepth: 60, countertopOffsetY: -6 })).toBe(12);
	  });

	  it("exposes complete-assembly rotate and remove actions on the responsive dialog", () => {
    const onRotate = vi.fn();
    const onRemove = vi.fn();
    render(<IslandAttributesDialog open island={island} onOpenChange={vi.fn()} onApply={vi.fn()} onRotate={onRotate} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Rotate 45°" }));
    fireEvent.click(screen.getByRole("button", { name: "Rotate 90°" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove island" }));
    expect(onRotate).toHaveBeenNthCalledWith(1, 45);
    expect(onRotate).toHaveBeenNthCalledWith(2, 90);
    expect(onRemove).toHaveBeenCalledTimes(1);
		    expect(screen.getByText(/countertop coverage update automatically/i)).toBeTruthy();
		  });

	  it("shows current finished island clearance including its saved rotation", () => {
	    render(
	      <IslandAttributesDialog
	        open
	        island={{ ...island, rotation: 45 }}
	        clearance={{ leftIn: 24.5, rightIn: 31.25, backIn: 18, frontIn: 22.75, nearestIn: 18, rotationDegrees: 45 }}
	        onOpenChange={vi.fn()}
	        onApply={vi.fn()}
	        onRotate={vi.fn()}
	        onRemove={vi.fn()}
	      />,
	    );
	    const clearance = screen.getByTestId("island-clearance-calculator").textContent ?? "";
	    expect(clearance).toContain("45°");
	    expect(clearance).toContain("nearest 18″");
	    expect(clearance).toContain("24.5″");
	    expect(clearance).toContain("31.25″");
	  });

		it("keeps depth guidance collapsed while retaining a reachable 12-inch rear seating control", () => {
		  render(<IslandAttributesDialog open island={island} onOpenChange={vi.fn()} onApply={vi.fn()} onRotate={vi.fn()} onRemove={vi.fn()} />);
		  const guidance = screen.getByTestId("island-depth-guidance") as HTMLDetailsElement;
		  expect(guidance.open).toBe(false);
		  fireEvent.click(screen.getByText("Island depth guide"));
		  expect(guidance.open).toBe(true);
		  const guidanceText = guidance.textContent ?? "";
		  expect(guidanceText).toContain("24 in.");
		  expect(guidanceText).toContain("36 in.");
		  expect(guidanceText).toContain("48 in.");
		  expect(guidanceText).toContain("60 in.");
		  expect(screen.getByTestId("island-seating-overhang")).toBeTruthy();
			expect(screen.getByText("Rear seating")).toBeTruthy();
		});

		it("offers 12- and 15-inch seating while preserving the automatic 1.5-inch standard edge", () => {
		  const onApply = vi.fn();
		  render(<IslandAttributesDialog open island={island} onOpenChange={vi.fn()} onApply={onApply} onRotate={vi.fn()} onRemove={vi.fn()} />);
		  fireEvent.click(screen.getByTestId("island-seating-overhang"));
		  fireEvent.click(screen.getByRole("option", { name: /15 in\. behind the back run/i }));
		  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
		    countertopDepth: island.depth + 15,
		    countertopOffsetY: -7.5,
		    countertopDepthAnchoredToZone: true,
		  }));
		});

		it("keeps optional zone and slab dimensions collapsed while leaving every measurement editable", () => {
		  render(<IslandAttributesDialog open island={island} onOpenChange={vi.fn()} onApply={vi.fn()} onRotate={vi.fn()} onRemove={vi.fn()} />);
		  const dimensions = screen.getByTestId("island-advanced-dimensions") as HTMLDetailsElement;
		  expect(dimensions.open).toBe(false);
		  fireEvent.click(screen.getByText(/Measurements/i));
		  expect(dimensions.open).toBe(true);
		  expect(screen.getByLabelText("Slab front-to-back (in.)")).toBeTruthy();
		});

		it("lets the user opt into a Back-face-only depth adjustment without changing other island choices", () => {
		  const onApply = vi.fn();
		  render(<IslandAttributesDialog open island={island} onOpenChange={vi.fn()} onApply={onApply} onRotate={vi.fn()} onRemove={vi.fn()} />);
		  fireEvent.click(screen.getByRole("switch", { name: /auto-adjust depth for Back cabinets/i }));
		  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ autoAdjustDepthForBackFace: true, activeFace: "front", depth: 48 }));
		  expect(screen.getByTestId("island-auto-depth-option")).toBeTruthy();
		});

		it("keeps optional support and preview details collapsed while primary island controls remain direct", () => {
		  render(<IslandAttributesDialog open island={island} onOpenChange={vi.fn()} onApply={vi.fn()} onRotate={vi.fn()} onRemove={vi.fn()} />);
		  const optionalDetails = Array.from(document.querySelectorAll("details")) as HTMLDetailsElement[];
		  expect(optionalDetails.every((detail) => detail.open === false)).toBe(true);
		  expect(screen.getByLabelText("Standard countertop overhang (in.)")).toBeTruthy();
		  expect(screen.getByTestId("island-seating-overhang")).toBeTruthy();
		  expect(screen.getByText("Active placement face")).toBeTruthy();
		  expect(screen.getByLabelText("Island waterfall end")).toBeTruthy();
		  expect(screen.getByRole("switch", { name: /auto-adjust depth for Back cabinets/i })).toBeTruthy();
		});

		it("stores a selected island cabinet color while keeping the perimeter choice separate", () => {
	  const onApply = vi.fn();
	  render(
	    <IslandAttributesDialog
	      open
	      island={{ ...island, cabinetStyleId: null }}
	      cabinetFinishOptions={[{ id: 7, name: "Aero Sage" }, { id: 99, name: "Midnight Navy" }]}
	      perimeterFinishName="Aero Sage"
	      onOpenChange={vi.fn()}
	      onApply={onApply}
	      onRotate={vi.fn()}
	      onRemove={vi.fn()}
	    />,
	  );
	  expect(screen.getByText("Match non-island cabinets (Aero Sage)")).toBeTruthy();
	  fireEvent.click(screen.getByTestId("island-cabinet-finish-select"));
	  fireEvent.click(screen.getByRole("option", { name: "Midnight Navy" }));
	  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ cabinetStyleId: 99 }));
		  expect(screen.getByText("Cabinet color")).toBeTruthy();
		});

		it("stores a separate island countertop product and visual material while preserving the wall countertop", () => {
		  const onApply = vi.fn();
		  render(
		    <IslandAttributesDialog
		      open
		      island={{ ...island, countertopProductId: null, countertopMaterialId: null }}
		      countertopOptions={[
		        { id: 10, name: "Wall Quartz", materialId: "white-quartz", unsupportedOverhangLimitIn: 4 },
		        { id: 11, name: "Island Calacatta", materialId: "carrara-marble", unsupportedOverhangLimitIn: 6 },
		      ]}
		      perimeterCountertopName="Wall Quartz"
		      onOpenChange={vi.fn()}
		      onApply={onApply}
		      onRotate={vi.fn()}
		      onRemove={vi.fn()}
		    />,
		  );
		  expect(screen.getByText("Match wall countertops (Wall Quartz)")).toBeTruthy();
		  fireEvent.click(screen.getByTestId("island-countertop-material-select"));
		  fireEvent.click(screen.getByRole("option", { name: "Island Calacatta" }));
		  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
		    countertopProductId: 11,
		    countertopMaterialId: "carrara-marble",
		  }));
		  expect(screen.getByText("Countertop material")).toBeTruthy();
		});
});
