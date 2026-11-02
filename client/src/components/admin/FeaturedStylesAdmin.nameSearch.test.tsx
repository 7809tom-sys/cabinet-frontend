// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const styles = [
  {
    id: 1,
    ourName: "Umber Shaker",
    aliasName: null,
    isFeatured: true,
    featuredRank: 1,
    isActive: true,
    distributorId: 1,
    roomScenes: [],
  },
  {
    id: 2,
    ourName: "Treasure Chest",
    aliasName: "Aurum Vault",
    isFeatured: false,
    featuredRank: 0,
    isActive: true,
    distributorId: 1,
    roomScenes: [],
  },
  {
    id: 3,
    ourName: "Natural Oak",
    aliasName: "Harbor Oak",
    isFeatured: false,
    featuredRank: 0,
    isActive: false,
    distributorId: 1,
    roomScenes: [],
  },
];

vi.mock("@/lib/trpc", () => {
  const mut = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  });
  const q = (path: string) => () => ({
    data: path.includes("listForAdmin")
      ? styles
      : path.includes("skuCounts")
        ? []
        : undefined,
    isLoading: false,
  });
  const make = (path: string): unknown =>
    new Proxy(() => {}, {
      get: (_t, k: string) => {
        if (k === "useQuery") return q(path);
        if (k === "useMutation") return mut;
        if (k === "useUtils") return () => make("utils");
        if (k === "invalidate" || k === "fetch") return vi.fn();
        return make(`${path}.${k}`);
      },
      apply: () => make(path),
    });
  return { trpc: make("trpc") };
});
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  }),
}));

import FeaturedStylesAdmin from "./FeaturedStylesAdmin";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function namesIn(testId: string) {
  const list = screen.queryByTestId(testId);
  if (!list) return [];
  return Array.from(
    list.querySelectorAll('[data-testid="door-style-name"]'),
  ).map((node) => node.textContent);
}

function search(value: string) {
  fireEvent.change(screen.getByTestId("door-style-search"), {
    target: { value },
  });
}

describe("admin door style search across all doors", () => {
  it("renders a single search box for the whole page", () => {
    render(<FeaturedStylesAdmin />);
    expect(screen.getAllByTestId("door-style-search").length).toBe(1);
    expect(
      (
        screen.getByTestId("door-style-search") as HTMLInputElement
      ).getAttribute("aria-label"),
    ).toBe("Search all door styles by real name or white label");
    expect(namesIn("all-door-style-list")).toEqual(["Treasure Chest"]);
  });

  it("finds a door by its real name", () => {
    render(<FeaturedStylesAdmin />);
    search("Umber Shaker");
    expect(namesIn("featured-door-style-list")).toEqual(["Umber Shaker"]);
    expect(namesIn("all-door-style-list")).toEqual([]);
    expect(screen.queryByTestId("door-style-white-label-match")).toBeNull();
    expect(screen.getByTestId("door-style-search-summary").textContent).toBe(
      "1 of 3 door styles match “Umber Shaker”.",
    );
  });

  it("finds a door by its white label and names the white label that matched", () => {
    render(<FeaturedStylesAdmin />);
    search("Aurum Vault");
    expect(namesIn("all-door-style-list")).toEqual(["Treasure Chest"]);
    const notes = screen.getAllByTestId("door-style-white-label-match");
    expect(notes.length).toBe(1);
    expect(notes[0].textContent).toBe(
      "White label “Aurum Vault” matched — real door name Treasure Chest",
    );
  });

  it("ignores case and spaces and accepts partial names", () => {
    render(<FeaturedStylesAdmin />);
    search("umbershaker");
    expect(namesIn("featured-door-style-list")).toEqual(["Umber Shaker"]);
    search("  AURUM   vault  ");
    expect(namesIn("all-door-style-list")).toEqual(["Treasure Chest"]);
    search("treas");
    expect(namesIn("all-door-style-list")).toEqual(["Treasure Chest"]);
  });

  it("also searches inactive doors by white label", () => {
    render(<FeaturedStylesAdmin />);
    search("harboroak");
    expect(namesIn("inactive-door-style-list")).toEqual(["Natural Oak"]);
    expect(
      screen.getByTestId("door-style-white-label-match").textContent,
    ).toContain("Harbor Oak");
  });

  it("reports no match and clears back to every door", () => {
    render(<FeaturedStylesAdmin />);
    search("no such door");
    expect(namesIn("featured-door-style-list")).toEqual([]);
    expect(namesIn("all-door-style-list")).toEqual([]);
    expect(namesIn("inactive-door-style-list")).toEqual([]);
    expect(screen.getByTestId("door-style-search-summary").textContent).toBe(
      "No door style matches “no such door”. Search the real door name or its white label.",
    );

    fireEvent.click(screen.getByTestId("door-style-search-clear"));
    expect(namesIn("featured-door-style-list")).toEqual(["Umber Shaker"]);
    expect(namesIn("all-door-style-list")).toEqual(["Treasure Chest"]);
    expect(namesIn("inactive-door-style-list")).toEqual(["Natural Oak"]);
  });

  it("keeps featured reordering off while a search narrows the list", () => {
    render(<FeaturedStylesAdmin />);
    expect(
      (screen.getAllByLabelText("Move up")[0] as HTMLButtonElement).disabled,
    ).toBe(true);
    search("treasure");
    expect(namesIn("featured-door-style-list")).toEqual([]);
    expect(screen.queryAllByLabelText("Move up").length).toBe(0);
    fireEvent.click(screen.getByTestId("door-style-search-clear"));
    expect(
      (screen.getAllByLabelText("Move up")[0] as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
