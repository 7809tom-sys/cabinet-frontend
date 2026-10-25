// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { WallOpening } from "@/lib/design";
import { WindowAttributesDialog } from "./WindowAttributesDialog";

describe("WindowAttributesDialog", () => {
  afterEach(cleanup);

  it("shows the selected saved window with four-direction movement and exact measurement controls", () => {
    render(createElement(LanguageProvider, null, createElement(WindowAttributesDialog, {
      opening: { uid: "window-1", kind: "window", label: 'Window 36"', side: "top", offset: 54, width: 36, height: 36, sill: 42 },
      room: { width: 144, depth: 120, ceilingHeight: 96 },
      open: true,
      onOpenChange: () => undefined,
      onChange: () => undefined,
      onDelete: () => undefined,
    })));
    expect(screen.getByTestId("window-attributes-dialog").textContent).toContain("Window attributes");
    expect(screen.getByLabelText("Move window down 1 inch")).toBeTruthy();
    expect(screen.getByLabelText("Move window up 1 inch")).toBeTruthy();
    expect(screen.getByLabelText("Move toward start of wall")).toBeTruthy();
    expect(screen.getByLabelText("Move toward end of wall")).toBeTruthy();
    expect(screen.getByLabelText("Window position reference")).toBeTruthy();
    expect(screen.getByLabelText("Window distance from wall start / left in inches")).toBeTruthy();
  });

  it("shows scene, frame, and mullion controls and saves each choice on the selected window", () => {
    const changes: WallOpening[] = [];
    const onChange = vi.fn((next: WallOpening) => { changes.push(next); });
    render(createElement(LanguageProvider, null, createElement(WindowAttributesDialog, {
      opening: { uid: "window-appearance-1", kind: "window", label: 'Window 36"', side: "top", offset: 24, width: 36, height: 36, sill: 42 },
      room: { width: 144, depth: 120, ceilingHeight: 96 },
      open: true,
      onOpenChange: () => undefined,
      onChange,
      onDelete: () => undefined,
    })));
    expect(screen.getByLabelText("Window scene for this window")).toBeTruthy();
    expect(screen.getByLabelText("Window frame finish for this window")).toBeTruthy();
    expect(screen.getByLabelText("Window construction style for this window")).toBeTruthy();
    expect(screen.getByLabelText("Window mullion grid for this window")).toBeTruthy();
    expect(screen.getByLabelText("Common window proportion")).toBeTruthy();
    expect(screen.getByLabelText("Common over-sink sill height")).toBeTruthy();
    expect(screen.getByTestId("window-countertop-height-visualization").textContent).toContain("Finished top: 37.5″");
    expect(screen.getByTestId("window-countertop-height-visualization").textContent).toContain("Window sill is 4.5″ above");
    expect(screen.getByRole("option", { name: "One horizontal only" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Two horizontal only" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Window scene for this window"), { target: { value: "coastal" } });
    fireEvent.change(screen.getByLabelText("Window frame finish for this window"), { target: { value: "black" } });
    fireEvent.change(screen.getByLabelText("Window construction style for this window"), { target: { value: "double-hung" } });
    fireEvent.change(screen.getByLabelText("Window mullion grid for this window"), { target: { value: "2x2" } });
    fireEvent.change(screen.getByLabelText("Common window proportion"), { target: { value: "48x36" } });
    fireEvent.change(screen.getByLabelText("Common over-sink sill height"), { target: { value: "42" } });
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ windowSceneKind: "coastal" }),
      expect.objectContaining({ windowFrameStyle: "black" }),
      expect.objectContaining({ windowConstructionStyle: "double-hung" }),
      expect.objectContaining({ windowGridStyle: "2x2" }),
      expect.objectContaining({ width: 48, height: 36, offset: 24 }),
      expect.objectContaining({ sill: 42 }),
    ]));
  });

  it("moves the authoritative window by the selected eighth-inch distance", () => {
    const onChange = vi.fn();
    render(createElement(LanguageProvider, null, createElement(WindowAttributesDialog, {
      opening: { uid: "window-1", kind: "window", label: 'Window 36"', side: "top", offset: 54, width: 36, height: 36, sill: 42 },
      room: { width: 144, depth: 120, ceilingHeight: 96 },
      open: true,
      onOpenChange: () => undefined,
      onChange,
      onDelete: () => undefined,
    })));
    fireEvent.change(screen.getByLabelText("Window movement distance in inches"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByLabelText('Move window up 2½"'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uid: "window-1", sill: 44.5 }));
    onChange.mockClear();
    fireEvent.click(screen.getByLabelText("Move toward start of wall"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uid: "window-1", offset: 51.5 }));
  });

  it("commits a typed position from the start of a measured custom wall", () => {
    const onChange = vi.fn();
    render(createElement(LanguageProvider, null, createElement(WindowAttributesDialog, {
      opening: { uid: "window-custom-1", kind: "window", label: 'Window 36"', side: "wall-1" as any, offset: 18, width: 36, height: 36, sill: 42 },
      room: {
        width: 144,
        depth: 120,
        vertices: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 144, y: 0 }],
        customWalls: [{ id: "wall-1", startVertexId: "a", endVertexId: "b", label: "Wall 1", height: 96 }],
      },
      open: true,
      onOpenChange: () => undefined,
      onChange,
      onDelete: () => undefined,
    })));

    const position = screen.getByLabelText("Window distance from wall start / left in inches");
    fireEvent.change(position, { target: { value: "70.125" } });
    fireEvent.blur(position);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uid: "window-custom-1", side: "wall-1", offset: 70.125 }));
  });

  it("converts a typed wall-end/right measurement into the same authoritative start offset", () => {
    const onChange = vi.fn();
    render(createElement(LanguageProvider, null, createElement(WindowAttributesDialog, {
      opening: { uid: "window-end-1", kind: "window", label: 'Window 36"', side: "top", offset: 18, width: 36, height: 36, sill: 42 },
      room: { width: 144, depth: 120, ceilingHeight: 96 },
      open: true,
      onOpenChange: () => undefined,
      onChange,
      onDelete: () => undefined,
    })));

    fireEvent.change(screen.getByLabelText("Window position reference"), { target: { value: "end" } });
    const position = screen.getByLabelText("Window distance from wall end / right in inches");
    fireEvent.change(position, { target: { value: "20.125" } });
    fireEvent.blur(position);
    // 144-inch wall − 36-inch window = 108-inch usable run; 108 − 20.125 = 87.875.
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uid: "window-end-1", offset: 87.875 }));
  });

  it("warns immediately when a typed measurement cannot keep the full window on the wall", () => {
    const onChange = vi.fn();
    render(createElement(LanguageProvider, null, createElement(WindowAttributesDialog, {
      opening: { uid: "window-warning-1", kind: "window", label: 'Window 36"', side: "top", offset: 18, width: 36, height: 36, sill: 42 },
      room: { width: 144, depth: 120, ceilingHeight: 96 },
      open: true,
      onOpenChange: () => undefined,
      onChange,
      onDelete: () => undefined,
    })));

    const position = screen.getByLabelText("Window distance from wall start / left in inches");
    fireEvent.change(position, { target: { value: "120" } });
    expect(position.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByTestId("window-distance-warning").textContent).toContain("maximum 108");
    // Validation appears while typing; no location is committed until blur/Enter.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports the focused wall start or end reference for the floor-plan marker", () => {
    const onPositionReferenceFocusChange = vi.fn();
    render(createElement(LanguageProvider, null, createElement(WindowAttributesDialog, {
      opening: { uid: "window-reference-1", kind: "window", label: 'Window 36"', side: "top", offset: 18, width: 36, height: 36, sill: 42 },
      room: { width: 144, depth: 120, ceilingHeight: 96 },
      open: true,
      onOpenChange: () => undefined,
      onChange: () => undefined,
      onDelete: () => undefined,
      onPositionReferenceFocusChange,
    })));

    const position = screen.getByLabelText("Window distance from wall start / left in inches");
    fireEvent.focus(position);
    expect(onPositionReferenceFocusChange).toHaveBeenLastCalledWith({ openingUid: "window-reference-1", reference: "start" });
    fireEvent.change(screen.getByLabelText("Window position reference"), { target: { value: "end" } });
    expect(onPositionReferenceFocusChange).toHaveBeenLastCalledWith({ openingUid: "window-reference-1", reference: "end" });
    fireEvent.blur(screen.getByLabelText("Window distance from wall end / right in inches"));
    expect(onPositionReferenceFocusChange).toHaveBeenLastCalledWith(null);
  });
});
