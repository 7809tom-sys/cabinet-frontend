// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FourAnchorAutoBuildDialog } from "./FourAnchorAutoBuildDialog";

afterEach(cleanup);

describe("FourAnchorAutoBuildDialog", () => {
  it("explains the required build order and excludes automatic specialty-base selection", () => {
    render(<FourAnchorAutoBuildDialog open onOpenChange={vi.fn()} onBuild={() => ({ ok: true })} />);
    const order = screen.getByTestId("four-anchor-build-order").textContent ?? "";
    expect(order).toContain("1. Measured appliances and sink base");
    expect(order).toContain("2. Select and place the required corner cabinets");
    expect(order).toContain("3. Fill remaining runs with the largest practical regular base cabinets");
    expect(order).toContain("4. Place source-sized, aligned wall cabinets above");
    expect(order).toContain("Specialty bases are not selected automatically");
  });

  it("submits the selected wall-cabinet height as a real build input", () => {
    const onBuild = vi.fn((): { ok: true } => ({ ok: true }));
    render(<FourAnchorAutoBuildDialog open onOpenChange={vi.fn()} onBuild={onBuild} />);

    expect(screen.getByText("Wall-cabinet height")).toBeTruthy();
    fireEvent.click(screen.getByTestId("four-anchor-build-submit"));

    expect(onBuild).toHaveBeenCalledWith(expect.objectContaining({
      wallCabinetHeightIn: 30,
      sinkBaseWidthIn: 36,
      dishwasherSide: "right",
    }));
  });

  it("builds a regular sink base unless the admin explicitly chooses farmhouse", () => {
    const onBuild = vi.fn((): { ok: true } => ({ ok: true }));
    render(<FourAnchorAutoBuildDialog open onOpenChange={vi.fn()} onBuild={onBuild} />);
    expect(screen.getByText("Sink base style")).toBeTruthy();
    fireEvent.click(screen.getByTestId("four-anchor-build-submit"));
    expect(onBuild).toHaveBeenCalledWith(expect.objectContaining({ sinkBaseKind: "regular" }));
  });

  it("offers Wall 1 through Wall 6 and submits an explicit no-appliance choice without guessing placements", () => {
    const onBuild = vi.fn((): { ok: true } => ({ ok: true }));
    render(<FourAnchorAutoBuildDialog open onOpenChange={vi.fn()} onBuild={onBuild} wallCount={6} />);

    fireEvent.click(screen.getByLabelText("Sink base — place on wall"));
    expect(screen.getByRole("option", { name: "Wall 5" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Wall 6" })).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "Wall 5" }));

    for (const [label, omission] of [
      ["Range / stove — place on wall", "Do not add Range / stove"],
      ["Dishwasher — place on wall when using an exact center", "Do not add Dishwasher"],
      ["Refrigerator — place on wall", "Do not add Refrigerator"],
    ]) {
      fireEvent.click(screen.getByLabelText(label));
      fireEvent.click(screen.getByRole("option", { name: omission }));
    }
    expect(screen.queryByTestId("four-anchor-refrigerator-options")).toBeNull();
    expect((screen.getByLabelText("Dishwasher position") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("four-anchor-build-submit"));

    expect(onBuild).toHaveBeenCalledWith(expect.objectContaining({
      sink: expect.objectContaining({ wallLabel: "Wall 5" }),
      stove: null,
      dishwasher: null,
      skipDishwasher: true,
      refrigerator: null,
    }));
  });

  it("keeps the colored Floor Plan wall key synchronized with the selected starting corner and run direction", () => {
    const onWallGuideChange = vi.fn();
    render(<FourAnchorAutoBuildDialog open onOpenChange={vi.fn()} onBuild={() => ({ ok: true })} wallCount={6} onWallGuideChange={onWallGuideChange} />);

    expect(screen.getByTestId("four-anchor-floor-plan-wall-key").textContent).toContain("Colored Wall 1–6 markers");
    expect(onWallGuideChange).toHaveBeenLastCalledWith({ originCorner: "left", runDirection: "right" });

    fireEvent.click(screen.getByLabelText("Run direction"));
    fireEvent.click(screen.getByRole("option", { name: "To the left" }));
    expect(onWallGuideChange).toHaveBeenLastCalledWith({ originCorner: "left", runDirection: "left" });

    fireEvent.click(screen.getByLabelText("Starting corner"));
    fireEvent.click(screen.getByRole("option", { name: "Right corner" }));
    expect(onWallGuideChange).toHaveBeenLastCalledWith({ originCorner: "right", runDirection: "left" });
  });

  it("offers an explicit blank six-wall sample room action for staff training without building a kitchen", () => {
    const onLoadSixWallTrainingRoom = vi.fn((): { ok: true } => ({ ok: true }));
    const onBuild = vi.fn((): { ok: true } => ({ ok: true }));
    render(
      <FourAnchorAutoBuildDialog
        open
        onOpenChange={vi.fn()}
        onBuild={onBuild}
        onLoadSixWallTrainingRoom={onLoadSixWallTrainingRoom}
      />,
    );

    fireEvent.click(screen.getByTestId("four-anchor-load-six-wall-training-room"));

    expect(onLoadSixWallTrainingRoom).toHaveBeenCalledTimes(1);
    expect(onBuild).not.toHaveBeenCalled();
    expect(screen.getByText("Load six-wall training room")).toBeTruthy();
  });

  it("does not render a blocking modal backdrop so the colored Floor Plan wall tips remain hoverable", () => {
    render(<FourAnchorAutoBuildDialog open onOpenChange={vi.fn()} onBuild={() => ({ ok: true })} />);

    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
  });

  it("docks on the wide desktop edge so the colored Floor Plan guide stays visible during Four-Anchor entry", () => {
    render(<FourAnchorAutoBuildDialog open onOpenChange={vi.fn()} onBuild={() => ({ ok: true })} />);
    const dialog = screen.getByTestId("four-anchor-auto-build-dialog");
    expect(dialog.className).toContain("2xl:!right-4");
    expect(dialog.className).toContain("2xl:!left-auto");
  });

  it("keeps a failed submit visible in the dialog with its exact blocker rather than appearing inert", () => {
    const onBuild = vi.fn(() => ({
      ok: false as const,
      message: "The selected cabinet catalog is still loading. Wait for its source-priced items, then try again.",
    }));
    render(<FourAnchorAutoBuildDialog open onOpenChange={vi.fn()} onBuild={onBuild} />);

    fireEvent.click(screen.getByTestId("four-anchor-build-submit"));

    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toContain("selected cabinet catalog is still loading");
    expect((screen.getByTestId("four-anchor-build-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows source-priced catalog loading and disables the build action until it is ready", () => {
    const onBuild = vi.fn((): { ok: true } => ({ ok: true }));
    render(<FourAnchorAutoBuildDialog open catalogLoading onOpenChange={vi.fn()} onBuild={onBuild} />);

    expect(screen.getByTestId("four-anchor-catalog-loading").textContent).toContain("Loading the selected line’s source-priced cabinets");
    const build = screen.getByTestId("four-anchor-build-submit") as HTMLButtonElement;
    expect(build.disabled).toBe(true);
    fireEvent.click(build);
    expect(onBuild).not.toHaveBeenCalled();
  });
});
