// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlooringAccessorySuggestionsDialog } from "./FlooringAccessorySuggestionsDialog";
import type { SelectedSurface } from "./SurfacesPickerDialog";

afterEach(cleanup);

const floor: SelectedSurface = {
  id: 71,
  pelicanCode: "Aveline 20mil Vinyl Flooring",
  slug: "aveline-20mil-vinyl-flooring",
  name: "Aveline 20mil Vinyl Flooring",
  category: "Flooring",
  subCategory: "Planks & Flooring",
  imageUrl: "/manus-storage/pelican/71.png",
  sellPrice: 74.25,
};
const trim: SelectedSurface = {
  id: 72,
  pelicanCode: "AVL-20-SN",
  slug: "aveline-20mil-stair-nose",
  name: "Aveline 20mil Stair Nose",
  category: "Flooring",
  subCategory: "Moldings & Trim",
  imageUrl: "/manus-storage/pelican/72.png",
  sellPrice: 19.5,
};

describe("FlooringAccessorySuggestionsDialog", () => {
  it("shows a selected-floor context and each matching trim's own source-backed code and price", () => {
    render(<FlooringAccessorySuggestionsDialog floor={floor} accessories={[trim]} isLoading={false} selectedAccessoryIds={new Set()} onAddAccessory={vi.fn()} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Complete your Aveline 20mil Vinyl Flooring floor")).toBeTruthy();
    expect(screen.getAllByText("Aveline 20mil Stair Nose")).toHaveLength(1);
    expect(screen.getByText("AVL-20-SN")).toBeTruthy();
    expect(screen.getByText("$19.50")).toBeTruthy();
  });

  it("does not add an accessory on discovery or Skip; Add to design is explicit", () => {
    const onAddAccessory = vi.fn();
    const onOpenChange = vi.fn();
    render(<FlooringAccessorySuggestionsDialog floor={floor} accessories={[trim]} isLoading={false} selectedAccessoryIds={new Set()} onAddAccessory={onAddAccessory} onOpenChange={onOpenChange} />);

    expect(onAddAccessory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /skip accessories/i }));
    expect(onAddAccessory).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("adds only the specific accessory tapped and marks an already selected one without re-adding it", () => {
    const onAddAccessory = vi.fn();
    const { rerender } = render(<FlooringAccessorySuggestionsDialog floor={floor} accessories={[trim]} isLoading={false} selectedAccessoryIds={new Set()} onAddAccessory={onAddAccessory} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /add aveline 20mil stair nose to design/i }));
    expect(onAddAccessory).toHaveBeenCalledWith(trim);

    rerender(<FlooringAccessorySuggestionsDialog floor={floor} accessories={[trim]} isLoading={false} selectedAccessoryIds={new Set([trim.id])} onAddAccessory={onAddAccessory} onOpenChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /aveline 20mil stair nose already added/i }).hasAttribute("disabled")).toBe(true);
  });
});
