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
  it("shows a mosaic marked as a floor tile and hides an unchecked mosaic", () => {
    const onToggle = vi.fn();
    render(<RecommendedSurfaces selected={[]} onToggle={onToggle} onBrowseAll={vi.fn()} />);
    const heading = screen.getByTestId("recommended-section-toggle-flooring");
    expect(heading.textContent).toContain("(2)");
    expect(heading.textContent).not.toContain("Moonstone Hex");
    fireEvent.click(heading);
    const flooring = document.getElementById("recommended-section-flooring");
    expect(flooring?.textContent).toContain("Oak Plank");
    expect(flooring?.textContent).toContain("Arctic Vail");
    expect(flooring?.textContent).not.toContain("Moonstone Hex");
    fireEvent.click(screen.getByTestId("recommended-flooring-use-10"));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({
      id: 10,
      name: "Arctic Vail",
      installedAs: "flooring",
    }), "flooring");
  });
});
