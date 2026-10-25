// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    surfaces: {
      recommended: {
        useQuery: () => ({
          isLoading: false,
          data: [{ id: 11, slug: "pallum", name: "Pallum 3cm Super Jumbo", category: "Countertop", subCategory: "Quartz", size: "138 × 79 in.", imageUrl: null, sellPrice: 2430 }],
        }),
      },
    },
  },
}));

import { PelicanCountertopPicker, PelicanFaucetPicker, type RecItem } from "./PelicanProductPickers";

afterEach(cleanup);

describe("PelicanCountertopPicker", () => {
  it("keeps countertop cards collapsed until the compact chooser is opened", () => {
    render(<PelicanCountertopPicker selectedSurfaces={[]} onSelect={vi.fn()} onBrowseAll={vi.fn()} />);
    const chooser = screen.getByRole("button", { name: /countertop choices/i });
    expect(chooser.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Pallum 3cm Super Jumbo")).toBeNull();
    fireEvent.click(chooser);
    expect(chooser.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Pallum 3cm Super Jumbo")).toBeTruthy();
  });
});

describe("PelicanFaucetPicker", () => {
  const faucets: RecItem[] = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    pelicanCode: `PL-82${index + 10} BN`,
    slug: `pelican-faucet-${index + 1}`,
    name: `Pelican verified faucet ${index + 1}`,
    category: "Sinks & Faucets",
    subCategory: "Faucets",
    size: null,
    imageUrl: `https://images.example.test/faucet-${index + 1}.jpg`,
    sellPrice: 199 + index,
  }));

  it("keeps the quick visual grid compact but exposes every returned eligible faucet without a six-card dead end", () => {
    render(<PelicanFaucetPicker faucets={faucets} isLoading={false} kind="kitchen" onSelect={vi.fn()} />);

    expect(screen.getByText("PL-8210 BN")).toBeTruthy();
    expect(screen.queryByText("PL-8216 BN")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /show all 7 faucets/i }));

    expect(screen.getByText("PL-8216 BN")).toBeTruthy();
    expect(screen.getByAltText("Pelican verified faucet 7")).toBeTruthy();
  });

  it("returns the exact photo-backed, priced SKU that the user taps", () => {
    const onSelect = vi.fn();
    render(<PelicanFaucetPicker faucets={faucets} isLoading={false} kind="kitchen" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /pelican verified faucet 1/i }));

    expect(onSelect).toHaveBeenCalledWith(faucets[0]);
  });
});
