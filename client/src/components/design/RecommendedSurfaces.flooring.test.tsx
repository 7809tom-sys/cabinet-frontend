// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type FloorRow = {
  id: number;
  pelicanCode: string;
  slug: string;
  name: string;
  category: string;
  subCategory: string;
  size: string | null;
  imageUrl: string | null;
  materialImageUrl: string | null;
  sellPrice: number;
  showInDesigner: boolean;
  isActive: boolean;
  description: string | null;
};

const floorRows: FloorRow[] = [
  ...Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    pelicanCode: `Plank ${index + 1}`,
    slug: `plank-${index + 1}`,
    name: `Plank ${index + 1}`,
    category: "Flooring",
    subCategory: "Planks & Flooring",
    size: '7" x 48"',
    imageUrl: index === 0 ? null : `/photos/plank-${index + 1}.webp`,
    materialImageUrl: index === 3 ? "/swatches/plank.webp" : null,
    sellPrice: 40 + index,
    showInDesigner: true,
    isActive: true,
    description: null,
  })),
  {
    id: 90,
    pelicanCode: "Stair Nose",
    slug: "stair-nose",
    name: "Hidden Stair Nose",
    category: "Flooring",
    subCategory: "Moldings & Trim",
    size: null,
    imageUrl: "/photos/nose.webp",
    materialImageUrl: null,
    sellPrice: 12,
    showInDesigner: true,
    isActive: true,
    description: null,
  },
  {
    id: 91,
    pelicanCode: "Underlayment",
    slug: "underlayment",
    name: "Hidden Underlayment",
    category: "Flooring",
    subCategory: "Underlayment",
    size: null,
    imageUrl: null,
    materialImageUrl: null,
    sellPrice: 20,
    showInDesigner: true,
    isActive: true,
    description: null,
  },
  {
    id: 92,
    pelicanCode: "Unpriced Plank",
    slug: "unpriced-plank",
    name: "Unpriced Plank",
    category: "Flooring",
    subCategory: "Planks & Flooring",
    size: null,
    imageUrl: "/photos/unpriced.webp",
    materialImageUrl: null,
    sellPrice: 0,
    showInDesigner: true,
    isActive: true,
    description: null,
  },
];

const { recommendedInputs } = vi.hoisted(() => ({
  recommendedInputs: [] as Array<{ role?: string; limit?: number }>,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    surfaces: {
      recommended: {
        useQuery: (input?: { role?: string; limit?: number }) => {
          recommendedInputs.push(input ?? {});
          return {
            isLoading: false,
            data: input?.role === "flooring" ? floorRows : [],
          };
        },
      },
    },
    pelican: {
      byCategory: {
        useQuery: () => ({ isLoading: false, data: { items: [], total: 0 } }),
      },
    },
  },
}));

import { RecommendedSurfaces } from "./RecommendedSurfaces";

afterEach(cleanup);

describe("Recommended flooring palette", () => {
  it("lists every priced active plank and ignores the 8-item cap, trim, and underlayment", () => {
    render(
      <RecommendedSurfaces
        selected={[]}
        onToggle={vi.fn()}
        onBrowseAll={vi.fn()}
        limit={8}
      />,
    );

    const heading = screen.getByTestId("recommended-section-toggle-flooring");
    expect(heading.textContent).toContain("(10)");
    fireEvent.click(heading);
    const cards = screen.getAllByTestId(/^recommended-flooring-/).filter((element) => !element.getAttribute("data-testid")!.includes("-use-"));
    expect(cards).toHaveLength(10);
    expect(cards.some((card) => card.textContent?.includes("Plank 1"))).toBe(true);
    expect(cards.some((card) => card.textContent?.includes("Plank 10"))).toBe(true);
    expect(screen.queryByText("Hidden Stair Nose")).toBeNull();
    expect(screen.queryByText("Hidden Underlayment")).toBeNull();
    expect(screen.queryByText("Unpriced Plank")).toBeNull();
    expect(recommendedInputs).toContainEqual({ role: "flooring", limit: 500 });
    const cardText = (name: string) => cards.find((card) => card.textContent?.includes(name));
    expect(cardText("Plank 1")?.querySelector("img")).toBeNull();
    expect(cardText("Plank 2")?.querySelector("img")?.getAttribute("src")).toBe("/photos/plank-2.webp");
    expect(cardText("Plank 4")?.querySelector("img")?.getAttribute("src")).toBe("/photos/plank-4.webp");
  });

  it("requests the designer flooring endpoints and keeps the card photo off the floor mesh", () => {
    const recommended = readFileSync(resolve(process.cwd(), "client/src/components/design/RecommendedSurfaces.tsx"), "utf8");
    const dialog = readFileSync(resolve(process.cwd(), "client/src/components/design/SurfacesPickerDialog.tsx"), "utf8");
    const designTool = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
    expect(recommended).toContain('const storefrontCatalog = role === "backsplash"');
    expect(recommended).toContain('{ role: "flooring", limit: 500 }');
    expect(recommended).toContain("const visible = storefrontCatalog || fullFlooringPalette ? configurations : configurations.slice(0, limit)");
    expect(recommended).not.toContain('subCategory: role === "flooring"');
    expect(dialog).toContain('scope: browsingTileMosaic ? "catalog" as const : "designer" as const');
    expect(dialog).toContain("limit: PAGE_LIMIT");
    expect(dialog).toContain('limit: activeBathroomRole === "flooring" ? 500 : PAGE_LIMIT');
    expect(dialog).not.toContain("browsingFlooring");
    expect(dialog).toContain("src={p.imageUrl}");
    expect(designTool).toContain("flooringSceneTextureUrl(selected, approvedFlooringSwatchByProductId)");
    expect(designTool).toContain("catalogFlooringReferenceUrl={threeDSurfaceTextureUrls.flooring}");
    expect(designTool).toContain("catalogFlooringImageUrl={threeDSurfaceTextureUrls.flooring}");
    expect(designTool).not.toContain("activeFlooringSurface?.materialImageUrl ?? activeFlooringSurface?.imageUrl");
  });
});
