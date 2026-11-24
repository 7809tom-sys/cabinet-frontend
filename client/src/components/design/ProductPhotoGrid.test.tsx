// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  customerFacingBrand,
  customerFacingProductName,
  ProductPhotoGrid,
  ProductPhotoTile,
} from "./ProductPhotoGrid";

afterEach(cleanup);

describe("ProductPhotoTile", () => {
  it("shows the catalog photo, name, code and price", () => {
    render(
      <ProductPhotoGrid testId="grid">
        <ProductPhotoTile
          testId="tile-1"
          imageUrl="https://example.test/sink.png"
          name="Undermount Kitchen Sink"
          code="PL-501"
          price="$249.00"
          selected={false}
          onSelect={vi.fn()}
        />
      </ProductPhotoGrid>,
    );
    const tile = screen.getByTestId("tile-1");
    const img = tile.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.test/sink.png");
    expect(img?.getAttribute("alt")).toBe("Undermount Kitchen Sink");
    expect(tile.textContent).toContain("PL-501");
    expect(tile.textContent).toContain("$249.00");
    expect(tile.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByTestId("product-photo-placeholder")).toBeNull();
  });

  it("shows a placeholder with the name when there is no photo", () => {
    render(<ProductPhotoTile testId="tile-2" name="Bar Sink" price="$99.00" selected={false} onSelect={vi.fn()} />);
    const placeholder = screen.getByTestId("product-photo-placeholder");
    expect(placeholder.getAttribute("aria-label")).toContain("Bar Sink");
    expect(screen.getByTestId("tile-2").textContent).toContain("Bar Sink");
    expect(screen.getByTestId("tile-2").querySelector("img")).toBeNull();
  });

  it("falls back to the placeholder when the photo fails to load", () => {
    render(<ProductPhotoTile testId="tile-3" imageUrl="https://example.test/broken.png" name="Faucet" price="$10.00" selected={false} onSelect={vi.fn()} />);
    fireEvent.error(screen.getByTestId("tile-3").querySelector("img")!);
    expect(screen.getByTestId("product-photo-placeholder")).toBeTruthy();
  });

  it("calls the picker's handler when tapped and shows the selected state", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<ProductPhotoTile testId="tile-4" imageUrl="https://example.test/a.png" name="Faucet" price="$10.00" selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("tile-4"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    rerender(<ProductPhotoTile testId="tile-4" imageUrl="https://example.test/a.png" name="Faucet" price="$10.00" selected onSelect={onSelect} />);
    expect(screen.getByTestId("tile-4").getAttribute("aria-pressed")).toBe("true");
  });

  it("does not repeat a code the name already carries", () => {
    render(<ProductPhotoTile testId="tile-5" imageUrl="https://example.test/f.png" name="PL-8203 Pull-Down Faucet" code="PL-8203" price="$1.00" selected={false} onSelect={vi.fn()} />);
    expect(screen.getByTestId("tile-5").textContent?.match(/PL-8203/g)?.length).toBe(1);
  });

  it("never shows the supplier's name to the customer", () => {
    render(<ProductPhotoTile testId="tile-6" name="Pelican Pull-Down Faucet" price="$1.00" selected={false} onSelect={vi.fn()} />);
    expect(screen.getByTestId("tile-6").textContent).not.toContain("Pelican");
    expect(customerFacingProductName("Pelican Kitchen Sink")).toBe("StoneCreek Kitchen Sink");
    expect(customerFacingBrand("Pelican")).toBe("StoneCreek");
    expect(customerFacingBrand("Other Vendor")).toBe("Other Vendor");
  });
});
