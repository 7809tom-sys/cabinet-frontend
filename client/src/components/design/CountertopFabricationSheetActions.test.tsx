// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CountertopFabricationInput } from "@/lib/countertopFabricationSheet";
import type { PlacedCabinet, RoomData } from "@/lib/design";

const downloadFabricationSheetPdf = vi.fn(async () => "cabinetdealz-countertop-fabrication-design.pdf");

vi.mock("@/lib/trpc", () => ({
  trpc: {
    design: {
      emailFabricationSheet: {
        useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
      },
    },
  },
}));
vi.mock("@/lib/countertopFabricationSheetPdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/countertopFabricationSheetPdf")>();
  return { ...actual, downloadFabricationSheetPdf: () => downloadFabricationSheetPdf() };
});
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    // The component only needs a translator; echo the key plus interpolations so
    // the assertions stay independent of the string table.
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}(${Object.values(vars).join(",")})` : key,
  }),
}));

import { CountertopFabricationSheetActions } from "./CountertopFabricationSheetActions";

afterEach(cleanup);
beforeEach(() => downloadFabricationSheetPdf.mockClear());

const room: RoomData = { width: 144, depth: 120 };
const placed: PlacedCabinet[] = [{
  uid: "b-24",
  cabinetId: 1,
  masterCode: "B-24",
  description: '24" Base Cabinet',
  placement: "base",
  x: 24,
  y: 96,
  width: 24,
  depth: 24,
  height: 34.5,
  rotation: 0,
  wallId: "bottom",
}];

const input: CountertopFabricationInput = { room, placed };

describe("countertop fabrication sheet actions", () => {
  it("keeps both actions enabled once the design bears a countertop", () => {
    render(<CountertopFabricationSheetActions input={input} />);
    expect(screen.getByTestId("download-fabrication-sheet")).not.toHaveProperty("disabled", true);
    expect(screen.getByTestId("email-fabrication-sheet")).not.toHaveProperty("disabled", true);
    expect(screen.getByTestId("countertop-fabrication-summary").textContent).toContain("dt_fab_summary_runs");
  });

  it("disables both actions and explains why when there is no countertop", () => {
    render(<CountertopFabricationSheetActions input={{ room, placed: [] }} />);
    expect(screen.getByTestId("download-fabrication-sheet").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("email-fabrication-sheet").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("countertop-fabrication-empty").textContent).toBe("dt_fab_nothing");
  });

  it("disables both actions when no design input is supplied at all", () => {
    render(<CountertopFabricationSheetActions input={null} />);
    expect(screen.getByTestId("download-fabrication-sheet").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("email-fabrication-sheet").hasAttribute("disabled")).toBe(true);
  });

  it("counts the fields the design does not store instead of hiding them", () => {
    render(<CountertopFabricationSheetActions input={input} />);
    const unknowns = screen.getByTestId("countertop-fabrication-unknowns").textContent ?? "";
    // Slab thickness, seam layout, no product, no backsplash, no edge profile,
    // and no stored per-run height: six honestly-blanked fields.
    expect(unknowns).toContain("dt_fab_summary_unknowns(6)");
  });
});
