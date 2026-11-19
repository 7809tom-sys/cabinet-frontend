// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DoorAuditDoorProfile } from "@/lib/doorRenderingAudit";
import { buildFourSlots } from "@/lib/doorColorSourceSlots";

type Job = { key: string; input: Record<string, unknown> };
const snap = vi.hoisted(() => ({
  batches: [] as Array<{ kind: string; jobs: Job[] }>,
  failWhen: null as null | ((input: Record<string, unknown>) => string | null),
}));
// One call to snapshotCabinets is one shared renderer drawing every tile in turn.
vi.mock("@/lib/doorColorSourceCabinetSnapshots", () => ({
  snapshotCabinets: async (
    jobs: Job[],
    kind: string,
    onResult: (key: string, result: { url: string } | { error: string }) => void,
    isCancelled: () => boolean,
  ) => {
    snap.batches.push({ kind, jobs });
    for (const job of jobs) {
      if (isCancelled()) break;
      const reason = snap.failWhen?.(job.input) ?? null;
      onResult(job.key, reason ? { error: reason } : { url: `data:image/png;base64,${String(job.input.renderHex ?? job.input.samplePhotoUrl).length}` });
    }
  },
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
  snap.batches = [];
  snap.failWhen = null;
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

const SOURCES = ["original-image", "approved-ai-image", "sherwin-williams", "hex"];

describe("DoorColorSourceFourPreview", () => {
  it("shows four slots side by side with exactly one check mark on", async () => {
    render(<DoorColorSourceFourPreview slots={slotsFor(null, ALL_FILLED)} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    for (const source of SOURCES) expect(screen.getByTestId(`four-source-slot-${source}`)).toBeTruthy();
    const checks = screen.getAllByRole("checkbox");
    expect(checks).toHaveLength(4);
    expect(checks.filter((box) => box.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.getByTestId("four-source-image-original-image").getAttribute("src")).toBe("https://cdn/door.jpg");
    expect(screen.getByTestId("four-source-swatch-sherwin-williams").getAttribute("style")).toContain("rgb(209, 199, 183)");
    expect(screen.getByTestId("four-source-swatch-hex").getAttribute("style")).toContain("rgb(34, 68, 102)");
    expect(screen.queryByTestId("door-four-source-legacy-note")).toBeNull();
  });

  it("a stained style reads Stain on the checked tile and a Sherwin-Williams stain chip reads Stain too", async () => {
    render(<DoorColorSourceFourPreview slots={slotsFor(null, { ...ALL_FILLED, styleFinish: "stain" })} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    expect(screen.getByTestId("four-source-finish-original-image").textContent).toBe("Stain");
    expect(screen.getByTestId("four-source-slot-original-image").getAttribute("data-state")).toBe("on");
    expect(screen.getByTestId("four-source-check-original-image").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("four-source-finish-sherwin-williams").textContent).toBe("Paint");
    expect(screen.queryByTestId("four-source-finish-hex")).toBeNull();
  });

  it("an unconfirmed Sherwin-Williams stain chip shows Stain on its empty tile", async () => {
    const pending = { label: "MW230 Early American", hex: "#9a6e51", finish: "stain" as const };
    render(<DoorColorSourceFourPreview slots={slotsFor(null)} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved={false} pendingSherwin={pending} onConfirmSherwin={() => {}} />);
    await settle();
    expect(screen.getByTestId("four-source-finish-sherwin-williams").textContent).toBe("Stain");
  });

  it("draws a cabinet under EVERY filled tile, all from one shared renderer run", async () => {
    render(<DoorColorSourceFourPreview slots={slotsFor(null, ALL_FILLED)} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    for (const source of SOURCES) expect(screen.getByTestId(`four-source-cabinet-${source}`).getAttribute("src")).toMatch(/^data:image\/png/);
    // One batch holds all four tiles: they are drawn one after another, never four renderers at once.
    expect(snap.batches).toHaveLength(1);
    expect(snap.batches[0].kind).toBe("base");
    expect(snap.batches[0].jobs).toHaveLength(4);
    const inputs = snap.batches[0].jobs.map((job) => job.input);
    expect(inputs[0]).toMatchObject({ samplePhotoUrl: "https://cdn/door.jpg", renderHex: null });
    expect(inputs[1]).toMatchObject({ samplePhotoUrl: "https://cdn/ai.png", renderHex: null });
    expect(inputs[2]).toMatchObject({ samplePhotoUrl: null, renderHex: "#d1c7b7", color: "#d1c7b7" });
    expect(inputs[3]).toMatchObject({ samplePhotoUrl: null, renderHex: "#224466", color: "#224466" });
  });

  it("the base / wall toggle redraws every tile as the other cabinet", async () => {
    render(<DoorColorSourceFourPreview slots={slotsFor(null, ALL_FILLED)} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    expect(screen.getByTestId("four-source-kind-base").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByTestId("four-source-kind-wall"));
    await settle();
    expect(screen.getByTestId("four-source-kind-wall").getAttribute("aria-checked")).toBe("true");
    expect(snap.batches).toHaveLength(2);
    expect(snap.batches[1].kind).toBe("wall");
    expect(snap.batches[1].jobs).toHaveLength(4);
    expect(screen.getByTestId("four-source-cabinet-hex").getAttribute("alt")).toMatch(/Wall cabinet/);
  });

  it("one tile failing says why on that tile and the others still show", async () => {
    snap.failWhen = (input) => (input.samplePhotoUrl === "https://cdn/ai.png" ? "Could not load the sample photo for this door." : null);
    render(<DoorColorSourceFourPreview slots={slotsFor(null, ALL_FILLED)} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    expect(screen.getByTestId("four-source-cabinet-error-approved-ai-image").textContent).toMatch(/Could not load the sample photo/);
    for (const source of ["original-image", "sherwin-williams", "hex"]) {
      expect(screen.getByTestId(`four-source-cabinet-${source}`)).toBeTruthy();
    }
  });

  it("an empty tile draws nothing and gives a plain reason; it cannot be checked", async () => {
    const onChoose = vi.fn();
    render(<DoorColorSourceFourPreview slots={slotsFor(null, { aiImageUrl: null, aiAvailable: false })} onChoose={onChoose} style={STYLE} doorProfile={PROFILE} allSlotsSaved={false} />);
    await settle();
    expect(snap.batches[0].jobs).toHaveLength(1);
    for (const source of ["approved-ai-image", "sherwin-williams", "hex"]) {
      expect(screen.getByTestId(`four-source-cabinet-empty-${source}`)).toBeTruthy();
      expect(screen.getByTestId(`four-source-reason-${source}`).textContent?.length).toBeGreaterThan(10);
      expect((screen.getByTestId(`four-source-check-${source}`) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByTestId(`four-source-check-${source}`));
    }
    expect(screen.getByTestId("four-source-reason-approved-ai-image").textContent).toMatch(/Gemini/i);
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.getByTestId("door-four-source-legacy-note").textContent).toMatch(/one choice per door/i);
  });

  it("pressing a check mark hands that slot's selection to the caller (the editor's existing save)", async () => {
    const onChoose = vi.fn();
    render(<DoorColorSourceFourPreview slots={slotsFor(null, ALL_FILLED)} onChoose={onChoose} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    fireEvent.click(screen.getByTestId("four-source-check-hex"));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose.mock.calls[0][0].selection).toMatchObject({ source: "hex", confirmed: true, hex: "#224466" });
    fireEvent.click(screen.getByTestId("four-source-check-original-image"));
    expect(onChoose).toHaveBeenCalledTimes(1);
    await settle();
  });

  it("a saved Gemini picture that 3D can use is checkable", async () => {
    const onChoose = vi.fn();
    render(<DoorColorSourceFourPreview slots={slotsFor(null, { aiAvailable: true, aiAccepted: false })} onChoose={onChoose} style={STYLE} doorProfile={PROFILE} allSlotsSaved={false} />);
    expect(screen.getByTestId("four-source-caption-approved-ai-image").textContent).toMatch(/Saved Gemini picture/);
    expect(screen.queryByTestId("four-source-reason-approved-ai-image")).toBeNull();
    fireEvent.click(screen.getByTestId("four-source-check-approved-ai-image"));
    expect(onChoose.mock.calls[0][0].selection).toMatchObject({ source: "approved-ai-image" });
    await settle();
  });

  it("an empty Hex tile takes a hex right there: it previews while typing and confirms through onPickHex", async () => {
    const onPickHex = vi.fn();
    render(<DoorColorSourceFourPreview slots={slotsFor(null)} onChoose={() => {}} onPickHex={onPickHex} style={STYLE} doorProfile={PROFILE} allSlotsSaved={false} />);
    await settle();
    expect((screen.getByTestId("four-source-hex-use") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId("four-source-hex-input"), { target: { value: "#3A6EA5" } });
    await settle();
    // The typed hex previews on its own tile, but it is not saved.
    expect(screen.getByTestId("four-source-cabinet-hex")).toBeTruthy();
    expect(snap.batches.at(-1)?.jobs).toHaveLength(1);
    expect(snap.batches.at(-1)?.jobs[0].input).toMatchObject({ renderHex: "#3a6ea5", samplePhotoUrl: null });
    expect(onPickHex).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("four-source-hex-use"));
    expect(onPickHex).toHaveBeenCalledWith("#3a6ea5");
  });

  it("prefills the hex box from hexSeed while untouched, follows a new seed, and never saves it", async () => {
    const onPickHex = vi.fn();
    const props = { slots: slotsFor(null), onChoose: () => {}, onPickHex, style: STYLE, doorProfile: PROFILE, allSlotsSaved: false };
    const { rerender } = render(<DoorColorSourceFourPreview {...props} hexSeed="#B9B2A9" />);
    await settle();
    const input = () => screen.getByTestId("four-source-hex-input") as HTMLInputElement;
    expect(input().value).toBe("#b9b2a9");
    // Only a draft: it previews as not confirmed and nothing was picked.
    expect(screen.getByTestId("four-source-caption-hex").textContent).toMatch(/#b9b2a9.*not confirmed yet/);
    expect(onPickHex).not.toHaveBeenCalled();
    rerender(<DoorColorSourceFourPreview {...props} hexSeed="#d1c7b7" />);
    expect(input().value).toBe("#d1c7b7");
    fireEvent.click(screen.getByTestId("four-source-hex-use"));
    expect(onPickHex).toHaveBeenCalledWith("#d1c7b7");
  });

  it("does not overwrite what the admin typed when the seed changes", async () => {
    const props = { slots: slotsFor(null), onChoose: () => {}, onPickHex: () => {}, style: STYLE, doorProfile: PROFILE, allSlotsSaved: false };
    const { rerender } = render(<DoorColorSourceFourPreview {...props} hexSeed="#b9b2a9" />);
    const input = () => screen.getByTestId("four-source-hex-input") as HTMLInputElement;
    fireEvent.change(input(), { target: { value: "#3A6EA5" } });
    rerender(<DoorColorSourceFourPreview {...props} hexSeed="#d1c7b7" />);
    expect(input().value).toBe("#3A6EA5");
    fireEvent.change(input(), { target: { value: "" } });
    rerender(<DoorColorSourceFourPreview {...props} hexSeed="#aaaaaa" />);
    expect(input().value).toBe("");
  });

  it("leaves the hex box empty with no seed or an invalid seed", () => {
    const props = { slots: slotsFor(null), onChoose: () => {}, onPickHex: () => {}, style: STYLE, doorProfile: PROFILE, allSlotsSaved: false };
    const { rerender } = render(<DoorColorSourceFourPreview {...props} />);
    expect((screen.getByTestId("four-source-hex-input") as HTMLInputElement).value).toBe("");
    rerender(<DoorColorSourceFourPreview {...props} hexSeed="BSB2A9" />);
    expect((screen.getByTestId("four-source-hex-input") as HTMLInputElement).value).toBe("");
  });

  it("an empty Sherwin-Williams tile opens the picker, previews the chip, and confirms it", async () => {
    const onRequestSherwin = vi.fn();
    const onConfirmSherwin = vi.fn();
    const props = { slots: slotsFor(null), onChoose: () => {}, onRequestSherwin, onConfirmSherwin, style: STYLE, doorProfile: PROFILE, allSlotsSaved: false };
    const { rerender } = render(<DoorColorSourceFourPreview {...props} />);
    fireEvent.click(screen.getByTestId("four-source-sherwin-pick"));
    expect(onRequestSherwin).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("four-source-sherwin-confirm")).toBeNull();
    await settle();

    rerender(<DoorColorSourceFourPreview {...props} pendingSherwin={{ label: "Accessible Beige", hex: "#d1c7b7" }} />);
    await settle();
    expect(screen.getByTestId("four-source-caption-sherwin-williams").textContent).toMatch(/Accessible Beige.*not confirmed yet/);
    expect(snap.batches.at(-1)?.jobs[0].input).toMatchObject({ renderHex: "#d1c7b7" });
    expect((screen.getByTestId("four-source-check-sherwin-williams") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("four-source-sherwin-confirm"));
    expect(onConfirmSherwin).toHaveBeenCalledTimes(1);
  });

  it("does not redraw when only an unrelated parent render happens", async () => {
    const slots = slotsFor(null, ALL_FILLED);
    const { rerender } = render(<DoorColorSourceFourPreview slots={slots} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    rerender(<DoorColorSourceFourPreview slots={[...slots]} onChoose={() => {}} style={{ ...STYLE }} doorProfile={{ ...PROFILE }} allSlotsSaved />);
    await settle();
    expect(snap.batches).toHaveLength(1);
  });

  it("changing one tile redraws only that tile", async () => {
    const { rerender } = render(<DoorColorSourceFourPreview slots={slotsFor(null, ALL_FILLED)} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    const changed = { listing: { available: true, sources: [{ source: "sherwin-williams", value: SW }, { source: "hex", value: { hex: "#aa5500" } }] } };
    rerender(<DoorColorSourceFourPreview slots={slotsFor(null, changed)} onChoose={() => {}} style={STYLE} doorProfile={PROFILE} allSlotsSaved />);
    await settle();
    expect(snap.batches).toHaveLength(2);
    expect(snap.batches[1].jobs).toHaveLength(1);
    expect(snap.batches[1].jobs[0].input).toMatchObject({ renderHex: "#aa5500" });
  });

  it("a door with no profile says there is nothing to render and draws nothing", async () => {
    render(<DoorColorSourceFourPreview slots={slotsFor(null)} onChoose={() => {}} style={STYLE} doorProfile={null} allSlotsSaved={false} />);
    await settle();
    expect(screen.getByTestId("door-four-source-no-profile").textContent).toMatch(/no profile yet/i);
    expect(snap.batches).toHaveLength(0);
  });
});

describe("fourSourceRenderInput", () => {
  it("a color slot paints the exact hex with no photo, best effort (the gate stays on and cannot refuse)", () => {
    const slots = slotsFor({ source: "sherwin-williams", confirmed: true, chosenAt: NOW, color: SW });
    const input = fourSourceRenderInput({ style: STYLE, doorProfile: PROFILE, slot: slots.find((slot) => slot.checked) });
    expect(input).toMatchObject({ samplePhotoUrl: null, renderHex: "#d1c7b7", color: "#d1c7b7", colorDeltaEMax: null, bestEffortColor: true });
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
