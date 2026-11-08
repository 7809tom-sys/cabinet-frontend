// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

type Row = {
  id: number;
  pelicanCode: string | null;
  slug?: string;
  name: string;
  description: string | null;
  category: string;
  subCategory: string | null;
  size: string | null;
  imageUrl: string | null;
  materialImageUrl?: string | null;
  sellPrice: number | null;
};

// Real rows exported from the live Pelican catalog; images are filled in so the
// compact pickers (which require a photo for faucets) can show them.
const rows = (JSON.parse(
  readFileSync(resolve(process.cwd(), "client/src/lib/__fixtures__/pelicanCatalogRows.json"), "utf8"),
) as Row[]).map((row) => ({ ...row, slug: `slug-${row.id}`, imageUrl: row.imageUrl ?? `https://images.example.test/${row.id}.jpg`, materialImageUrl: null }));

const faucetRows = rows.filter((row) => row.subCategory === "Faucets");
const quartzRows = rows.filter((row) => row.category === "Quartz Slabs (Countertops)");

vi.mock("@/lib/trpc", () => ({
  trpc: {
    surfaces: {
      recommended: {
        useQuery: ({ role }: { role: string }) => ({
          isLoading: false,
          data: role === "faucet"
            ? faucetRows
            : role === "countertop"
              ? quartzRows
              : [],
        }),
      },
    },
    pelican: {
      byCategory: {
        useQuery: () => ({ isLoading: false, data: { items: [], total: 0 } }),
      },
    },
  },
}));

import { PelicanFaucetPicker, type RecItem } from "./PelicanProductPickers";
import { RecommendedSurfaces } from "./RecommendedSurfaces";

beforeAll(() => {
  // Radix Select needs these browser APIs, which jsdom does not provide.
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => undefined;
  proto.releasePointerCapture ??= () => undefined;
  proto.scrollIntoView ??= () => undefined;
});
afterEach(cleanup);

/** Card containers only: the "-use-<id>" action buttons share the same test id prefix. */
const cardsOf = (prefix: string) =>
  screen.getAllByTestId(new RegExp(`^${prefix}-`)).filter((element) => !element.getAttribute("data-testid")!.startsWith(`${prefix}-use-`));
const mentions = (card: HTMLElement, pattern: RegExp) => within(card).queryAllByText(pattern).length > 0;
const openRecommendedSection = (role: string) => fireEvent.click(screen.getByTestId(`recommended-section-toggle-${role}`));

const faucet = (code: string) => faucetRows.find((row) => row.pelicanCode === code)!;

describe("Pelican faucet picker uses the hardware card-plus-selector pattern", () => {
  it("shows one PL-8237 card with a finish dropdown instead of four separate cards", () => {
    render(<PelicanFaucetPicker faucets={faucetRows as RecItem[]} isLoading={false} kind="kitchen" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /show all \d+ faucets/i }));
    const selects = screen.getAllByTestId(/^pelican-variant-select-/);
    expect(selects.length).toBeGreaterThan(0);
    const cards = cardsOf("faucet-card");
    const withPl8237 = cards.filter((card) => mentions(card, /PL-8237/));
    expect(withPl8237).toHaveLength(1);
    expect(cards.length).toBeLessThan(faucetRows.length);
  });

  it("returns the exact original row of the finish that is showing when Use is pressed", () => {
    const onSelect = vi.fn();
    render(<PelicanFaucetPicker faucets={faucetRows as RecItem[]} isLoading={false} kind="kitchen" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /show all \d+ faucets/i }));
    const card = cardsOf("faucet-card").find((entry) => mentions(entry, /PL-8237/))!;
    const use = within(card).getByRole("button", { name: /use this finish/i });
    fireEvent.click(use);
    expect(onSelect).toHaveBeenCalledTimes(1);
    const sent = onSelect.mock.calls[0]![0] as Row;
    // Same object as the catalog row: never a copy with a changed price, code or id.
    expect(faucetRows).toContain(sent);
    expect(sent.pelicanCode).toMatch(/^PL-8237 /);
  });

  it("returns a different exact SKU after another finish is chosen in the dropdown", () => {
    const onSelect = vi.fn();
    render(<PelicanFaucetPicker faucets={faucetRows as RecItem[]} isLoading={false} kind="kitchen" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /show all \d+ faucets/i }));
    const card = cardsOf("faucet-card").find((entry) => mentions(entry, /PL-8237/))!;
    const trigger = within(card).getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: /chrome/i }));
    fireEvent.click(within(card).getByRole("button", { name: /use this finish/i }));
    expect(onSelect).toHaveBeenCalledWith(faucet("PL-8237 CHR"));
  });
});

describe("Recommended categories are destinations, not accordions", () => {
  it("renders one row per family with no inline cards and no expand state", () => {
    const onBrowseAll = vi.fn();
    render(
      <RecommendedSurfaces
        selected={[]}
        onToggle={vi.fn()}
        onBrowseAll={onBrowseAll}
        limit={60}
      />,
    );

    // Every family is a single clickable row. Nothing expands inline, so the
    // card grids and the aria-expanded toggle that used to live here are gone.
    const faucetRow = screen.getByTestId("recommended-category-faucet");
    expect(faucetRow.getAttribute("aria-expanded")).toBeNull();
    expect(screen.queryAllByTestId(/^recommended-faucet-/)).toHaveLength(0);

    // Clicking the row opens the catalog on that family instead.
    fireEvent.click(faucetRow);
    expect(onBrowseAll).toHaveBeenCalledWith("faucet");
    expect(screen.queryAllByTestId(/^recommended-faucet-/)).toHaveLength(0);
  });

  it("puts the name and count on one line, wraps the name, and ships no browse link or chevron", () => {
    const onBrowseAll = vi.fn();
    render(
      <RecommendedSurfaces
        selected={[]}
        onToggle={vi.fn()}
        onBrowseAll={onBrowseAll}
        roomType="bathroom"
        bathroomPaletteMode="fixtures"
        limit={60}
      />,
    );
    const row = screen.getByTestId("recommended-category-toilet-bidet");
    // Compact: "Toilets & Bidets (14)" in one text run, name then count.
    expect(row.textContent).toMatch(/^Toilets & Bidets\(\d+\)/);
    // No truncation class anywhere in the row, so a long name wraps instead of
    // collapsing to "Shower & Tub Do…".
    expect(row.querySelector('[class*="truncate"]')).toBeNull();
    expect(row.querySelector('[class*="break-words"]')).not.toBeNull();
    // The whole row is the link: no separate browse control and no chevron.
    expect(row.querySelector("svg")).toBeNull();
    expect(row.textContent).not.toMatch(/browse/i);
    expect(row.getAttribute("title")).toBe("Toilets & Bidets");
    fireEvent.click(row);
    expect(onBrowseAll).toHaveBeenCalledWith("toilet-bidet");
  });

  it("gives each family its own row so the popup tab order matches the sidebar", () => {
    const onBrowseAll = vi.fn();
    render(
      <RecommendedSurfaces
        selected={[]}
        onToggle={vi.fn()}
        onBrowseAll={onBrowseAll}
        roomType="bathroom"
        bathroomPaletteMode="fixtures"
        limit={60}
      />,
    );
    const rows = screen.getAllByTestId(/^recommended-category-/);
    expect(rows.map((row) => row.dataset.categoryRole)).toEqual([
      "bathroom-sink",
      "bathroom-faucet",
      "toilet-bidet",
      "bathtub",
      "shower-pan",
      "shower-surround",
      "shower-tile",
      "shower-system",
      "shower-door",
      "shower-niche",
      // Accessories are their own destination. Towel bars and accessory sets used
      // to appear on the Bathtubs tab, which only shows tubs.
      "bathroom-accessory",
    ]);
    // Each row is its own destination, including every new shower category.
    fireEvent.click(screen.getByTestId("recommended-category-shower-pan"));
    expect(onBrowseAll).toHaveBeenCalledWith("shower-pan");
    fireEvent.click(screen.getByTestId("recommended-category-shower-niche"));
    expect(onBrowseAll).toHaveBeenCalledWith("shower-niche");
  });
});
