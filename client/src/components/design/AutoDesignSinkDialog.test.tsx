// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoDesignSinkDialog } from "./AutoDesignSinkDialog";
import type { AutoDesignSinkProduct } from "@/lib/autoDesignSink";

afterEach(cleanup);

const undermount: AutoDesignSinkProduct = {
  id: 1083,
  pelicanCode: "PL-VS3018 18g",
  name: "PL-VS3018 18g",
  category: "Sinks & Faucets",
  subCategory: "Sinks",
  imageUrl: "https://example.test/pl-vs3018.png",
  sellPrice: 119.97,
};
const farmhouse: AutoDesignSinkProduct = {
  id: 978,
  pelicanCode: "PL-HA124 R0 16g",
  name: "PL-HA124 R0 16g",
  category: "Sinks & Faucets",
  subCategory: "Sinks",
  imageUrl: "https://example.test/pl-ha124.png",
  sellPrice: 599.85,
};

function renderDialog(overrides: Partial<Parameters<typeof AutoDesignSinkDialog>[0]> = {}) {
  const onChoose = vi.fn();
  const onKeepDefault = vi.fn();
  render(
    <AutoDesignSinkDialog
      open
      sinkBaseLabel="SB36"
      products={[undermount, farmhouse]}
      loading={false}
      catalogUnavailable={false}
      placedSinkCount={0}
      onKeepDefault={onKeepDefault}
      onChoose={onChoose}
      {...overrides}
    />,
  );
  return { onChoose, onKeepDefault };
}

describe("AutoDesignSinkDialog", () => {
  it("opens as a pop-up next to the faucet step, not an inline row", () => {
    renderDialog();
    expect(screen.getByTestId("auto-design-sink-dialog")).toBeTruthy();
    expect(screen.getByText(/Choose a sink/)).toBeTruthy();
    // The dialog says the pick is placed automatically, not dragged.
    expect(screen.getByText(/automatically, centered in the opening/i)).toBeTruthy();
  });

  it("lists the catalog sinks and states the base each one pairs with", () => {
    renderDialog();
    expect(screen.getByTestId("auto-design-sink-pairing-1083").textContent).toMatch(/30″ or wider/);
    expect(screen.getByTestId("auto-design-sink-pairing-978").textContent).toMatch(/farmhouse/i);
  });

  it("filters to farmhouse sinks and passes the exact catalog row through", () => {
    const { onChoose } = renderDialog();
    fireEvent.click(screen.getByTestId("auto-design-sink-filter-farmhouse"));
    expect(screen.queryByTestId("auto-design-sink-card-use-1083")).toBeNull();
    fireEvent.click(screen.getByTestId("auto-design-sink-card-use-978"));
    expect(onChoose).toHaveBeenCalledWith(farmhouse, false);
  });

  it("keeps the default basin without choosing anything", () => {
    const { onKeepDefault, onChoose } = renderDialog();
    fireEvent.click(screen.getByTestId("auto-design-sink-keep"));
    expect(onKeepDefault).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("offers a second sink without stacking it on the first", () => {
    renderDialog({ placedSinkCount: 2 });
    expect(screen.getByText(/no two basins share one cabinet/i)).toBeTruthy();
    expect(screen.getByTestId("auto-design-sink-apply-all")).toBeTruthy();
  });

  it("says so when the catalog returns nothing", () => {
    renderDialog({ catalogUnavailable: true, products: [] });
    expect(screen.getByTestId("auto-design-sink-unavailable")).toBeTruthy();
  });
});
