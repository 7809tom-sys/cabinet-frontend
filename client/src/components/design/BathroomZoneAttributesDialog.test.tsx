// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BathroomZoneAttributesDialog from "./BathroomZoneAttributesDialog";
import { makeBathroomStarterTemplate } from "@/lib/bathroomPlanning";

afterEach(cleanup);

describe("Bathroom planning zone Attributes", () => {
  it("applies a new reserved floor size in one callback without editing a Pelican fixture", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const starter = makeBathroomStarterTemplate();
    const zone = starter.furniture.find((item) => item.defId === "bathroom-zone-tub-60")!;
    render(<BathroomZoneAttributesDialog item={zone} room={starter.room} onSave={onSave} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Zone width (in)"), { target: { value: "72" } });
    fireEvent.change(screen.getByLabelText("From left wall (in)"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply zone Attributes" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ uid: zone.uid, defId: "bathroom-zone-tub-60", planningZoneSize: { version: 1, widthIn: 72, depthIn: 36 }, x: 12 });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(zone.planningZoneSize).toBeUndefined();
  });

  it("keeps the dialog open and commits nothing for a zone larger than its room", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const starter = makeBathroomStarterTemplate();
    render(<BathroomZoneAttributesDialog item={starter.furniture[2]} room={starter.room} onSave={onSave} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Zone width (in)"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply zone Attributes" }));
    expect(screen.getByRole("alert").textContent).toContain("room");
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels without changing reserved dimensions", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const starter = makeBathroomStarterTemplate();
    render(<BathroomZoneAttributesDialog item={starter.furniture[2]} room={starter.room} onSave={onSave} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Zone width (in)"), { target: { value: "72" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
