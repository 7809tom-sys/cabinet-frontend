// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DoorAttributesDialog } from "./DoorAttributesDialog";
import type { RoomData, WallOpening } from "@/lib/design";

const room: RoomData = { width: 120, depth: 96, ceilingHeight: 96 };
const door: WallOpening = {
  uid: "room-door-1",
  kind: "door",
  label: "Entry door",
  side: "top",
  offset: 18,
  width: 30,
  height: 80,
  sill: 0,
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof DoorAttributesDialog>> = {}) {
  const onChange = vi.fn();
  const onOpenChange = vi.fn();
  const onDelete = vi.fn();
  render(
    <DoorAttributesDialog
      opening={door}
      room={room}
      open
      onChange={onChange}
      onOpenChange={onOpenChange}
      onDelete={onDelete}
      {...overrides}
    />,
  );
  return { onChange, onOpenChange, onDelete };
}

describe("DoorAttributesDialog", () => {
  afterEach(() => cleanup());

  it("applies exact decimal width, height, color, and transparency for a regular room door", () => {
    const { onChange, onOpenChange } = renderDialog();

    fireEvent.change(screen.getByLabelText("Door width in inches"), { target: { value: "31.375" } });
    fireEvent.change(screen.getByLabelText("Door height in inches"), { target: { value: "79.25" } });
    fireEvent.change(screen.getByLabelText("Door color"), { target: { value: "#242424" } });
    fireEvent.change(screen.getByLabelText("Door transparency"), { target: { value: "75" } });
    fireEvent.click(screen.getByTestId("door-attributes-apply"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      uid: "room-door-1",
      offset: 18,
      width: 31.375,
      height: 79.25,
      doorColor: "#242424",
      doorOpacity: 0.25,
    }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("saves an inward 90-degree door swing with the chosen hinge in one Apply", () => {
    const { onChange } = renderDialog();
    fireEvent.change(screen.getByLabelText("Door position"), { target: { value:"90" } });
    fireEvent.change(screen.getByLabelText("Door hinge side"), { target: { value:"right" } });
    fireEvent.click(screen.getByTestId("door-attributes-apply"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ doorOpenAngle:90, doorHinge:"right", width:30, height:80 }));
  });

  it("discards the local draft when Cancel is used", () => {
    const { onChange, onOpenChange } = renderDialog();

    fireEvent.change(screen.getByLabelText("Door width in inches"), { target: { value: "42.5" } });
    fireEvent.change(screen.getByLabelText("Door transparency"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open with an alert and does not commit an oversized door", () => {
    const { onChange, onOpenChange } = renderDialog();

    fireEvent.change(screen.getByLabelText("Door width in inches"), { target: { value: "121" } });
    fireEvent.click(screen.getByTestId("door-attributes-apply"));

    expect(onChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("door-attributes-dialog")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/width must be between 6 and 120 inches/i);
  });

  it("loads and preserves an existing custom door color and transparency", () => {
    const existingColorDoor: WallOpening = { ...door, doorColor: "#123456", doorOpacity: 0.5 };
    const { onChange } = renderDialog({ opening: existingColorDoor });

    expect((screen.getByLabelText("Door color") as HTMLSelectElement).value).toBe("custom");
    expect((screen.getByLabelText("Custom door color") as HTMLInputElement).value).toBe("#123456");
    expect((screen.getByLabelText("Door transparency") as HTMLInputElement).value).toBe("50");

    fireEvent.click(screen.getByTestId("door-attributes-apply"));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      doorColor: "#123456",
      doorOpacity: 0.5,
    }));
  });

  it("does not render for a window or any other non-door opening", () => {
    renderDialog({ opening: { ...door, kind: "window" } });

    expect(screen.queryByTestId("door-attributes-dialog")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
