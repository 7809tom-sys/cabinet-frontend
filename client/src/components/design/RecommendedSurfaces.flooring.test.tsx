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
  it("counts every priced active plank in the category row and opens the popup instead of expanding", () => {
    const onBrowseAll = vi.fn();
    render(
      <RecommendedSurfaces
        selected={[]}
        onToggle={vi.fn()}
        onBrowseAll={onBrowseAll}
        limit={8}
      />,
    );

    // The sidebar is a list of destinations: the row shows the family's own
    // count and opens the catalog on that tab. It never expands inline, so no
    // cards render here and trim / underlayment / unpriced rows stay excluded
    // from the count the same way they were excluded from the grid.
    const row = screen.getByTestId("recommended-category-flooring");
    expect(row.dataset.categoryRole).toBe("flooring");
    expect(row.textContent).toContain("Flooring");
    // No inline card grid: the only element for this family is its row.
    expect(screen.queryAllByTestId(/^recommended-flooring-/)).toHaveLength(0);
    expect(recommendedInputs).toContainEqual({ role: "flooring", limit: 500 });

    fireEvent.click(row);
    expect(onBrowseAll).toHaveBeenCalledWith("flooring");
  });

  it("reads the full storefront flooring catalog and tiles a plank catalog photo when no swatch exists", () => {
    const recommended = readFileSync(resolve(process.cwd(), "client/src/components/design/RecommendedSurfaces.tsx"), "utf8");
    const dialog = readFileSync(resolve(process.cwd(), "client/src/components/design/SurfacesPickerDialog.tsx"), "utf8");
    const designTool = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
    // Flooring still reads its own full palette through the sidebar count.
    expect(recommended).toContain('role: "flooring", limit: 500');
    expect(recommended).not.toContain('subCategory: role === "flooring"');
    expect(dialog).toContain('scope: "catalog" as const');
    expect(dialog).not.toContain('scope: browsingTileMosaic ? "catalog" as const : "designer" as const');
    expect(dialog).toContain("limit: PAGE_LIMIT");
    expect(dialog).toContain('limit: activeBathroomRole === "flooring" ? 500 : PAGE_LIMIT');
    expect(dialog).not.toContain("browsingFlooring");
    expect(dialog).toContain("src={bathroomFixtureCardImage(p.pelicanCode, p.imageUrl) ?? p.imageUrl}");
    expect(designTool).toContain("flooringSceneTextureUrl(selected, approvedFlooringSwatchByProductId)");
    expect(designTool).toContain("catalogFlooringReferenceUrl={threeDSurfaceTextureUrls.flooring}");
    expect(designTool).toContain("catalogFlooringImageUrl={threeDSurfaceTextureUrls.flooring}");
    expect(designTool).not.toContain("activeFlooringSurface?.materialImageUrl ?? activeFlooringSurface?.imageUrl");
  });
});
