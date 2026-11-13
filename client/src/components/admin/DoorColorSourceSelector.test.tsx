// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DoorColorSourceSelector } from "./DoorColorSourceSelector";
import {
  doorColorSourceReducer,
  initialDoorColorSourceDraft,
  type DoorColorSourceDraft,
  type DoorColorSourceSelection,
} from "@shared/doorColorSourceSelection";

afterEach(cleanup);

function Harness({ stored = null, aiAvailable = false, sherwinHex = null, hexSwatch = null, onOpenAiMaker, onState }: {
  stored?: DoorColorSourceSelection | null;
  aiAvailable?: boolean;
  sherwinHex?: string | null;
  hexSwatch?: string | null;
  onOpenAiMaker?: () => void;
  onState?: (state: DoorColorSourceDraft) => void;
}) {
  const [draft, dispatch] = useReducer(doorColorSourceReducer, stored, initialDoorColorSourceDraft);
  onState?.(draft);
  return (
    <DoorColorSourceSelector
      draft={draft}
      dispatch={dispatch}
      aiAvailable={aiAvailable}
      supplierPhotoUrl="/uploads/door.jpg"
      aiImageUrl={aiAvailable ? "/uploads/ai.png" : null}
      sherwinHex={sherwinHex}
      hexSwatch={hexSwatch}
      sherwinPicker={<div data-testid="existing-sw-wheels">wheels</div>}
      hexPicker={<input data-testid="hex-in" onChange={(e) => dispatch({ type: "pendingHex", hex: e.target.value })} />}
      onOpenAiMaker={onOpenAiMaker}
      now={() => "2026-11-12T18:45:00.000Z"}
    />
  );
}

const tiles = () => screen.getAllByRole("radio");
const checked = () => tiles().filter((el) => el.getAttribute("aria-checked") === "true").map((el) => el.dataset.testid);

describe("DoorColorSourceSelector", () => {
  it("shows four same-size square tiles in one row, Original image selected by default", () => {
    render(<Harness />);
    expect(tiles()).toHaveLength(4);
    expect(checked()).toEqual(["door-color-source-original-image"]);
    // One cluster: a single four-column radiogroup holds every tile.
    const group = screen.getByRole("radiogroup", { name: "Door color source" });
    expect(group.className).toMatch(/grid-cols-4/);
    for (const option of ["original-image", "approved-ai-image", "sherwin-williams", "hex"]) {
      expect(group.querySelector(`[data-testid="door-color-source-${option}"]`)).toBeTruthy();
    }
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Original image/);
  });

  it("marks the selected tile with a blue border and a check, and leaves the others shaded", () => {
    render(<Harness />);
    const original = screen.getByTestId("door-color-source-original-image");
    expect(original.className).toMatch(/border-\[#2563eb\]/);
    expect(screen.getByTestId("door-color-source-original-image-check")).toBeTruthy();
    const hex = screen.getByTestId("door-color-source-hex");
    expect(hex.dataset.state).toBe("off");
    expect(hex.className).toMatch(/opacity-60/);
    expect(screen.queryByTestId("door-color-source-hex-check")).toBeNull();
  });

  it("shows the supplier photo in the Original tile and the approved render in the Approved tile", () => {
    render(<Harness aiAvailable />);
    expect(screen.getByTestId("door-color-source-supplier-photo").getAttribute("src")).toBe("/uploads/door.jpg");
    expect(screen.getByTestId("door-color-source-approved-photo").getAttribute("src")).toBe("/uploads/ai.png");
  });

  it("shows a striped placeholder with a warning dot for a tile with no picture", () => {
    render(<Harness />);
    expect(screen.getByTestId("door-color-source-approved-ai-image-empty")).toBeTruthy();
    expect(screen.getByTestId("door-color-source-hex-empty")).toBeTruthy();
    expect(screen.getByTestId("door-color-source-sherwin-williams-empty")).toBeTruthy();
    expect(screen.queryByTestId("door-color-source-original-image-empty")).toBeNull();
  });

  it("paints the Sherwin-Williams and Hex tiles with their swatch colors", () => {
    render(<Harness sherwinHex="#c8b08a" hexSwatch="#336699" />);
    expect(screen.getByTestId("door-color-source-sherwin-williams-swatch").getAttribute("style")).toContain("rgb(200, 176, 138)");
    expect(screen.getByTestId("door-color-source-hex-swatch").getAttribute("style")).toContain("rgb(51, 102, 153)");
  });

  it("opens only the selected tile's editor", () => {
    render(<Harness />);
    // Original selected: no hex input, no wheels.
    expect(screen.queryByTestId("hex-in")).toBeNull();
    expect(screen.queryByTestId("existing-sw-wheels")).toBeNull();
    fireEvent.click(screen.getByTestId("door-color-source-hex"));
    expect(screen.getByTestId("hex-in")).toBeTruthy();
    expect(screen.queryByTestId("existing-sw-wheels")).toBeNull();
    fireEvent.click(screen.getByTestId("door-color-source-sherwin-williams"));
    expect(screen.getByTestId("existing-sw-wheels")).toBeTruthy();
    expect(screen.queryByTestId("hex-in")).toBeNull();
  });

  it("Hex shows the existing hex picker and needs Confirm", () => {
    let state: DoorColorSourceDraft | null = null;
    render(<Harness onState={(s) => { state = s; }} />);
    fireEvent.click(screen.getByTestId("door-color-source-hex"));
    expect(checked()).toEqual(["door-color-source-hex"]);
    const confirm = screen.getByTestId("door-color-source-hex-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Original image.*waiting for Confirm/);
    fireEvent.change(screen.getByTestId("hex-in"), { target: { value: "#336699" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(state!.stored).toMatchObject({ source: "hex", hex: "#336699", confirmed: true });
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Hex · #336699/);
  });

  it("Sherwin-Williams shows the existing wheels; its Confirm is disabled until a color is applied", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("door-color-source-sherwin-williams"));
    expect(screen.getByTestId("existing-sw-wheels")).toBeTruthy();
    expect((screen.getByTestId("door-color-source-sherwin-williams-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("door-color-source-hex-confirm")).toBeNull();
  });

  it("Approved AI image with none accepted says so and offers the existing AI tool without starting it", () => {
    const open = vi.fn();
    render(<Harness onOpenAiMaker={open} />);
    fireEvent.click(screen.getByTestId("door-color-source-approved-ai-image"));
    expect(screen.getByTestId("door-color-source-ai-missing")).toBeTruthy();
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Original image/);
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("door-color-source-open-ai-maker"));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("Approved AI image with an accepted render is used", () => {
    render(<Harness aiAvailable />);
    fireEvent.click(screen.getByTestId("door-color-source-approved-ai-image"));
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Approved AI image/);
  });
});
