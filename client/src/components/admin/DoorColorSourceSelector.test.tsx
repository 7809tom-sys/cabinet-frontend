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

function Harness({ stored = null, aiAvailable = false, onOpenAiMaker, onState }: {
  stored?: DoorColorSourceSelection | null;
  aiAvailable?: boolean;
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
      sherwinPicker={<div data-testid="existing-sw-wheels">wheels</div>}
      hexPicker={<input data-testid="hex-in" onChange={(e) => dispatch({ type: "pendingHex", hex: e.target.value })} />}
      onOpenAiMaker={onOpenAiMaker}
      now={() => "2026-11-12T18:45:00.000Z"}
    />
  );
}

const checked = () => screen.getAllByRole("radio").filter((el) => el.getAttribute("aria-checked") === "true").map((el) => el.dataset.testid);

describe("DoorColorSourceSelector", () => {
  it("shows four options, Original image selected by default, others shaded", () => {
    render(<Harness />);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(checked()).toEqual(["door-color-source-original-image"]);
    expect(screen.getByTestId("door-color-source-hex").dataset.state).toBe("off");
    expect(screen.getByTestId("door-color-source-hex").className).toMatch(/opacity-60/);
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Original image/);
    expect(screen.getByTestId("door-color-source-supplier-photo")).toBeTruthy();
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
    expect((screen.getByTestId("door-color-source-hex-confirm") as HTMLButtonElement).disabled).toBe(true);
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
