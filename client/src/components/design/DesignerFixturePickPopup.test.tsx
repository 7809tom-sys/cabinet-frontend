// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesignerFixturePickPopup } from "./DesignerFixturePickPopup";
import type { AutoDesignFaucetProduct } from "@/lib/autoDesignFaucet";
import type { AutoDesignSinkProduct } from "@/lib/autoDesignSink";

afterEach(cleanup);

const faucet: AutoDesignFaucetProduct = {
  id: 8203,
  name: "PL-8203 Fountain Series Pull-Down Kitchen Faucet",
  pelicanCode: "PL-8203",
  category: "Sinks & Faucets",
  subCategory: "Faucets",
  sellPrice: 249,
};

const sink: AutoDesignSinkProduct = {
  id: 501,
  name: "PL-501 Undermount Kitchen Sink",
  category: "Sinks & Faucets",
  subCategory: "Sinks",
  sellPrice: null,
};

function renderPopup(overrides: Partial<Parameters<typeof DesignerFixturePickPopup>[0]> = {}) {
  const onSave = vi.fn();
  const onDismiss = vi.fn();
  const utils = render(
    <DesignerFixturePickPopup
      open
      sinkProducts={[sink]}
      faucetProducts={[faucet]}
      loading={false}
      onSave={onSave}
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { ...utils, onSave, onDismiss };
}

describe("DesignerFixturePickPopup", () => {
  it("shows the title when open", () => {
    renderPopup();
    expect(screen.getByTestId("designer-fixture-pick-popup")).toBeTruthy();
    expect(screen.getByText("Pick your faucet and sink")).toBeTruthy();
  });

  it("calls onDismiss and not onSave when 'Skip for now' is clicked", () => {
    const { onSave, onDismiss } = renderPopup();
    fireEvent.click(screen.getByTestId("fixture-pick-skip"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave with the picked sink and faucet ids", () => {
    const { onSave } = renderPopup();
    fireEvent.click(screen.getByTestId(`fixture-sink-${sink.id}`));
    fireEvent.click(screen.getByTestId(`fixture-faucet-${faucet.id}`));
    fireEvent.click(screen.getByTestId("fixture-pick-save"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ sinkId: sink.id, faucetId: faucet.id });
  });

  it("disables Save when nothing is picked", () => {
    renderPopup();
    const save = screen.getByTestId("fixture-pick-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it("shows 'Price unavailable' for a product with a null sellPrice", () => {
    renderPopup();
    expect(screen.getByText("Price unavailable")).toBeTruthy();
  });

  it("calls onDismiss when Escape is pressed", () => {
    const { onDismiss } = renderPopup();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("DesignerFixturePickPopup photo grid", () => {
  it("shows sinks and faucets as photo tiles, with a placeholder when a photo is missing", () => {
    renderPopup({
      faucetProducts: [{ ...faucet, imageUrl: "https://example.test/pl-8203.png" }],
    });
    expect(screen.getByTestId("fixture-sink-grid")).toBeTruthy();
    expect(screen.getByTestId("fixture-faucet-grid")).toBeTruthy();
    const faucetTile = screen.getByTestId(`fixture-faucet-${faucet.id}`);
    expect(faucetTile.querySelector("img")?.getAttribute("src")).toBe("https://example.test/pl-8203.png");
    const sinkTile = screen.getByTestId(`fixture-sink-${sink.id}`);
    expect(sinkTile.querySelector("img")).toBeNull();
    expect(sinkTile.querySelector('[data-testid="product-photo-placeholder"]')).toBeTruthy();
    expect(sinkTile.textContent).toContain(sink.name);
  });

  it("toggles the selected tile and keeps Save wired to the same ids", () => {
    const { onSave } = renderPopup();
    const tile = screen.getByTestId(`fixture-sink-${sink.id}`);
    fireEvent.click(tile);
    expect(tile.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tile);
    expect(tile.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(tile);
    fireEvent.click(screen.getByTestId("fixture-pick-save"));
    expect(onSave).toHaveBeenCalledWith({ sinkId: sink.id, faucetId: null });
  });
});
