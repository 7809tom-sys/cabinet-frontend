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

function Harness({ stored = null, aiAvailable = false, sherwinHex = null, hexSwatch = null, onOpenAiMaker, aiImageUrl, onState, hexSeed }: {
  stored?: DoorColorSourceSelection | null;
  aiAvailable?: boolean;
  sherwinHex?: string | null;
  hexSwatch?: string | null;
  onOpenAiMaker?: () => void;
  aiImageUrl?: string | null;
  onState?: (state: DoorColorSourceDraft) => void;
  hexSeed?: string | null;
}) {
  const [draft, dispatch] = useReducer(doorColorSourceReducer, stored, initialDoorColorSourceDraft);
  onState?.(draft);
  return (
    <DoorColorSourceSelector
      draft={draft}
      dispatch={dispatch}
      aiAvailable={aiAvailable}
      supplierPhotoUrl="/uploads/door.jpg"
      aiImageUrl={aiImageUrl !== undefined ? aiImageUrl : aiAvailable ? "/uploads/ai.png" : null}
      sherwinHex={sherwinHex}
      hexSwatch={hexSwatch}
      sherwinPicker={<div data-testid="existing-sw-wheels">wheels</div>}
      hexPicker={<input data-testid="hex-in" onChange={(e) => dispatch({ type: "pendingHex", hex: e.target.value })} />}
      onOpenAiMaker={onOpenAiMaker}
      hexSeed={hexSeed}
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

  it("keeps the hex box and paint fields on screen, and opens only the selected tile's extra editor", () => {
    render(<Harness />);
    expect(screen.getByTestId("hex-in")).toBeTruthy();
    expect(screen.getByTestId("paint-brand-select")).toBeTruthy();
    expect(screen.queryByTestId("existing-sw-wheels")).toBeNull();
    fireEvent.click(screen.getByTestId("door-color-source-hex"));
    expect(screen.getByTestId("hex-in")).toBeTruthy();
    expect(screen.queryByTestId("existing-sw-wheels")).toBeNull();
    fireEvent.click(screen.getByTestId("door-color-source-sherwin-williams"));
    expect(screen.getByTestId("existing-sw-wheels")).toBeTruthy();
    expect(screen.getByTestId("hex-in")).toBeTruthy();
    expect(screen.getByTestId("paint-brand-select")).toBeTruthy();
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
    // The tile itself says the pick is waiting for Confirm.
    expect(screen.getByTestId("door-color-source-hex-pending").textContent).toMatch(/Confirm/i);
    fireEvent.click(confirm);
    expect(state!.stored).toMatchObject({ source: "hex", hex: "#336699", confirmed: true });
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Hex · #336699/);
  });

  it("Sherwin-Williams shows the existing wheels; its Confirm is disabled until a color is applied", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("door-color-source-sherwin-williams"));
    expect(screen.getByTestId("existing-sw-wheels")).toBeTruthy();
    expect((screen.getByTestId("door-color-source-sherwin-williams-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("door-color-source-hex-confirm")).toBeTruthy();
    expect(screen.getByTestId("paint-brand-select")).toBeTruthy();
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

  it("paints the AI tile for a saved picture even when no accepted render exists", () => {
    render(<Harness aiAvailable={false} aiImageUrl="/uploads/gemini.png" />);
    const img = screen.getByTestId("door-color-source-approved-photo") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/uploads/gemini.png");
    expect(screen.queryByTestId("door-color-source-approved-ai-image-empty")).toBeNull();
  });

  it("keeps the AI tile empty when there is no picture at all", () => {
    render(<Harness aiAvailable={false} aiImageUrl={null} />);
    expect(screen.getByTestId("door-color-source-approved-ai-image-empty")).toBeTruthy();
  });

  it("says a saved but unaccepted AI picture is not used yet, and does not claim it is", () => {
    render(<Harness aiAvailable={false} aiImageUrl="/uploads/gemini.png" stored={{ source: "approved-ai-image", chosenAt: "2026-11-12T18:45:00.000Z" }} />);
    // With no accepted render the choice cannot stay on the AI tile (mutually exclusive rule), so choose it.
    fireEvent.click(screen.getByTestId("door-color-source-approved-ai-image"));
    expect(screen.queryByTestId("door-color-source-ai-present")).toBeNull();
    expect(screen.getByTestId("door-color-source-ai-saved").textContent).toMatch(/not an accepted render yet/);
  });

  it("paint brand fields and the hex box show for every starting source", () => {
    const sources: Array<DoorColorSourceSelection | null> = [
      null,
      { source: "original-image", chosenAt: "2026-11-22T18:00:00.000Z" },
      { source: "approved-ai-image", chosenAt: "2026-11-22T18:00:00.000Z" },
      {
        source: "sherwin-williams",
        confirmed: true,
        chosenAt: "2026-11-22T18:00:00.000Z",
        color: { finish: "paint", code: "SW7008", label: "Alabaster", hex: "#edeae0", woodSpecies: null, grainDirection: "none", profileImageUrl: null },
      },
      { source: "hex", confirmed: true, chosenAt: "2026-11-22T18:00:00.000Z", hex: "#224466" },
    ];
    for (const stored of sources) {
      cleanup();
      render(<Harness stored={stored} />);
      expect(tiles()).toHaveLength(4);
      expect(screen.getByTestId("paint-brand-select")).toBeTruthy();
      expect(screen.getByTestId("paint-brand-code")).toBeTruthy();
      expect(screen.getByTestId("paint-brand-name")).toBeTruthy();
      expect(screen.getByTestId("paint-brand-hex")).toBeTruthy();
      expect(screen.getByTestId("door-color-source-paint-brand-confirm")).toBeTruthy();
      expect(screen.getByTestId("hex-in")).toBeTruthy();
      expect(screen.getByTestId("door-color-source-hex-confirm")).toBeTruthy();
      expect((screen.getByTestId("paint-brand-code") as HTMLInputElement).maxLength).toBe(32);
      expect((screen.getByTestId("paint-brand-name") as HTMLInputElement).maxLength).toBe(64);
    }
  });

  it("prefills an old Sherwin-Williams row as brand Sherwin-Williams", () => {
    render(<Harness stored={{
      source: "sherwin-williams",
      confirmed: true,
      chosenAt: "2026-11-22T18:00:00.000Z",
      color: { finish: "paint", code: "SW7008", label: "Alabaster", hex: "#EDEAE0", woodSpecies: null, grainDirection: "none", profileImageUrl: null },
    }} />);
    expect(screen.getByTestId("door-color-source-sherwin-williams").getAttribute("aria-checked")).toBe("true");
    expect((screen.getByTestId("paint-brand-select") as HTMLSelectElement).value).toBe("Sherwin-Williams");
    expect((screen.getByTestId("paint-brand-code") as HTMLInputElement).value).toBe("SW7008");
    expect((screen.getByTestId("paint-brand-name") as HTMLInputElement).value).toBe("Alabaster");
    expect((screen.getByTestId("paint-brand-hex") as HTMLInputElement).value).toBe("#edeae0");
  });

  it("paint brand is not a fifth tile and lists exactly the six brands", () => {
    render(<Harness />);
    expect(tiles()).toHaveLength(4);
    expect(screen.getByTestId("door-color-source-original-image").getAttribute("aria-checked")).toBe("true");
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual([
      "Choose a brand",
      "Sherwin-Williams",
      "Behr",
      "Benjamin Moore",
      "Valspar",
      "PPG",
      "Clark + Kensington",
    ]);
    const confirm = screen.getByTestId("door-color-source-paint-brand-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("paint-brand-select"), { target: { value: "Clark + Kensington" } });
    fireEvent.change(screen.getByTestId("paint-brand-code"), { target: { value: "CK 001" } });
    fireEvent.change(screen.getByTestId("paint-brand-name"), { target: { value: "Swiss Coffee" } });
    fireEvent.change(screen.getByTestId("paint-brand-hex"), { target: { value: "#e8e4d8" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(screen.getByTestId("door-color-source-effective").textContent).toMatch(/Paint brand · Clark \+ Kensington CK 001 Swiss Coffee · #e8e4d8/);
  });

  it("reloads a saved paint brand into the brand, code, name and hex fields", () => {
    render(<Harness stored={{
      source: "paint-brand",
      confirmed: true,
      chosenAt: "2026-11-22T18:00:00.000Z",
      kind: "paint-brand",
      brand: "Behr",
      code: "MQ3-07",
      name: "Ultra Pure White",
      hex: "#f4f1ea",
    }} />);
    expect((screen.getByTestId("paint-brand-select") as HTMLSelectElement).value).toBe("Behr");
    expect((screen.getByTestId("paint-brand-code") as HTMLInputElement).value).toBe("MQ3-07");
    expect((screen.getByTestId("paint-brand-name") as HTMLInputElement).value).toBe("Ultra Pure White");
    expect((screen.getByTestId("paint-brand-hex") as HTMLInputElement).value).toBe("#f4f1ea");
    expect(screen.getByTestId("door-color-source-sherwin-williams").getAttribute("aria-checked")).toBe("false");
  });

  it("still says the render is used when it is accepted", () => {
    render(<Harness aiAvailable aiImageUrl="/uploads/ai.png" />);
    fireEvent.click(screen.getByTestId("door-color-source-approved-ai-image"));
    expect(screen.getByTestId("door-color-source-ai-present")).toBeTruthy();
    expect(screen.queryByTestId("door-color-source-ai-saved")).toBeNull();
  });
});
