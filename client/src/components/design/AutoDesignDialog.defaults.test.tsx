// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import matrixCatalog from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { DEFAULT_ROOM, type DesignCabinet } from "@/lib/design";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "@/lib/autoDesignLayout";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import { AutoDesignDialog } from "./AutoDesignDialog";

afterEach(cleanup);

// Tom, Nov 23 2026: Build measured kitchen with nothing edited must build.
type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const PACK = (matrixCatalog as unknown as Record<string, Pack>)["510004"]!;
const appliance = (code: string, w: number, d: number, h: number) => ({ id: 0, masterCode: code, description: code, category: "Appliance", subCategory: "Appliance", width: String(w), depth: String(d), height: String(h), placement: "appliance" }) as DesignCabinet;
const PALETTE = [appliance("RANGE-30", 30, 25, 36), appliance("DW-24", 24, 24, 34.5), appliance("FRIDGE-36", 36, 30, 70)];

function runEngine(input: AutoDesignInputs) {
  let uid = 0;
  return runAutoDesignLayout({
    input, room: DEFAULT_ROOM, openings: [], baseCatalog: PACK.base, wallCatalog: PACK.wall, fillers: PACK.accessory,
    appliancePalette: PALETTE, refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(PACK.wall, PACK.surround?.deepAbove ?? []),
    refrigeratorEndPanels: PACK.surround?.endPanels ?? [], panelCatalog: [...PACK.accessory, ...(PACK.surround?.endPanels ?? [])],
    styleId: 510004, makeUid: () => `dlg-${++uid}`,
  });
}

const centerInput = (label: string) => screen.getByLabelText(`${label} center from selected wall start in inches`) as HTMLInputElement;
const pick = (trigger: string, option: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(trigger));
  fireEvent.click(screen.getByRole("option", { name: option }));
};

function submitted(onBuild: ReturnType<typeof vi.fn>): AutoDesignInputs {
  fireEvent.click(screen.getByTestId("intake-construction-new"));
  fireEvent.click(screen.getByTestId("auto-design-build-submit"));
  expect(onBuild).toHaveBeenCalled();
  return onBuild.mock.calls.at(-1)![0] as AutoDesignInputs;
}

describe("AutoDesignDialog starting centers", () => {
  it("opens with starting centers that fit the default 144 in. wall and builds as-is", () => {
    const onBuild = vi.fn((_input: AutoDesignInputs): { ok: true } => ({ ok: true }));
    render(<AutoDesignDialog open onOpenChange={vi.fn()} onBuild={onBuild} room={DEFAULT_ROOM} wallCount={4} />);
    expect(centerInput("Sink base").value).toBe("51");
    expect(centerInput("Range / stove").value).toBe("18");
    expect(centerInput("Refrigerator").value).toBe("124.5");
    expect(centerInput("Dishwasher — Optional exact dishwasher center").value).toBe("");
    const input = submitted(onBuild);
    const run = runEngine(input);
    expect(run.ok ? "built" : run.message).toBe("built");
  });

  for (const [layout, label] of [["galley", "Galley"], ["l-shape", "L-shape"], ["u-shape", "U-shape"], ["single-wall", "Single wall"]] as const) {
    it(`${label}: the dialog's own starting values build with no placement error`, () => {
      const onBuild = vi.fn((_input: AutoDesignInputs): { ok: true } => ({ ok: true }));
      render(<AutoDesignDialog open onOpenChange={vi.fn()} onBuild={onBuild} room={DEFAULT_ROOM} wallCount={4} />);
      if (layout !== "single-wall") pick("Layout type", label);
      const input = submitted(onBuild);
      expect(input.layoutType).toBe(layout);
      const run = runEngine(input);
      expect(run.ok ? "built" : run.message).toBe("built");
    });
  }

  it("re-plans untouched fields when a choice would make them overlap, and never changes a typed value", () => {
    const onBuild = vi.fn((_input: AutoDesignInputs): { ok: true } => ({ ok: true }));
    render(<AutoDesignDialog open onOpenChange={vi.fn()} onBuild={onBuild} room={DEFAULT_ROOM} wallCount={4} />);
    const before = centerInput("Refrigerator").value;
    pick("Refrigerator size", "42″ refrigerator");
    expect(centerInput("Refrigerator").value).not.toBe(before);
    fireEvent.change(centerInput("Sink base"), { target: { value: "40" } });
    pick("Layout type", "L-shape");
    pick("Sink base size", "SB42 · 42″");
    expect(centerInput("Sink base").value).toBe("40");
    const input = submitted(onBuild);
    expect(input.sink).toEqual({ wallLabel: "Wall 1", centerOffsetIn: 40 });
    expect(input.refrigeratorWidthIn).toBe(42);
    // The range and refrigerator moved around the typed sink base (and its dishwasher).
    const sinkSpan = [40 - 21, 40 + 21 + 24];
    for (const item of [input.stove, input.refrigerator]) {
      if (!item || item.wallLabel !== "Wall 1") continue;
      const half = item === input.stove ? 15 : 21;
      expect(item.centerOffsetIn + half <= sinkSpan[0]! || item.centerOffsetIn - half >= sinkSpan[1]!).toBe(true);
    }
  });

  it("keeps a wall the customer picked for a field", () => {
    const onBuild = vi.fn((_input: AutoDesignInputs): { ok: true } => ({ ok: true }));
    render(<AutoDesignDialog open onOpenChange={vi.fn()} onBuild={onBuild} room={DEFAULT_ROOM} wallCount={4} />);
    pick("Range / stove — place on wall", /^Wall 3/);
    pick("Layout type", "Galley");
    const input = submitted(onBuild);
    expect(input.stove?.wallLabel).toBe("Wall 3");
    expect(input.stove?.centerOffsetIn).toBe(18);
  });
});
