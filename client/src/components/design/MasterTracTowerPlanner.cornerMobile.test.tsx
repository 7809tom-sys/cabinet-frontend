// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MasterTracTowerPlanner } from "./MasterTracTowerPlanner";
import { defaultTowerConfig } from "@/lib/masterTracTower";
import type { RoomData } from "@/lib/design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
const renderPlanner = (heights: number[]) => render(
  <MasterTracTowerPlanner
    initialConfig={{ ...defaultTowerConfig(), corner: "start", cornerAdjustableHeightsIn: heights }}
    initialWall="top"
    initialStartIn={0}
    room={room}
    placed={[]}
    openings={[]}
    editGroupId={null}
    onClose={vi.fn()}
    onCommit={vi.fn(() => ({ ok: true }))}
  />,
);

describe("MasterTrac corner shelf elevation controls", () => {
  afterEach(() => cleanup());

  it("gives each additional shelf a labeled, full-width elevation row and a touch-sized Remove action", () => {
    renderPlanner([12, 24, 36, 48]);
    const rows = screen.getAllByTestId("corner-shelf-elevation-row");
    expect(rows).toHaveLength(4);
    rows.forEach((row, index) => {
      expect(within(row).getByText(`Shelf ${index + 1}`)).toBeTruthy();
      expect(within(row).getByRole("spinbutton", { name: `Adjustable corner shelf ${index + 1} elevation` })).toHaveProperty("value", String([12, 24, 36, 48][index]));
      expect(within(row).getByRole("button", { name: `Remove adjustable corner shelf ${index + 1}` }).className).toContain("h-11");
    });
    const field = screen.getByRole("spinbutton", { name: "Adjustable corner shelf 1 elevation" });
    fireEvent.click(screen.getByRole("button", { name: "Raise adjustable corner shelf 1 by one inch" }));
    expect(field).toHaveProperty("value", "13");
    fireEvent.click(screen.getByRole("button", { name: "Remove adjustable corner shelf 2" }));
    expect(screen.getAllByTestId("corner-shelf-elevation-row")).toHaveLength(3);
    const levelList = screen.getByTestId("corner-shelf-elevation-list");
    Object.defineProperty(levelList, "scrollHeight", { configurable: true, value: 420 });
    fireEvent.click(screen.getByTestId("add-adjustable-corner-shelf"));
    expect(screen.getAllByTestId("corner-shelf-elevation-row")).toHaveLength(4);
    expect(levelList.scrollTop).toBe(420);
  });

  it("disables a one-inch tap if it would overlap another shelf or exceed the sourced panel", () => {
    renderPlanner([0, 1, 85.5]);
    expect(screen.getByRole("button", { name: "Raise adjustable corner shelf 1 by one inch" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Lower adjustable corner shelf 2 by one inch" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Raise adjustable corner shelf 3 by one inch" })).toHaveProperty("disabled", true);
    expect(screen.queryByTestId("tower-validation-error")).toBeNull();
  });

  it("highlights both colliding boards in the controls and elevation, blocks placement, then clears when corrected", () => {
    renderPlanner([42]);
    const field = screen.getByRole("spinbutton", { name: "Adjustable corner shelf 1 elevation" });
    fireEvent.change(field, { target: { value: "86" } }); // fixed primary is at 86.25 in
    const warning = screen.getByTestId("corner-clearance-warning");
    expect(warning.getAttribute("role")).toBe("alert");
    expect(warning.textContent).toMatch(/¾.*between shelf bottoms/i);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByTestId("corner-shelf-elevation-row").getAttribute("data-clearance-state")).toBe("overlap");
    expect(screen.getAllByTestId("tower-corner-elevation-level").filter((level) => level.getAttribute("data-clearance-state") === "overlap")).toHaveLength(2);
    expect(screen.getByTestId("tower-corner-elevation-collision-badge").textContent).toMatch(/overlapping shelves/i);
    expect(screen.getByTestId("place-connected-tower")).toHaveProperty("disabled", true);
    fireEvent.change(field, { target: { value: "85.5" } }); // exactly ¾ in below the primary
    expect(screen.queryByTestId("corner-clearance-warning")).toBeNull();
    expect(field.getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByTestId("corner-shelf-elevation-row").getAttribute("data-clearance-state")).toBe("touching");
    expect(screen.getByTestId("corner-clearance-contact").textContent).toMatch(/no clear gap.*support spacing not specified/i);
    expect(screen.queryByTestId("tower-corner-elevation-collision-badge")).toBeNull();
    expect(screen.getByTestId("place-connected-tower")).toHaveProperty("disabled", false);
    fireEvent.change(field, { target: { value: "84" } });
    expect(screen.getByTestId("corner-shelf-elevation-row").getAttribute("data-clearance-state")).toBe("clear");
    expect(screen.queryByTestId("corner-clearance-contact")).toBeNull();
  });

  it("flags an out-of-panel or empty typed height instead of silently accepting zero", () => {
    renderPlanner([42]);
    const field = screen.getByRole("spinbutton", { name: "Adjustable corner shelf 1 elevation" });
    fireEvent.change(field, { target: { value: "87" } });
    expect(screen.getByTestId("corner-shelf-elevation-row").getAttribute("data-clearance-state")).toBe("out-of-panel");
    expect(screen.getByTestId("corner-clearance-warning").textContent).toMatch(/panel height/i);
    expect(screen.getByTestId("place-connected-tower")).toHaveProperty("disabled", true);
    fireEvent.change(field, { target: { value: "" } });
    expect(field).toHaveProperty("value", "");
    expect(screen.getByTestId("corner-shelf-elevation-row").getAttribute("data-clearance-state")).toBe("invalid-height");
    expect(screen.getByTestId("place-connected-tower")).toHaveProperty("disabled", true);
  });
});
