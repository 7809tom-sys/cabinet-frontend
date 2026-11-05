// @vitest-environment jsdom
/**
 * The AI door-description comparison in the door editor.
 *
 * Covers what Tom asked for:
 * - the three fields (GPT, Claude, Gemini) render;
 * - a column's preview is HIDDEN until that column has real text — no default
 *   placeholder door outline;
 * - Generate fills that column's box from the model, and only that column's;
 * - a missing key shows a plain sentence instead of failing silently;
 * - nothing calls a model on open; Generate only runs on the button;
 * - choosing one official records the winner, keeps the other two as reference,
 *   and hands the Designer the chosen profile straight away;
 * - the previews update from pasted text;
 * - the plain-text color description saves.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The Generate mutation is replaced per test; nothing here reaches the network. */
const describeMock = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  available: true,
}));

vi.mock("@/lib/aiDoorDescribeClient", () => ({
  AI_DOOR_GENERATE_UNAVAILABLE_MESSAGE: "Generate needs the API server's AI door procedure, which is not deployed yet. Copy the prompt instead.",
  aiDoorDescribeProcedureAvailable: () => describeMock.available,
  useAiDoorDescribe: () => ({
    available: describeMock.available,
    isPending: describeMock.isPending,
    generate: async (model: string, input: unknown) => {
      const result = await describeMock.mutateAsync(input);
      return result ?? { description: null, message: "That description could not be generated. Try again.", notConnected: false };
    },
  }),
}));

import { AiDoorDescriptionCompare } from "./AiDoorDescriptionCompare";
import { DoorColorDescriptionField } from "./DoorColorDescriptionField";
import {
  AI_DOOR_COMPARISON_STORAGE_KEY,
  DOOR_COLOR_DESCRIPTION_STORAGE_KEY,
  readAiDoorComparison,
  readDoorColorDescription,
} from "@shared/aiDoorDescriptionStore";
import {
  AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY,
  readChosenDoorProfile,
} from "@shared/aiDoorChosenProfile";
import { AI_DOOR_PROMPTS } from "@shared/aiDoorPrompts";
import { AI_DOOR_MODEL_ENV_KEYS, AI_DOOR_NOT_CONNECTED_MESSAGE } from "@shared/aiDoorDescribe";

const STYLE = {
  id: 330026,
  doorStyle: "Raised Panel",
  color: "#EEEADF",
  finish: "Painted",
  woodSpecies: "Painted HDF",
  panelConstruction: "raised" as const,
  railWidth: null,
  stileWidth: null,
  bevelWidth: null,
  bevelDepth: null,
  insideEdgeProfile: null,
  finishSheen: "satin" as const,
  grainDirection: "none" as const,
};

const RAISED_TEXT = [
  "Style family: Raised Panel.",
  "Frame: mitered corners.",
  "Rail width: 2 1/2 in. Stile width: 2 1/2 in.",
  "Panel: raised center panel.",
  "Edge / bevel: bevel, about 3/4 in wide.",
  "Grain or painted: opaque painted finish.",
  "Sheen: matte.",
  "Undertone: warm.",
  "Color: warm ivory.",
].join("\n");

const SHAKER_TEXT = [
  "Style family: shaker.",
  "Frame: cope-and-stick.",
  "Panel: flat recessed panel.",
  "Grain: visible wood grain, vertical.",
  "Sheen: satin.",
  "Color: pale greige.",
].join("\n");

function storedComparison(styleId: number) {
  return readAiDoorComparison(styleId);
}

function columnOf(model: string): HTMLElement {
  return screen.getByTestId(`ai-door-model-${model}`);
}

function previewIn(model: string): Element | null {
  return columnOf(model).querySelector('[data-testid="ai-door-preview-svg"]');
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  describeMock.mutateAsync.mockReset();
  describeMock.isPending = false;
  describeMock.available = true;
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

afterEach(cleanup);

describe("nothing runs on editor open", () => {
  it("shows only a start button and touches no storage or preview", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    render(<AiDoorDescriptionCompare style={STYLE} sampleUrl="/uploads/cabinet-door.jpg" />);

    // The collapsed state is what mounts with the door editor.
    expect(screen.getByTestId("ai-door-compare-closed")).toBeTruthy();
    expect(screen.queryByTestId("ai-door-compare")).toBeNull();
    for (const model of ["gpt", "claude", "gemini"]) {
      expect(screen.queryByTestId(`ai-door-field-${model}`), model).toBeNull();
      expect(screen.queryByTestId(`ai-door-preview-svg-${model}`), model).toBeNull();
      expect(screen.queryByTestId(`ai-door-generate-${model}`), model).toBeNull();
    }
    // No comparison record is read until the operator asks for one.
    expect(getItem).not.toHaveBeenCalledWith(AI_DOOR_COMPARISON_STORAGE_KEY);
    expect(screen.getByTestId("ai-door-compare-start").textContent).toContain("Compare descriptions");
  });

  it("opens the comparison only when the start button is pressed", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    expect(screen.getByTestId("ai-door-compare")).toBeTruthy();
    expect(screen.getByTestId("ai-door-field-gpt")).toBeTruthy();
  });

  it("never calls a model on open, not even after the panel is showing", async () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    // Give any stray effect a chance to run before asserting nothing did.
    await waitFor(() => expect(screen.getByTestId("ai-door-generate-gpt")).toBeTruthy());
    expect(describeMock.mutateAsync).not.toHaveBeenCalled();
  });
});

describe("the three columns render", () => {
  it("shows a labelled field, a Generate, a copy prompt, and a choose action for each model", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    for (const [model, label] of [["gpt", "GPT"], ["claude", "Claude"], ["gemini", "Gemini"]] as const) {
      const column = columnOf(model);
      expect(column.textContent).toContain(label);
      const field = screen.getByTestId(`ai-door-field-${model}`) as HTMLTextAreaElement;
      expect(field.placeholder).toContain(label);
      expect(field.value).toBe("");
      expect(screen.getByTestId(`ai-door-generate-${model}`).textContent).toContain("Generate");
      expect(screen.getByTestId(`ai-door-copy-${model}`).textContent).toContain("Copy prompt");
      expect(screen.getByTestId(`ai-door-choose-${model}`).textContent).toContain("Choose as official");
    }
  });

  it("copies each model's own prompt", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    fireEvent.click(screen.getByTestId("ai-door-copy-claude"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toBe(AI_DOOR_PROMPTS.claude);
    await waitFor(() => expect(screen.getByTestId("ai-door-copy-claude").textContent).toContain("Copied"));
  });
});

describe("no preview until a column has real text", () => {
  it("draws no door at all while every column is empty", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    for (const model of ["gpt", "claude", "gemini"]) {
      expect(previewIn(model), model).toBeNull();
      expect(screen.queryByTestId(`ai-door-entry-${model}`), model).toBeNull();
      expect(screen.queryByTestId(`ai-door-unstated-${model}`), model).toBeNull();
    }
    expect(document.querySelectorAll('[data-testid="ai-door-preview-svg"]')).toHaveLength(0);
  });

  it("still draws nothing when a field holds only whitespace", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: "   \n\t " } });
    expect(previewIn("gpt")).toBeNull();
  });

  it("draws the door the moment that column has text", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: RAISED_TEXT } });
    const preview = previewIn("gpt") as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.getAttribute("data-entry")).toBe("raised-panel-five-piece-bevel");
    expect(preview.getAttribute("data-raised")).toBe("true");
    expect(preview.getAttribute("data-grain")).toBe("false");
    // The other two columns still show nothing.
    expect(previewIn("claude")).toBeNull();
    expect(previewIn("gemini")).toBeNull();
  });
});

describe("Generate", () => {
  it("sends that column's own prompt with the door photo and fills that box only", async () => {
    describeMock.mutateAsync.mockResolvedValue({
      description: "The generated description.",
      message: null,
      notConnected: false,
    });
    render(<AiDoorDescriptionCompare style={STYLE} sampleUrl="/uploads/cabinet-door.jpg" />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    fireEvent.click(screen.getByTestId("ai-door-generate-claude"));

    await waitFor(() => expect((screen.getByTestId("ai-door-field-claude") as HTMLTextAreaElement).value).toBe("The generated description."));
    expect(describeMock.mutateAsync).toHaveBeenCalledTimes(1);
    const sent = describeMock.mutateAsync.mock.calls[0][0] as {
      model: string; prompt: string; image: { url: string } | null; styleId: number | null;
    };
    expect(sent.model).toBe("claude");
    expect(sent.prompt).toBe(AI_DOOR_PROMPTS.claude);
    expect(sent.image).toEqual({ url: "/uploads/cabinet-door.jpg" });
    expect(sent.styleId).toBe(STYLE.id);
    // Only Claude's box got the text.
    expect((screen.getByTestId("ai-door-field-gpt") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByTestId("ai-door-field-gemini") as HTMLTextAreaElement).value).toBe("");
  });

  it("generates for each model separately, once per press", async () => {
    describeMock.mutateAsync
      .mockResolvedValueOnce({ description: "GPT answer.", message: null, notConnected: false })
      .mockResolvedValueOnce({ description: "Gemini answer.", message: null, notConnected: false });
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    fireEvent.click(screen.getByTestId("ai-door-generate-gpt"));
    await waitFor(() => expect((screen.getByTestId("ai-door-field-gpt") as HTMLTextAreaElement).value).toBe("GPT answer."));
    fireEvent.click(screen.getByTestId("ai-door-generate-gemini"));
    await waitFor(() => expect((screen.getByTestId("ai-door-field-gemini") as HTMLTextAreaElement).value).toBe("Gemini answer."));

    expect(describeMock.mutateAsync).toHaveBeenCalledTimes(2);
    expect((describeMock.mutateAsync.mock.calls[0][0] as { model: string }).model).toBe("gpt");
    expect((describeMock.mutateAsync.mock.calls[1][0] as { model: string }).model).toBe("gemini");
    expect((screen.getByTestId("ai-door-field-claude") as HTMLTextAreaElement).value).toBe("");
  });

  it("draws the preview from the generated text", async () => {
    describeMock.mutateAsync.mockResolvedValue({ description: SHAKER_TEXT, message: null, notConnected: false });
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    expect(previewIn("gemini")).toBeNull();

    fireEvent.click(screen.getByTestId("ai-door-generate-gemini"));
    await waitFor(() => expect(previewIn("gemini")).toBeTruthy());
    const preview = previewIn("gemini") as HTMLElement;
    expect(preview.getAttribute("data-entry")).toBe("dl-shaker-frame");
  });

  it("says plainly when a model is not connected, and leaves the box alone", async () => {
    describeMock.mutateAsync.mockResolvedValue({
      description: null,
      message: AI_DOOR_NOT_CONNECTED_MESSAGE.claude,
      notConnected: true,
    });
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    fireEvent.click(screen.getByTestId("ai-door-generate-claude"));

    await waitFor(() => expect(screen.getByTestId("ai-door-generate-message-claude")).toBeTruthy());
    const message = screen.getByTestId("ai-door-generate-message-claude");
    expect(message.textContent).toBe(AI_DOOR_NOT_CONNECTED_MESSAGE.claude);
    expect(message.textContent).toContain("Claude isn't connected yet");
    // A missing key is a status, not an alarm, and the panel is still usable.
    expect(message.getAttribute("role")).toBe("status");
    expect((screen.getByTestId("ai-door-field-claude") as HTMLTextAreaElement).value).toBe("");
    expect(previewIn("claude")).toBeNull();
    expect((screen.getByTestId("ai-door-generate-claude") as HTMLButtonElement).disabled).toBe(false);
    // The other two columns are untouched.
    expect(screen.queryByTestId("ai-door-generate-message-gpt")).toBeNull();
  });

  it("names the variable the column needs, so the fix is obvious", () => {
    expect(AI_DOOR_NOT_CONNECTED_MESSAGE.gpt).toContain(AI_DOOR_MODEL_ENV_KEYS.gpt);
    expect(AI_DOOR_NOT_CONNECTED_MESSAGE.claude).toContain(AI_DOOR_MODEL_ENV_KEYS.claude);
    expect(AI_DOOR_NOT_CONNECTED_MESSAGE.gemini).toContain(AI_DOOR_MODEL_ENV_KEYS.gemini);
  });

  it("shows a failed generation as a plain error, not a spinner", async () => {
    describeMock.mutateAsync.mockResolvedValue({
      description: null,
      message: "GPT is busy right now. Try Generate again in a moment.",
      notConnected: false,
    });
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.click(screen.getByTestId("ai-door-generate-gpt"));

    await waitFor(() => expect(screen.getByTestId("ai-door-generate-message-gpt")).toBeTruthy());
    const message = screen.getByTestId("ai-door-generate-message-gpt");
    expect(message.getAttribute("role")).toBe("alert");
    expect(message.textContent).toContain("GPT is busy");
    expect((screen.getByTestId("ai-door-generate-gpt") as HTMLButtonElement).textContent).toContain("Generate");
    expect(previewIn("gpt")).toBeNull();
  });

  it("explains, in plain words, when this build has no AI procedure at all", async () => {
    describeMock.available = false;
    describeMock.mutateAsync.mockResolvedValue({
      description: null,
      message: "Generate needs the API server's AI door procedure, which is not deployed yet. Copy the prompt instead.",
      notConnected: false,
    });
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.click(screen.getByTestId("ai-door-generate-gemini"));
    await waitFor(() => expect(screen.getByTestId("ai-door-generate-message-gemini").textContent).toContain("not deployed yet"));
  });
});

describe("previews update from pasted text", () => {
  it("redraws one column's preview when its own text is pasted", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: RAISED_TEXT } });
    const gpt = previewIn("gpt") as HTMLElement;
    expect(gpt.getAttribute("data-entry")).toBe("raised-panel-five-piece-bevel");
    expect(gpt.getAttribute("data-raised")).toBe("true");
    // Painted: no grain lines.
    expect(gpt.getAttribute("data-grain")).toBe("false");

    // A different column, a different shape, all in the same render.
    fireEvent.change(screen.getByTestId("ai-door-field-claude"), { target: { value: SHAKER_TEXT } });
    const claude = previewIn("claude") as HTMLElement;
    expect(claude.getAttribute("data-entry")).toBe("dl-shaker-frame");
    expect(claude.getAttribute("data-raised")).toBe("false");
    // Stained wood keeps the grain lines.
    expect(claude.getAttribute("data-grain")).toBe("true");

    // Gemini stays untouched, so pasting into one field never rewrites another.
    expect(previewIn("gemini")).toBeNull();
  });

  it("lists the parameters the pasted text did not state instead of inventing them", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), {
      target: { value: "Style family: raised panel. Painted warm white." },
    });
    const unstated = screen.getByTestId("ai-door-unstated-gpt");
    expect(unstated.textContent).toContain("Left at the library default");
    expect(unstated.textContent).toContain("railIn");
    expect(unstated.textContent).toContain("stileIn");
  });
});

describe("choosing a description as official", () => {
  it("persists the winner and keeps the other two as reference", async () => {
    const onChooseOfficial = vi.fn();
    render(<AiDoorDescriptionCompare style={STYLE} onChooseOfficial={onChooseOfficial} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: RAISED_TEXT } });
    fireEvent.change(screen.getByTestId("ai-door-field-claude"), { target: { value: SHAKER_TEXT } });
    fireEvent.change(screen.getByTestId("ai-door-field-gemini"), { target: { value: "Style family: slab. Gloss." } });

    fireEvent.click(screen.getByTestId("ai-door-choose-claude"));

    await waitFor(() => expect(screen.getByTestId("ai-door-chosen-claude")).toBeTruthy());
    // The winner is marked official and the others are not.
    expect(screen.getByTestId("ai-door-chosen-claude").textContent).toContain("Official");
    expect(screen.queryByTestId("ai-door-chosen-gpt")).toBeNull();
    expect(screen.queryByTestId("ai-door-chosen-gemini")).toBeNull();

    // It persisted the winner and kept the two losers as reference.
    const stored = storedComparison(STYLE.id);
    expect(stored.chosen).toBe("claude");
    expect(stored.fields.gpt).toBe(RAISED_TEXT);
    expect(stored.reference.gpt).toBe(RAISED_TEXT);
    expect(stored.reference.gemini).toContain("slab");
    expect(stored.reference.claude).toBeUndefined();

    // The editor is handed the winning record to save through its own profile path.
    expect(onChooseOfficial).toHaveBeenCalledTimes(1);
    const record = onChooseOfficial.mock.calls[0][0];
    expect(record.model).toBe("claude");
    expect(record.description).toBe(SHAKER_TEXT);
    expect(record.reference.map((entry: { model: string }) => entry.model).sort()).toEqual(["gemini", "gpt"]);
    expect(screen.getByTestId("ai-door-reference-note").textContent).toContain("GPT");
    expect(screen.getByTestId("ai-door-reference-note").textContent).toContain("Gemini");
  });

  it("hands the Designer the chosen profile, with only the stated values", () => {
    render(<AiDoorDescriptionCompare style={STYLE} onChooseOfficial={() => undefined} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-claude"), { target: { value: SHAKER_TEXT } });
    fireEvent.click(screen.getByTestId("ai-door-choose-claude"));

    // The Designer reads this record; it drives the door before Save.
    const chosen = readChosenDoorProfile(STYLE.id);
    expect(chosen).not.toBeNull();
    expect(chosen!.doorStyle).toBe("Shaker");
    expect(chosen!.panelConstruction).toBe("flat");
    expect(chosen!.grainDirection).toBe("vertical");
    expect(chosen!.finishSheen).toBe("satin");
    // The shaker text stated no frame width, so the draft states none either:
    // the renderer keeps the library default rather than a made-up number.
    expect(chosen!.railWidth).toBeUndefined();
    expect(chosen!.stileWidth).toBeUndefined();
    // The color is never part of the draft: precedence stays with the resolver.
    expect(chosen as Record<string, unknown>).not.toHaveProperty("renderHex");
    expect(chosen as Record<string, unknown>).not.toHaveProperty("color");
    expect(localStorage.getItem(AI_DOOR_CHOSEN_PROFILE_STORAGE_KEY)).toContain("Shaker");
  });

  it("records a stated width, so a measured choice reaches the door", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: RAISED_TEXT } });
    fireEvent.click(screen.getByTestId("ai-door-choose-gpt"));

    const chosen = readChosenDoorProfile(STYLE.id);
    expect(chosen!.doorStyle).toBe("Raised Panel");
    expect(chosen!.railWidth).toBe(2.5);
    expect(chosen!.stileWidth).toBe(2.5);
    expect(chosen!.bevelWidth).toBe(0.75);
  });

  it("clears the draft when the saved row already matches the choice", () => {
    const alreadySaved = { ...STYLE, doorStyle: "Shaker", panelConstruction: "flat" as const, grainDirection: "vertical", finishSheen: "satin" as const };
    render(<AiDoorDescriptionCompare style={alreadySaved} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-claude"), { target: { value: SHAKER_TEXT } });
    fireEvent.click(screen.getByTestId("ai-door-choose-claude"));
    // Every stated value is already on the saved row, so a draft would only shadow
    // the live record. It is dropped instead of stored.
    expect(readChosenDoorProfile(STYLE.id)).toBeNull();
  });

  it("reloads the saved winner when the tool is opened again", () => {
    const { unmount } = render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: RAISED_TEXT } });
    fireEvent.click(screen.getByTestId("ai-door-choose-gpt"));
    unmount();

    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    expect(screen.getByTestId("ai-door-chosen-gpt")).toBeTruthy();
    expect((screen.getByTestId("ai-door-field-gpt") as HTMLTextAreaElement).value).toBe(RAISED_TEXT);
  });

  it("cannot choose a model whose field is still empty", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    const choose = screen.getByTestId("ai-door-choose-gemini") as HTMLButtonElement;
    expect(choose.disabled).toBe(true);
  });

  it("saves the pasted descriptions for the style without choosing a winner", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: RAISED_TEXT } });
    fireEvent.click(screen.getByTestId("ai-door-save-comparison"));
    expect(screen.getByTestId("ai-door-saved-note").textContent).toContain("saved");
    const stored = storedComparison(STYLE.id);
    expect(stored.fields.gpt).toBe(RAISED_TEXT);
    expect(stored.chosen).toBeNull();
  });

  it("never calls a model while choosing, saving, or typing", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: RAISED_TEXT } });
    fireEvent.click(screen.getByTestId("ai-door-save-comparison"));
    fireEvent.click(screen.getByTestId("ai-door-choose-gpt"));
    expect(describeMock.mutateAsync).not.toHaveBeenCalled();
  });
});

describe("plain-text color description", () => {
  it("is blank by default and never guessed from the color", () => {
    render(<DoorColorDescriptionField styleId={STYLE.id} />);
    const input = screen.getByTestId("door-color-description-input") as HTMLTextAreaElement;
    expect(input.value).toBe("");
    expect(input.placeholder).toContain("warm ivory");
    expect(readDoorColorDescription(STYLE.id)).toBe("");
  });

  it("saves what was typed and reports it to the editor", async () => {
    const onSave = vi.fn();
    render(<DoorColorDescriptionField styleId={STYLE.id} onSave={onSave} />);
    const text = "warm ivory with a soft matte, low-luster finish, slight cream undertone";
    fireEvent.change(screen.getByTestId("door-color-description-input"), { target: { value: text } });
    fireEvent.click(screen.getByTestId("door-color-description-save"));

    await waitFor(() => expect(screen.getByTestId("door-color-description-saved")).toBeTruthy());
    expect(readDoorColorDescription(STYLE.id)).toBe(text);
    expect(localStorage.getItem(DOOR_COLOR_DESCRIPTION_STORAGE_KEY)).toContain("warm ivory");
    expect(onSave).toHaveBeenCalledWith(text);
  });

  it("reloads the saved description for the style", () => {
    const text = "cool greige, satin sheen";
    render(<DoorColorDescriptionField styleId={STYLE.id} />);
    fireEvent.change(screen.getByTestId("door-color-description-input"), { target: { value: text } });
    fireEvent.click(screen.getByTestId("door-color-description-save"));
    cleanup();

    render(<DoorColorDescriptionField styleId={STYLE.id} />);
    expect((screen.getByTestId("door-color-description-input") as HTMLTextAreaElement).value).toBe(text);
  });
});
