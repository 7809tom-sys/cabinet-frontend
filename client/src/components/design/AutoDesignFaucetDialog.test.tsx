// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoDesignFaucetDialog } from "./AutoDesignFaucetDialog";
import type { AutoDesignFaucetProduct } from "@/lib/autoDesignFaucet";

afterEach(cleanup);

const pelican: AutoDesignFaucetProduct = {
  id: 8203,
  name: "PL-8203 Fountain Series Pull-Down Kitchen Faucet",
  pelicanCode: "PL-8203",
  category: "Sinks & Faucets",
  subCategory: "Faucets",
  imageUrl: "https://example.test/pl-8203.png",
  sellPrice: 249,
};
const other: AutoDesignFaucetProduct = {
  id: 42,
  name: "Bridge Kitchen Faucet",
  brand: "Other Vendor",
  finish: "Matte Black",
  category: "Sinks & Faucets",
  subCategory: "Faucets",
  sellPrice: 180,
};

describe("AutoDesignFaucetDialog", () => {
  it("filters catalog faucets by brand and applies one choice or every sink", () => {
    const onChoose = vi.fn();
    const onKeepDefault = vi.fn();
    render(
      <AutoDesignFaucetDialog
        open
        sinkLabel="SB36"
        sinkCount={2}
        products={[pelican, other]}
        loading={false}
        catalogUnavailable={false}
        onKeepDefault={onKeepDefault}
        onChoose={onChoose}
      />,
    );

    expect(screen.getByText("PL-8203 Fountain Series Pull-Down Kitchen Faucet")).toBeTruthy();
    expect(screen.getByText("Matte Black")).toBeTruthy();
    expect(screen.getAllByText("Other Vendor").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("auto-design-faucet-brand-Pelican"));
    expect(screen.queryByText("Bridge Kitchen Faucet")).toBeNull();
    fireEvent.click(screen.getByTestId("auto-design-faucet-option-8203"));
    fireEvent.click(screen.getByTestId("auto-design-faucet-use"));
    expect(onChoose).toHaveBeenCalledWith(pelican, false);

    fireEvent.click(screen.getByTestId("auto-design-faucet-apply-all"));
    expect(onChoose).toHaveBeenLastCalledWith(pelican, true);
    fireEvent.click(screen.getByTestId("auto-design-faucet-keep"));
    expect(onKeepDefault).toHaveBeenCalledTimes(1);
  });

  it("keeps the default when the catalog returns nothing", () => {
    const onKeepDefault = vi.fn();
    render(
      <AutoDesignFaucetDialog
        open
        sinkLabel="this sink"
        sinkCount={1}
        products={[]}
        loading={false}
        catalogUnavailable
        onKeepDefault={onKeepDefault}
        onChoose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("auto-design-faucet-unavailable").textContent).toContain("did not return any products");
    expect(screen.queryByTestId("auto-design-faucet-apply-all")).toBeNull();
    fireEvent.click(screen.getByTestId("auto-design-faucet-keep"));
    expect(onKeepDefault).toHaveBeenCalledTimes(1);
  });
});

describe("AutoDesignFaucetDialog photo grid", () => {
  it("shows each faucet as a photo tile and says StoneCreek instead of the supplier name", () => {
    const onChoose = vi.fn();
    render(
      <AutoDesignFaucetDialog
        open
        sinkLabel="SB36"
        sinkCount={1}
        products={[pelican, other]}
        loading={false}
        catalogUnavailable={false}
        onKeepDefault={vi.fn()}
        onChoose={onChoose}
      />,
    );
    const tile = screen.getByTestId("auto-design-faucet-option-8203");
    expect(tile.querySelector("img")?.getAttribute("src")).toBe("https://example.test/pl-8203.png");
    const noPhoto = screen.getByTestId("auto-design-faucet-option-42");
    expect(noPhoto.querySelector('[data-testid="product-photo-placeholder"]')).toBeTruthy();
    expect(noPhoto.textContent).toContain("Bridge Kitchen Faucet");
    expect(screen.getByTestId("auto-design-faucet-brand-Pelican").textContent).toBe("StoneCreek");
    expect(screen.getByTestId("auto-design-faucet-dialog").textContent).not.toContain("Pelican");
    fireEvent.click(tile);
    expect(tile.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByTestId("auto-design-faucet-use"));
    expect(onChoose).toHaveBeenCalledWith(pelican, false);
  });
});
