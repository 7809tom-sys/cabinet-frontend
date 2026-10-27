// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogPaletteCard } from "./CatalogPaletteCard";
import type { DesignCabinet } from "@/lib/design";

const cabinet = {
  id: 18,
  masterCode: "WFD241824-BLUM",
  description: "24 inch deep frameless wall cabinet for a refrigerator opening",
  category: "Wall",
  subCategory: null,
  width: "24",
  height: "17.625",
  depth: "24",
  placement: "wall",
  numberOfDoors: 2,
  numberOfDrawers: 0,
  isCornerCabinet: false,
} as DesignCabinet;

const sizeLabel = '24"W × 17.63"H × 24"D';

afterEach(cleanup);

function renderCard(overrides: Partial<ComponentProps<typeof CatalogPaletteCard>> = {}) {
  const onPlace = vi.fn();
  const onOpenSpecs = vi.fn();
  const onDragStart = vi.fn();
  render(
    <div style={{ width: 240 }}>
      <CatalogPaletteCard
        cabinet={cabinet}
        description={cabinet.description}
        sizeLabel={sizeLabel}
        finishSwatchUrl="/finish.webp"
        finishName="White Shaker"
        showGlass
        draggable
        onDragStart={onDragStart}
        onPlace={onPlace}
        onOpenSpecs={onOpenSpecs}
        specsTestId="catalog-card-specs-WFD241824-BLUM"
        specsAriaLabel="View specifications for WFD241824-BLUM"
        specsTitle="View this catalog item’s specifications"
        {...overrides}
      />
    </div>,
  );
  return { onPlace, onOpenSpecs, onDragStart };
}

describe("CatalogPaletteCard", () => {
  it("keeps the full SKU and the full width × height × depth readable without ellipsis", () => {
    renderCard();
    const sku = screen.getByTestId("catalog-card-sku-WFD241824-BLUM");
    expect(sku.textContent).toBe("WFD241824-BLUM");
    expect(sku.className).not.toMatch(/\btruncate\b/);
    expect(sku.className).toMatch(/break-words/);
    expect(sku.className).toMatch(/whitespace-normal/);

    const size = screen.getByTestId("catalog-card-size-WFD241824-BLUM");
    expect(size.textContent).toBe(sizeLabel);
    expect(size.className).toMatch(/whitespace-nowrap/);
    expect(size.className).not.toMatch(/\btruncate\b/);
    expect(size.getAttribute("title")).toBe(sizeLabel);

    const description = screen.getByTestId("catalog-card-description-WFD241824-BLUM");
    expect(description.getAttribute("title")).toBe(cabinet.description);
    expect(description.className).toMatch(/\btruncate\b/);

    const spec = screen.getByTestId("catalog-card-specs-WFD241824-BLUM");
    const place = screen.getByRole("button", { name: `Place WFD241824-BLUM, ${sizeLabel}` });
    expect(size.closest("button")).not.toContain(spec);
    expect(place.textContent).toContain(sizeLabel);
  });

  it("places from the card or add control and keeps the spec sheet from placing", () => {
    const { onPlace, onOpenSpecs } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: `Place WFD241824-BLUM, ${sizeLabel}` }));
    fireEvent.click(screen.getByRole("button", { name: "Add WFD241824-BLUM" }));
    expect(onPlace).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "View specifications for WFD241824-BLUM" }));
    expect(onOpenSpecs).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledTimes(2);
  });

  it("still starts a catalog drag from the card", () => {
    const { onDragStart } = renderCard({ cardTestId: "cabinet-placement-detail-WFD241824-BLUM" });
    fireEvent.dragStart(screen.getByTestId("cabinet-placement-detail-WFD241824-BLUM"));
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it("shows a long framed code in full at a narrow sidebar width", () => {
    renderCard({
      cabinet: { ...cabinet, masterCode: "HONEY-CORE-W-36-24", displayMasterCode: "HONEY CORE W-36-24" },
      sizeLabel: '36"W × 24"H × 12"D',
      description: "Framed 36 inch wall cabinet",
    });
    const sku = screen.getByTestId("catalog-card-sku-HONEY-CORE-W-36-24");
    expect(sku.textContent).toBe("HONEY CORE W-36-24");
    expect(sku.className).not.toMatch(/\btruncate\b/);
    expect(screen.getByTestId("catalog-card-size-HONEY-CORE-W-36-24").textContent).toBe('36"W × 24"H × 12"D');
  });
});
