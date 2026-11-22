// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLocation } from "wouter";
import { DistributorDesignerShell } from "./DistributorPreview";
import { DealersSection } from "./DistributorDealerGate";
import { DEALERS_PAGE_COPY, DEALER_GATE_COPY, DEMO_DEALERS } from "@/lib/demoDealers";

afterEach(cleanup);

/** Stands in for the designer: buys the way DesignTool does (navigate to the cart). */
function FakeDesigner() {
  const [, navigate] = useLocation();
  return (
    <div>
      <button onClick={() => navigate("/cart")}>Add to cart</button>
      <button onClick={() => navigate("/store/sales-demo/checkout")}>Checkout</button>
      <button onClick={() => navigate("/distributor-preview/design?view=3d")}>Switch view</button>
    </div>
  );
}

describe("dealer-only purchase gate", () => {
  it("catches cart/checkout navigation from the designer and routes the plan to the nearest dealer", async () => {
    window.history.replaceState(null, "", "/distributor-preview/design");
    render(<DistributorDesignerShell><FakeDesigner /></DistributorDesignerShell>);

    fireEvent.click(screen.getByText("Add to cart"));
    expect(window.location.pathname).toBe("/distributor-preview/design");
    expect(await screen.findByText(DEALER_GATE_COPY.headline)).toBeTruthy();
    expect(screen.getByText(DEALER_GATE_COPY.framing)).toBeTruthy();
    // jsdom has no geolocation, so the pre-filled demo ZIP (60601) is used.
    await waitFor(() => expect(screen.getByText(DEALER_GATE_COPY.sent("Brindlewood Cabinet Studio"))).toBeTruthy(), { timeout: 4000 });
    expect(screen.getByText(DEALER_GATE_COPY.final("Cabinet Deals Demo Distributor", "Brindlewood Cabinet Studio"))).toBeTruthy();
    expect(screen.getByText(DEALER_GATE_COPY.other).getAttribute("href")).toBe("/distributor-preview/dealers?zip=60601");

    // A different ZIP re-recommends and re-sends.
    fireEvent.change(screen.getByLabelText(DEALER_GATE_COPY.zipLabel), { target: { value: "10001" } });
    fireEvent.click(screen.getByText(DEALER_GATE_COPY.zipButton));
    await waitFor(() => expect(screen.getByText(DEALER_GATE_COPY.sent("Saltmarsh Kitchen Works"))).toBeTruthy(), { timeout: 4000 });
  });

  it("also gates store checkout routes and lets ordinary navigation through", async () => {
    window.history.replaceState(null, "", "/distributor-preview/design");
    render(<DistributorDesignerShell><FakeDesigner /></DistributorDesignerShell>);
    fireEvent.click(screen.getByText("Switch view"));
    expect(window.location.search).toBe("?view=3d");
    expect(screen.queryByText(DEALER_GATE_COPY.headline)).toBeNull();
    fireEvent.click(screen.getByText("Checkout"));
    expect(window.location.pathname).toBe("/distributor-preview/design");
    expect(await screen.findByText(DEALER_GATE_COPY.headline)).toBeTruthy();
  });

  it("opens from the shell's Get my price button", async () => {
    window.history.replaceState(null, "", "/distributor-preview/design");
    render(<DistributorDesignerShell><div /></DistributorDesignerShell>);
    fireEvent.click(screen.getByTestId("designer-get-price"));
    expect(await screen.findByText(DEALER_GATE_COPY.headline)).toBeTruthy();
  });
});

describe("sample dealers page", () => {
  it("lists every sample dealer, marks them fictional, and confirms a demo send", () => {
    window.history.replaceState(null, "", "/distributor-preview/dealers?zip=60601");
    render(<DealersSection />);
    expect(screen.getByText(DEALERS_PAGE_COPY.sample)).toBeTruthy();
    for (const d of DEMO_DEALERS) expect(screen.getByText(d.name)).toBeTruthy();
    expect(document.querySelector("[data-dealer-id]")?.getAttribute("data-dealer-id")).toBe("brindlewood");
    const buttons = screen.getAllByText(DEALERS_PAGE_COPY.send);
    expect(buttons).toHaveLength(DEMO_DEALERS.length);
    fireEvent.click(buttons[0]);
    expect(screen.getByText(DEALERS_PAGE_COPY.sent)).toBeTruthy();
  });
});
