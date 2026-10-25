// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MasterTracTowerPlanner } from "./MasterTracTowerPlanner";
import { defaultTowerConfig } from "@/lib/masterTracTower";
import type { RoomData } from "@/lib/design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
function open() {
  const onCommit = vi.fn(() => ({ ok: true }));
  render(<MasterTracTowerPlanner initialConfig={{ ...defaultTowerConfig(), corner: "start" }} initialWall="top" initialStartIn={0}
    room={room} placed={[]} openings={[]} editGroupId={null} onClose={vi.fn()} onCommit={onCommit} />);
  return onCommit;
}

describe("MasterTrac mixed-storage mobile elevation picker", () => {
  afterEach(() => cleanup());

  it("keeps repeatable Add controls visible and scrolls a compact bay list through four drawers plus four shoes", () => {
    open();
    const bay = screen.getByTestId("tower-mixed-storage-2");
    const list = within(bay).getByTestId("tower-mixed-items-2");
    Object.defineProperty(list, "scrollHeight", { configurable: true, value: 880 });
    expect(list.className).toContain("overflow-y-auto");
    for (let i = 0; i < 4; i++) fireEvent.click(within(bay).getByRole("button", { name: "+ Add Drawer" }));
    for (let i = 0; i < 4; i++) fireEvent.click(within(bay).getByRole("button", { name: "+ Add Shoe" }));
    expect(within(bay).getAllByTestId("tower-mixed-item-row")).toHaveLength(10); // two existing sourced adjustable shelves were retained
    expect(list.scrollTop).toBe(880);
    expect(within(bay).getByRole("button", { name: "+ Add Drawer" }).className).toContain("h-11");
    expect(within(bay).getByRole("button", { name: "+ Add Shoe" }).className).toContain("h-11");
    expect(screen.getByTestId("place-connected-tower")).toHaveProperty("disabled", false);
    expect(screen.getAllByTestId("tower-diagram-drawer")).toHaveLength(4);
    expect(screen.getAllByTestId("tower-diagram-shoe")).toHaveLength(4);
  });

  it("blocks an overlapping typed item, allows correction, and keeps a touch-sized Remove action", () => {
    const commit = open();
    const bay = screen.getByTestId("tower-mixed-storage-2");
    fireEvent.click(within(bay).getByRole("button", { name: "+ Add Drawer" }));
    fireEvent.click(within(bay).getByRole("button", { name: "+ Add Shoe" }));
    const rows = within(bay).getAllByTestId("tower-mixed-item-row");
    const shoeRow = rows.find((row) => row.textContent?.includes("shoe"))!;
    const shoe = within(shoeRow).getByRole("spinbutton", { name: /Bay 2 shoe .* elevation/ });
    fireEvent.change(shoe, { target: { value: "7" } });
    expect(screen.getByTestId("place-connected-tower")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("tower-validation-error").textContent).toMatch(/overlap/i);
    fireEvent.change(shoe, { target: { value: "12" } });
    expect(screen.getByTestId("place-connected-tower")).toHaveProperty("disabled", false);
    const remove = within(shoeRow).getByRole("button", { name: /Remove bay 2 shoe/ });
    expect(remove.className).toContain("h-11");
    fireEvent.click(screen.getByTestId("place-connected-tower"));
    expect(commit).toHaveBeenCalledOnce();
  });
});
