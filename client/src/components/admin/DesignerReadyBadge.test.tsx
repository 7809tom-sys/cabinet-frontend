// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DesignerReadyBadge from "./DesignerReadyBadge";
import type { DesignerReadyCabinet } from "@shared/designerReadyOverride";

afterEach(cleanup);

/** W3024: a wall cabinet that passes every check but has no catalog dimensions. */
const flagged: DesignerReadyCabinet = {
  id: 481,
  masterCode: "W3024",
  description: '30" x 24" Wall Cabinet',
  category: "Wall",
  subCategory: "Wall Cabinet",
  width: null,
  height: null,
  depth: null,
  designerEligible: false,
};

/** A cabinet the catalog considers fine, which an admin may still turn off. */
const healthy: DesignerReadyCabinet = { ...flagged, width: 30, height: 24, depth: 12, designerEligible: true };

function actions() {
  const run = vi.fn();
  return { run, pending: false };
}

describe("a flagged item", () => {
  it("shows the red flag to everyone", () => {
    render(<DesignerReadyBadge cabinet={flagged} role="distributor" />);
    expect(screen.getByTestId("designer-ready-flagged").textContent).toContain("Not designer ready");
  });

  it("gives an admin a Make designer ready button that confirms first", () => {
    const a = actions();
    render(<DesignerReadyBadge cabinet={flagged} role="admin" actions={a} />);
    fireEvent.click(screen.getByTestId("designer-ready-make"));
    expect(a.run).not.toHaveBeenCalled();
    // The confirmation states the dimensions it will derive.
    expect(screen.getByTestId("designer-ready-confirm-note").textContent).toContain("30″ × 24″ × 12″ derived from W3024");
    fireEvent.click(screen.getByTestId("designer-ready-confirm"));
    expect(a.run).toHaveBeenCalledWith({ action: "ready", width: 30, height: 24, depth: 12 });
  });

  it("lets the admin cancel the confirmation", () => {
    const a = actions();
    render(<DesignerReadyBadge cabinet={flagged} role="admin" actions={a} />);
    fireEvent.click(screen.getByTestId("designer-ready-make"));
    fireEvent.click(screen.getByTestId("designer-ready-cancel"));
    expect(a.run).not.toHaveBeenCalled();
    expect(screen.getByTestId("designer-ready-make")).toBeTruthy();
  });

  it("offers Turn off designer even on a flagged item", () => {
    const a = actions();
    render(<DesignerReadyBadge cabinet={flagged} role="admin" actions={a} />);
    expect(screen.getByTestId("designer-turn-off")).toBeTruthy();
  });

  it("names the missing field instead of offering a button when the SKU cannot be parsed", () => {
    render(<DesignerReadyBadge cabinet={{ ...flagged, masterCode: "WALL-CUSTOM" }} role="admin" actions={actions()} />);
    expect(screen.queryByTestId("designer-ready-make")).toBeNull();
    expect(screen.getByTestId("designer-ready-blocked").textContent).toContain("cannot be parsed");
  });

  it("hides every control from a non-admin", () => {
    render(<DesignerReadyBadge cabinet={flagged} role="distributor" actions={actions()} />);
    expect(screen.queryByTestId("designer-ready-make")).toBeNull();
    expect(screen.queryByTestId("designer-turn-off")).toBeNull();
    expect(screen.queryByTestId("designer-reset")).toBeNull();
  });
});

describe("a forced-ready item", () => {
  const ready: DesignerReadyCabinet = {
    ...flagged,
    designerReadyOverride: "ready",
    designerReadyOverrideBy: "Dana Reaves <dana@cabinetdealz.com>",
    designerReadyOverrideAt: "2026-11-05T19:47:00.000Z",
  };

  it("shows the approval note and who did it", () => {
    render(<DesignerReadyBadge cabinet={ready} role="admin" actions={actions()} />);
    expect(screen.getByTestId("designer-ready-note").textContent).toBe("Manually approved by Dana Reaves · Nov 5, 2026, 1:47 PM CT");
  });

  it("offers both turning it off and resetting it", () => {
    const a = actions();
    render(<DesignerReadyBadge cabinet={ready} role="admin" actions={a} />);
    expect(screen.getByTestId("designer-turn-off")).toBeTruthy();
    fireEvent.click(screen.getByTestId("designer-reset"));
    expect(a.run).toHaveBeenCalledWith({ action: "reset" });
  });
});

describe("turning an item off", () => {
  const off: DesignerReadyCabinet = {
    ...healthy,
    designerReadyOverride: "off",
    designerReadyOverrideBy: "Dana Reaves <dana@cabinetdealz.com>",
    designerReadyOverrideAt: "2026-11-05T19:47:00.000Z",
    designerOffReason: "Out of stock",
    designerOffUntil: "2027-08-01T00:00:00.000Z",
  };

  it("shows Off: reason until date on the listing", () => {
    render(<DesignerReadyBadge cabinet={off} role="admin" actions={actions()} />);
    expect(screen.getByTestId("designer-off-label").textContent).toBe("Off: Out of stock until Aug 1, 2027");
    expect(screen.getByTestId("designer-turned-off").textContent).toContain("Designer off");
  });

  it("names the administrator and the time", () => {
    render(<DesignerReadyBadge cabinet={off} role="admin" actions={actions()} />);
    expect(screen.getByTestId("designer-off-attribution").textContent).toContain("Turned off by Dana Reaves");
  });

  it("offers Reset to automatic and nothing else", () => {
    const a = actions();
    render(<DesignerReadyBadge cabinet={off} role="admin" actions={a} />);
    expect(screen.queryByTestId("designer-turn-off")).toBeNull();
    fireEvent.click(screen.getByTestId("designer-reset"));
    expect(a.run).toHaveBeenCalledWith({ action: "reset" });
  });

  it("defaults the reason to Out of stock and takes an optional date", () => {
    const a = actions();
    render(<DesignerReadyBadge cabinet={healthy} role="admin" actions={a} />);
    // A healthy item still shows nothing; turn it off from the forced-ready or
    // flagged state, so use the flagged row here.
    cleanup();
    render(<DesignerReadyBadge cabinet={{ ...flagged, designerReadyOverride: "ready" }} role="admin" actions={a} />);
    fireEvent.click(screen.getByTestId("designer-turn-off"));
    expect((screen.getByTestId("designer-off-reason") as HTMLInputElement).value).toBe("Out of stock");
    fireEvent.change(screen.getByTestId("designer-off-until"), { target: { value: "2027-08-01" } });
    fireEvent.click(screen.getByTestId("designer-off-confirm"));
    expect(a.run).toHaveBeenCalledWith({ action: "off", reason: "Out of stock", until: "2027-08-01" });
  });

  it("can be cancelled", () => {
    const a = actions();
    render(<DesignerReadyBadge cabinet={{ ...flagged, designerReadyOverride: "ready" }} role="admin" actions={a} />);
    fireEvent.click(screen.getByTestId("designer-turn-off"));
    fireEvent.click(screen.getByTestId("designer-off-cancel"));
    expect(a.run).not.toHaveBeenCalled();
  });

  it("shows no reset button to a non-admin", () => {
    render(<DesignerReadyBadge cabinet={off} role="distributor" actions={actions()} />);
    expect(screen.queryByTestId("designer-reset")).toBeNull();
    expect(within(screen.getByTestId("designer-turned-off")).getByTestId("designer-off-label")).toBeTruthy();
  });
});

describe("an item the catalog already allows", () => {
  it("renders nothing at all", () => {
    render(<DesignerReadyBadge cabinet={healthy} role="admin" actions={actions()} />);
    expect(screen.queryByTestId("designer-ready-flagged")).toBeNull();
    expect(screen.queryByTestId("designer-turned-off")).toBeNull();
    expect(screen.queryByTestId("designer-ready-approved")).toBeNull();
  });
});
