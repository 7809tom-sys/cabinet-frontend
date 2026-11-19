// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DoorAuditDoorProfile } from "@/lib/doorRenderingAudit";
import { buildFourSlots } from "@/lib/doorColorSourceSlots";

const capture = vi.hoisted(() => ({
  inputs: [] as unknown[],
  fail: null as Error | null,
  dispose: vi.fn(),
}));
vi.mock("@/lib/doorAuditDoorRender", () => ({
  createDoorAuditCapture: () => ({
    capture: async (input: unknown) => {
      capture.inputs.push(input);
      if (capture.fail) throw capture.fail;
      return { base64: "QUJD", width: 10, height: 10 };
    },
    dispose: capture.dispose,
  }),
}));

import { DoorColorSourceFourPreview, FOUR_SOURCE_RENDER_DEBOUNCE_MS, fourSourceRenderInput } from "./DoorColorSourceFourPreview";

const NOW = "2026-11-18T20:00:00.000Z";
const PROFILE: DoorAuditDoorProfile = {
  doorStyle: "Shaker", doorPanelType: null, railWidth: 2.25, stileWidth: 2.25, panelConstruction: "flat",
  bevelWidth: null, bevelDepth: null, insideEdgeProfile: null, drawerFrontType: "slab", grainDirection: "none", finishSheen: "satin",
};
const STYLE = { styleId: 7, name: "Classic Cream", code: "CC", distributorName: "Ashford", identity: { ourName: "Classic Cream", renderHex: "#ded5c1" } };
const SW = { finish: "paint" as const, code: "SW 7036", label: "Accessible Beige", hex: "#d1c7b7", woodSpecies: null, grainDirection: "none" as const, profileImageUrl: null };

const slotsFor = (stored: Parameters<typeof buildFourSlots>[0]["stored"], extra: Partial<Parameters<typeof buildFourSlots>[0]> = {}) =>
  buildFourSlots({ supplierPhotoUrl: "https://cdn/door.jpg", aiImageUrl: "https://cdn/ai.png", aiAvailable: true, stored, now: NOW, ...extra });

const ALL_FILLED = {
  listing: { available: true, sources: [{ source: "sherwin-williams", value: SW }, { source: "hex", value: { hex: "#224466" } }] },
};

beforeEach(() => {
  vi.useFakeTimers();
  capture.inputs = [];
  capture.fail = null;
  capture.dispose.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(FOUR_SOURCE_RENDER_DEBOUNCE_MS + 50);
  });
}

describe("DoorColorSourceFourPreview", () => {
  it("shows four slots side by side with exactly one check mark on", async () => {
    render(<DoorColorSourceFourPreview slots={slotsFor(null, ALL_FILLED)} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    for (const source of ["original-image", "approved-ai-image", "sherwin-williams", "hex"]) {
      expect(screen.getByTestId(`four-source-slot-${source}`)).toBeTruthy();
    }
    const checks = screen.getAllByRole("checkbox");
    expect(checks).toHaveLength(4);
    expect(checks.filter((box) => box.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.getByTestId("four-source-check-original-image").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("four-source-image-original-image").getAttribute("src")).toBe("https://cdn/door.jpg");
    expect(screen.getByTestId("four-source-image-approved-ai-image").getAttribute("src")).toBe("https://cdn/ai.png");
    expect(screen.getByTestId("four-source-swatch-sherwin-williams").getAttribute("style")).toContain("rgb(209, 199, 183)");
    expect(screen.getByTestId("four-source-swatch-hex").getAttribute("style")).toContain("rgb(34, 68, 102)");
    expect(screen.queryByTestId("door-four-source-legacy-note")).toBeNull();
  });

  it("pressing a check mark hands that slot's selection to the caller (the editor's existing save)", async () => {
    const onChoose = vi.fn();
    render(<DoorColorSourceFourPreview slots={slotsFor(null, ALL_FILLED)} onChoose={onChoose} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    fireEvent.click(screen.getByTestId("four-source-check-hex"));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose.mock.calls[0][0].selection).toMatchObject({ source: "hex", confirmed: true, hex: "#224466" });
    await settle();
  });

  it("the checked slot cannot be un-checked, and an empty slot cannot be checked", async () => {
    const onChoose = vi.fn();
    render(<DoorColorSourceFourPreview slots={slotsFor(null)} onChoose={onChoose} style={STYLE} doorProfile={PROFILE} allSlotsSaved={false} />);
    fireEvent.click(screen.getByTestId("four-source-check-original-image"));
    expect(onChoose).not.toHaveBeenCalled();
    const hex = screen.getByTestId("four-source-check-hex") as HTMLButtonElement;
    expect(hex.disabled).toBe(true);
    expect(screen.getByTestId("four-source-empty-hex")).toBeTruthy();
    expect(screen.getByTestId("four-source-caption-hex").textContent).toMatch(/no hex/i);
    // Before the sources table exists the page says why only one color slot shows.
    expect(screen.getByTestId("door-four-source-legacy-note").textContent).toMatch(/one choice per door/i);
    await settle();
  });

  it("an AI picture that is not an accepted render shows but cannot be checked", async () => {
    render(<DoorColorSourceFourPreview slots={slotsFor(null, { aiAvailable: false })} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved={false} />);
    expect(screen.getByTestId("four-source-image-approved-ai-image")).toBeTruthy();
    expect((screen.getByTestId("four-source-check-approved-ai-image") as HTMLButtonElement).disabled).toBe(true);
    await settle();
  });

  it("draws the door for the checked slot and redraws when the check mark moves", async () => {
    const { rerender } = render(<DoorColorSourceFourPreview slots={slotsFor(null, ALL_FILLED)} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    expect(screen.getByTestId("door-four-source-render-image").getAttribute("src")).toBe("data:image/png;base64,QUJD");
    expect(capture.inputs).toHaveLength(1);
    expect(capture.inputs[0]).toMatchObject({ samplePhotoUrl: "https://cdn/door.jpg", renderHex: null });

    const hexChosen = slotsFor({ source: "hex", confirmed: true, chosenAt: NOW, hex: "#224466" }, ALL_FILLED);
    rerender(<DoorColorSourceFourPreview slots={hexChosen} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    expect(capture.inputs).toHaveLength(2);
    expect(capture.inputs[1]).toMatchObject({ samplePhotoUrl: null, renderHex: "#224466", color: "#224466" });
    expect(screen.getByTestId("door-four-source-render").textContent).toMatch(/Hex/);
    expect(capture.dispose).toHaveBeenCalledTimes(2);
  });

  it("does not redraw when only an unrelated parent render happens", async () => {
    const slots = slotsFor(null, ALL_FILLED);
    const { rerender } = render(<DoorColorSourceFourPreview slots={slots} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    rerender(<DoorColorSourceFourPreview slots={[...slots]} onChoose={() => {}} style={{ ...STYLE }} doorProfile={{ ...PROFILE }} allSlotsSaved />);
    await settle();
    expect(capture.inputs).toHaveLength(1);
  });

  it("says why when the render fails instead of leaving a blank pane", async () => {
    capture.fail = new Error("Could not load the sample photo for this door.");
    render(<DoorColorSourceFourPreview slots={slotsFor(null)} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved={false} />);
    await settle();
    expect(screen.getByTestId("door-four-source-render-error").textContent).toMatch(/Could not load the sample photo/);
  });

  it("a door with no profile says there is nothing to render", async () => {
    render(<DoorColorSourceFourPreview slots={slotsFor(null)} onChoose={() => {}} style={STYLE} doorProfile={null} allSlotsSaved={false} />);
    await settle();
    expect(screen.getByTestId("door-four-source-render-error").textContent).toMatch(/no profile yet/i);
    expect(capture.inputs).toHaveLength(0);
  });
});

describe("fourSourceRenderInput", () => {
  it("a color slot paints the exact hex with no photo and a gate that cannot refuse it", () => {
    const slots = slotsFor({ source: "sherwin-williams", confirmed: true, chosenAt: NOW, color: SW });
    const input = fourSourceRenderInput({ style: STYLE, doorProfile: PROFILE, slot: slots.find((slot) => slot.checked) });
    expect(input).toMatchObject({ samplePhotoUrl: null, renderHex: "#d1c7b7", color: "#d1c7b7", colorDeltaEMax: 1000 });
  });

  it("a photo slot drops the style's stored render hex so the picture is what shows", () => {
    const slots = slotsFor(null);
    const input = fourSourceRenderInput({ style: STYLE, doorProfile: PROFILE, slot: slots[0] });
    expect(input).toMatchObject({ samplePhotoUrl: "https://cdn/door.jpg", renderHex: null, colorDeltaEMax: null });
  });

  it("null without a door profile", () => {
    expect(fourSourceRenderInput({ style: STYLE, doorProfile: null, slot: undefined })).toBeNull();
  });
});
