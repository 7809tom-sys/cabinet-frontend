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
  const onPickSink = vi.fn();
  const onPickFaucet = vi.fn();
  const onDismiss = vi.fn();
  const utils = render(
    <DesignerFixturePickPopup
      open
      step="sink"
      sinkProducts={[sink]}
      faucetProducts={[faucet]}
      loading={false}
      onPickSink={onPickSink}
      onPickFaucet={onPickFaucet}
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { ...utils, onPickSink, onPickFaucet, onDismiss };
}

describe("DesignerFixturePickPopup", () => {
  it("opens on the sink step with no faucet list", () => {
    renderPopup();
    expect(screen.getByTestId("designer-fixture-pick-popup").getAttribute("data-step")).toBe("sink");
    expect(screen.getByText("Pick your sink")).toBeTruthy();
    expect(screen.queryByText("Pick your faucet and sink")).toBeNull();
    expect(screen.getByTestId("fixture-sink-grid")).toBeTruthy();
    expect(screen.queryByTestId("fixture-faucet-grid")).toBeNull();
  });

  it("picking a sink closes this step and does not pick a faucet", () => {
    const { onPickSink, onPickFaucet, onDismiss } = renderPopup();
    fireEvent.click(screen.getByTestId(`fixture-sink-${sink.id}`));
    expect(onPickSink).toHaveBeenCalledTimes(1);
    expect(onPickSink).toHaveBeenCalledWith(sink.id);
    expect(onPickFaucet).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("opens the faucet step only after the sink step, with no sink list", () => {
    const { onPickSink, onPickFaucet } = renderPopup({ step: "faucet" });
    expect(screen.getByText("Pick your faucet")).toBeTruthy();
    expect(screen.getByTestId("fixture-faucet-grid")).toBeTruthy();
    expect(screen.queryByTestId("fixture-sink-grid")).toBeNull();
    fireEvent.click(screen.getByTestId(`fixture-faucet-${faucet.id}`));
    expect(onPickFaucet).toHaveBeenCalledWith(faucet.id);
    expect(onPickSink).not.toHaveBeenCalled();
  });

  it("Skip for now ends the flow without picking", () => {
    const { onPickSink, onPickFaucet, onDismiss } = renderPopup();
    fireEvent.click(screen.getByTestId("fixture-pick-skip"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onPickSink).not.toHaveBeenCalled();
    expect(onPickFaucet).not.toHaveBeenCalled();
  });

  it("Skip for now on the faucet step does not pick a faucet", () => {
    const { onPickFaucet, onDismiss } = renderPopup({ step: "faucet" });
    fireEvent.click(screen.getByTestId("fixture-pick-skip"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onPickFaucet).not.toHaveBeenCalled();
  });

  it("shows 'Price unavailable' for a product with a null sellPrice", () => {
    renderPopup();
    expect(screen.getByText("Price unavailable")).toBeTruthy();
  });

  it("calls onDismiss when Escape is pressed and does not open the next step", () => {
    const { onDismiss, onPickFaucet } = renderPopup();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
    expect(onPickFaucet).not.toHaveBeenCalled();
  });
});

describe("DesignerFixturePickPopup photo grid", () => {
  it("shows the sink as a photo tile, with a placeholder when a photo is missing", () => {
    renderPopup({
      faucetProducts: [{ ...faucet, imageUrl: "https://example.test/pl-8203.png" }],
    });
    const sinkTile = screen.getByTestId(`fixture-sink-${sink.id}`);
    expect(sinkTile.querySelector("img")).toBeNull();
    expect(sinkTile.querySelector('[data-testid="product-photo-placeholder"]')).toBeTruthy();
    expect(sinkTile.textContent).toContain(sink.name);
  });

  it("shows the faucet photo on the faucet step", () => {
    renderPopup({
      step: "faucet",
      faucetProducts: [{ ...faucet, imageUrl: "https://example.test/pl-8203.png" }],
    });
    const faucetTile = screen.getByTestId(`fixture-faucet-${faucet.id}`);
    expect(faucetTile.querySelector("img")?.getAttribute("src")).toBe("https://example.test/pl-8203.png");
  });
});
