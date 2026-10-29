// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InventoryDesignStockControl, InventoryStockBadge, InventorySuggestionList, OutOfStockChoiceDialog } from "./InventoryStockNotice";
import type { InventoryCabinetNotice } from "@/lib/inventoryAlternatives";

afterEach(cleanup);

const notice: InventoryCabinetNotice = {
  uid: "cab-1",
  masterCode: "B36",
  description: "Base cabinet",
  sku: "B36",
  status: "out_of_stock",
  qtyAvailable: 0,
  vendor: "simulation",
  suggestions: [{
    id: "single:11:B36R",
    kind: "single",
    tier: "same-style",
    candidate: {
      id: 88,
      masterCode: "B36R",
      description: "Base cabinet right",
      width: 36,
      height: 34.5,
      depth: 24,
      placement: "base",
      styleId: 11,
      distributorId: 7,
      doorStyleName: "Shaker",
    },
    reason: "Same 36\" × 34.5\" × 24\" door base in Shaker.",
    ruleNotes: ["catalog-price", "same-style"],
  }],
};

describe("inventory stock notice", () => {
  it("shows an out-of-stock badge and swaps only when the user chooses", () => {
    const onSwap = vi.fn();
    render(<InventoryStockBadge notice={notice} onSwap={onSwap} />);
    expect(screen.getByTestId("inventory-stock-badge").textContent).toMatch(/out of stock/i);
    expect(onSwap).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("inventory-stock-badge"));
    fireEvent.click(screen.getByRole("button", { name: "Swap B36 for B36R" }));
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onSwap.mock.calls[0]?.[0]).toMatchObject({ kind: "single", candidate: { masterCode: "B36R" } });
  });

  it("renders nothing for unknown stock and nothing when the design has no out-of-stock cabinets", () => {
    const { rerender } = render(<InventoryStockBadge notice={null} onSwap={vi.fn()} />);
    expect(screen.queryByTestId("inventory-stock-badge")).toBeNull();
    rerender(
      <InventoryDesignStockControl
        simulationActive={false}
        forcedOutOfStock={[]}
        notices={[]}
        onSwap={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("inventory-design-stock")).toBeNull();
    expect(screen.queryByTestId("inventory-stock-badge")).toBeNull();
  });

  it("asks with the three choices and applies nothing until one is chosen", () => {
    const onChoose = vi.fn();
    const prompted: InventoryCabinetNotice = {
      ...notice,
      masterCode: "B18",
      choicePrompt: {
        fromCode: "B18",
        choices: [
          { id: "full-height", label: "full-height door base", buttonLabel: "Full-height door base", candidate: { ...notice.suggestions[0] && notice.suggestions[0].kind === "single" ? notice.suggestions[0].candidate : notice.suggestions[0], masterCode: "B18FH" } as never, suggestion: null },
          { id: "drawer", label: "drawer base", buttonLabel: "Drawer base", candidate: null, suggestion: null },
          { id: "readjust", label: "readjust the plan", buttonLabel: "Readjust the plan", candidate: null, suggestion: null },
        ],
      },
    };
    render(
      <OutOfStockChoiceDialog
        notice={prompted}
        phase="choose"
        onChoose={onChoose}
        onSwap={vi.fn()}
        onBack={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByTestId("stock-prompt-dialog").textContent).toMatch(/Choose one option before anything in the plan changes/);
    expect(screen.getByTestId("stock-prompt-full-height").textContent).toMatch(/Full-height door base/);
    expect(screen.getByTestId("stock-prompt-drawer").textContent).toMatch(/Drawer base/);
    expect(screen.getByTestId("stock-prompt-readjust").textContent).toMatch(/Readjust the plan/);
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("stock-prompt-full-height"));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose.mock.calls[0]?.[0].id).toBe("full-height");
  });

  it("lists the suggestion without applying it", () => {
    const onSwap = vi.fn();
    render(<InventorySuggestionList notice={notice} onSwap={onSwap} />);
    expect(screen.getByText(/catalog price/i)).toBeTruthy();
    expect(onSwap).not.toHaveBeenCalled();
  });
});
