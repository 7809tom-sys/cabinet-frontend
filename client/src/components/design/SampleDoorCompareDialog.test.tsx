// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { DoorAuditDoorProfile } from "@/lib/doorRenderingAudit";

const capture = vi.fn();
const dispose = vi.fn();
vi.mock("@/lib/doorAuditDoorRender", () => ({
  createDoorAuditCapture: () => ({ capture, dispose }),
}));

const { SampleDoorCompareDialog } = await import("./SampleDoorCompareDialog");

const PROFILE: DoorAuditDoorProfile = {
  doorStyle: "Shaker",
  doorPanelType: "flat",
  railWidth: 2.25,
  stileWidth: 2.25,
  panelConstruction: "flat",
  bevelWidth: null,
  bevelDepth: null,
  insideEdgeProfile: null,
  drawerFrontType: null,
  grainDirection: "vertical-stiles-horizontal-rails",
  finishSheen: "satin",
};

function renderDialog(overrides: Partial<Parameters<typeof SampleDoorCompareDialog>[0]> = {}) {
  return render(
    <SampleDoorCompareDialog
      open
      onOpenChange={() => {}}
      styleName="Shaker White"
      samplePhotoUrl="/approved/shaker-white.png"
      doorProfile={PROFILE}
      style={{ styleId: 330014, name: "Shaker White", identity: { color: "#f2efe7" } }}
      distributorName="WalzCraft"
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  capture.mockReset();
  dispose.mockReset();
});

describe("SampleDoorCompareDialog", () => {
  it("shows the sample photograph and a real render side by side", async () => {
    capture.mockResolvedValue({ base64: "iVBORw0KGgoAAAANSUhEUg", width: 720, height: 1080 });
    renderDialog();

    const sample = await screen.findByTestId("sample-door-compare-sample-image");
    expect(sample.getAttribute("src")).toBe("/approved/shaker-white.png");
    expect(sample.getAttribute("alt")).toContain("sample door photograph");

    const rendered = await screen.findByTestId("sample-door-compare-render-image");
    // A decoded PNG, not a placeholder.
    expect(rendered.getAttribute("src")).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg");
    expect(rendered.getAttribute("alt")).toContain("3D render");
    // Both panes are labelled.
    expect(screen.getAllByText("Sample door").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Your design").length).toBeGreaterThan(0);
  });

  it("releases the capture session after rendering", async () => {
    capture.mockResolvedValue({ base64: "AAA", width: 720, height: 1080 });
    renderDialog();
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("says a style has no photograph instead of showing a broken image", async () => {
    capture.mockResolvedValue({ base64: "AAA", width: 720, height: 1080 });
    renderDialog({ samplePhotoUrl: null });
    expect(await screen.findByTestId("sample-door-compare-no-photo")).toBeTruthy();
    expect(screen.queryByTestId("sample-door-compare-sample-image")).toBeNull();
  });

  it("reports a failed capture rather than leaving the pane blank", async () => {
    capture.mockRejectedValue(new Error("The door render produced an empty image."));
    renderDialog();
    const error = await screen.findByTestId("sample-door-compare-render-error");
    expect(error.textContent).toContain("empty image");
    expect(screen.queryByTestId("sample-door-compare-render-image")).toBeNull();
  });

  it("explains a style with no profile instead of rendering nothing", async () => {
    renderDialog({ doorProfile: null });
    const error = await screen.findByTestId("sample-door-compare-render-error");
    expect(error.textContent).toContain("no profile");
    expect(capture).not.toHaveBeenCalled();
  });

  it("closes from its own button", async () => {
    capture.mockResolvedValue({ base64: "AAA", width: 720, height: 1080 });
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });
    (await screen.findByTestId("sample-door-compare-close")).click();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
