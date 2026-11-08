// @vitest-environment jsdom
/**
 * The sink step's product list for a farmhouse / apron-front sink base.
 *
 * Owner report (Nov 7 2026): in the bathroom designer, selecting a "Farmer"
 * (farmhouse) sink base showed no sink to choose, so no apron-front sink could
 * be placed. The picker now filters with the shared `sinkRowFitsBase` rule and
 * reads the role that matches the base, so the FSB lists its apron-front sinks
 * and a vanity still lists its vanities.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PelicanSinkPicker } from "./PelicanProductPickers";
import { sinkCatalogRoleForBase } from "@/lib/sinkBaseSelection";
import type { PlacedCabinet } from "@/lib/design";

const rows = [
  { id: 1, pelicanCode: "PL-HA135 R0", slug: "pl-ha135-r0", name: "PL-HA135 R0 Farmhouse Apron Sink", category: "Sinks & Faucets", subCategory: "Sinks", size: null, imageUrl: null, sellPrice: 40000 },
  { id: 2, pelicanCode: "PL-3099 White", slug: "pl-3099-white", name: "PL-3099 White Pearl Series Vanity Sink", category: "Sinks & Faucets", subCategory: "Sinks", size: null, imageUrl: null, sellPrice: 21000 },
];

const requested: Array<{ role: string }> = [];
vi.mock("@/lib/trpc", () => ({
  trpc: {
    surfaces: {
      recommended: {
        useQuery: (input: { role: string }) => {
          requested.push(input);
          return { data: rows, isLoading: false };
        },
      },
    },
  },
}));

const FSB = {
  uid: "fsb36", cabinetId: 3, masterCode: "FSB36", description: '36" Farm Sink Base',
  category: "Base", subCategory: "Farm Sink Base", placement: "base",
  x: 0, y: 0, width: 36, depth: 24, height: 34.5, rotation: 0,
} as unknown as PlacedCabinet;

const VSD = {
  uid: "vsd30", cabinetId: 2, masterCode: "VSD30", description: '30" Vanity Sink Base',
  category: "Vanity", subCategory: "Vanity Sink Base", placement: "base",
  x: 0, y: 0, width: 30, depth: 21, height: 34.5, rotation: 0,
} as unknown as PlacedCabinet;

beforeEach(() => requested.length = 0);
afterEach(cleanup);

describe("PelicanSinkPicker on a farmhouse sink base", () => {
  it("lists the apron-front sink and not the vanity basin", () => {
    render(
      <PelicanSinkPicker
        selectedSurfaces={[]}
        role="sink"
        filter={(item) => item.pelicanCode === "PL-HA135 R0"}
        onSelect={() => {}}
        onBrowseAll={() => {}}
      />,
    );
    expect(screen.getAllByText(/HA135/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/3099/)).toBeNull();
  });

  it("asks for the ordinary sink role on an apron-front base, and the vanity role on a vanity", () => {
    expect(sinkCatalogRoleForBase(FSB, "bathroom")).toBe("sink");
    expect(sinkCatalogRoleForBase(VSD, "bathroom")).toBe("vanity-sink");
  });

  it("shows the apron-specific empty message instead of the kitchen one", () => {
    render(
      <PelicanSinkPicker
        selectedSurfaces={[]}
        filter={() => false}
        emptyMessage={'No source-verified apron-front sink fits this 24" farmhouse sink base yet.'}
        onSelect={() => {}}
        onBrowseAll={() => {}}
      />,
    );
    expect(screen.getByText(/No source-verified apron-front sink fits this 24/)).toBeTruthy();
    expect(screen.queryByText(/No sinks available/)).toBeNull();
  });
});
