// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    surfaces: {
      recommended: {
        useQuery: (input?: { role?: string }) => ({
          isLoading: false,
          data: input?.role === "flooring"
            ? [{
                id: 1,
                pelicanCode: "Plank",
                slug: "plank",
                name: "Oak Plank",
                category: "Flooring",
                subCategory: "Planks & Flooring",
                size: "7 x 48",
                imageUrl: null,
                materialImageUrl: null,
                sellPrice: 40,
                showInDesigner: true,
                isActive: true,
                description: null,
              }]
            : [],
        }),
      },
    },
    pelican: {
      byCategory: {
        useQuery: () => ({
          isLoading: false,
          data: {
            total: 2,
            items: [
              {
                id: 10,
                pelicanCode: "Arctic Vail",
                slug: "arctic-vail",
                name: "Arctic Vail",
                category: "Tile & Mosaic",
                subCategory: "Mosaic",
                size: "11.81 x 11.81",
                imageUrl: "/arctic.webp",
                materialImageUrl: null,
                sellPrice: 34,
                showInDesigner: true,
                isActive: true,
                usableAsFloor: true,
              },
              {
                id: 11,
                pelicanCode: "Moonstone Hex",
                slug: "moonstone-hex",
                name: "Moonstone Hex",
                category: "Tile & Mosaic",
                subCategory: "Mosaic",
                size: "12 x 12",
                imageUrl: "/moon.webp",
                materialImageUrl: null,
                sellPrice: 30,
                showInDesigner: true,
                isActive: true,
                usableAsFloor: false,
              },
            ],
          },
        }),
      },
    },
  },
}));

import { RecommendedSurfaces } from "./RecommendedSurfaces";

afterEach(cleanup);

describe("Recommended flooring mosaics", () => {
  it("counts a mosaic marked as a floor tile and opens the popup instead of listing it inline", () => {
    const onBrowseAll = vi.fn();
    render(<RecommendedSurfaces selected={[]} onToggle={vi.fn()} onBrowseAll={onBrowseAll} />);
    // The row owns the count and the destination; the cards themselves are the
    // popup's job, so an unchecked mosaic never reaches this list either.
    const row = screen.getByTestId("recommended-category-flooring");
    expect(row.textContent).toContain("(2)");
    expect(row.textContent).not.toContain("Moonstone Hex");
    expect(document.getElementById("recommended-section-flooring")).toBeNull();

    fireEvent.click(row);
    expect(onBrowseAll).toHaveBeenCalledWith("flooring");
  });
});
