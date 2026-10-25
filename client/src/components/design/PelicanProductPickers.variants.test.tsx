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

describe("Recommended Pelican rows swap finishes instead of duplicating a product", () => {
  it("starts surface families condensed and exposes their exact cards only after the heading is opened", () => {
    render(
      <RecommendedSurfaces
        selected={[]}
        onToggle={vi.fn()}
        onBrowseAll={vi.fn()}
        limit={60}
      />,
    );

    const faucetHeading = screen.getByTestId("recommended-section-toggle-faucet");
    expect(faucetHeading.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryAllByTestId(/^recommended-faucet-/)).toHaveLength(0);

    fireEvent.click(faucetHeading);
    expect(faucetHeading.getAttribute("aria-expanded")).toBe("true");
    expect(cardsOf("recommended-faucet").length).toBeGreaterThan(0);
  });

  it("removes the selected sibling finish before adding the newly chosen one", () => {
    const onToggle = vi.fn();
    const selected = [faucet("PL-8237 BN")];
    render(
      <RecommendedSurfaces
        selected={selected as never}
        onToggle={onToggle}
        onBrowseAll={vi.fn()}
        limit={60}
      />,
    );
    openRecommendedSection("faucet");
    const card = cardsOf("recommended-faucet").find((entry) => mentions(entry, /PL-8237/))!;
    // The card opens on the finish that is already in the design and says so.
    expect(within(card).getByRole("button", { name: /selected/i }).getAttribute("aria-pressed")).toBe("true");
    const trigger = within(card).getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: /matte black/i }));
    expect(within(card).getByText(/in your design/i).textContent).toMatch(/brushed nickel/i);
    fireEvent.click(within(card).getByRole("button", { name: /use this finish/i }));
    expect(onToggle.mock.calls.map((call) => (call[0] as Row).pelicanCode)).toEqual(["PL-8237 BN", "PL-8237 MB"]);
  });

  it("does not remove a sibling when the role already replaces its previous choice (countertop)", () => {
    const onToggle = vi.fn();
    const slabs = quartzRows.filter((row) => /^Calacatta Oro 3cm/.test(row.name));
    expect(slabs.length).toBeGreaterThan(1);
    render(
      <RecommendedSurfaces
        selected={[slabs[0]!] as never}
        onToggle={onToggle}
        onBrowseAll={vi.fn()}
        limit={60}
      />,
    );
    openRecommendedSection("countertop");
    const card = cardsOf("recommended-countertop").find((entry) => mentions(entry, /Calacatta Oro/i))!;
    const trigger = within(card).getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const other = slabs[1]!;
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(slabs.length);
    fireEvent.click(options[slabs.indexOf(other)]!);
    fireEvent.click(within(card).getByRole("button", { name: /use this slab/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect((onToggle.mock.calls[0]![0] as Row).id).toBe(other.id);
  });
});
