// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WallActionsMenu } from "./WallActionsMenu";

afterEach(cleanup);

const menu = { x: 40, y: 40, label: "45° right wall" };

describe("Wall actions menu delete", () => {
  it("places Delete wall under Add wall, styled as destructive, and closes after the delete action", () => {
    const onEdit = vi.fn();
    const onAdd = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<WallActionsMenu menu={menu} onEdit={onEdit} onAdd={onAdd} onDelete={onDelete} onClose={onClose} />);

    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["Edit wall", "Add wall", "Delete wall"]);
    const deleteItem = screen.getByTestId("wall-actions-delete");
    expect(deleteItem.className).toContain("text-red-700");
    expect(screen.queryByTestId("wall-actions-delete-reason")).toBeNull();

    fireEvent.click(deleteItem);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("disables Delete wall and shows the reason when the room would be invalid", () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const reason = "The last remaining wall cannot be deleted. Start a new room layout instead.";
    render(
      <WallActionsMenu
        menu={{ ...menu, label: "Back" }}
        onEdit={() => {}}
        onAdd={() => {}}
        onDelete={onDelete}
        deleteDisabledReason={reason}
        onClose={onClose}
      />,
    );

    const deleteItem = screen.getByTestId("wall-actions-delete") as HTMLButtonElement;
    expect(deleteItem.disabled).toBe(true);
    expect(screen.getByTestId("wall-actions-delete-reason").textContent).toBe(reason);
    fireEvent.click(deleteItem);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
