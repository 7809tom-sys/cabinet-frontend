// @vitest-environment jsdom
/**
 * The AI door-description comparison in the door editor.
 *
 * Covers what Tom asked for:
 * - the three fields (GPT, Claude, Gemini) render;
 * - the previews update from pasted text;
 * - choosing one official records the winner and keeps the other two as reference;
 * - nothing runs on editor open;
 * - the plain-text color description saves.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiDoorDescriptionCompare } from "./AiDoorDescriptionCompare";
import { DoorColorDescriptionField } from "./DoorColorDescriptionField";
import {
  AI_DOOR_COMPARISON_STORAGE_KEY,
  DOOR_COLOR_DESCRIPTION_STORAGE_KEY,
  readAiDoorComparison,
  readDoorColorDescription,
} from "@shared/aiDoorDescriptionStore";

const STYLE = {
  id: 330026,
  doorStyle: "Raised Panel",
  color: "#EEEADF",
  finish: "Painted",
  woodSpecies: "Painted HDF",
  panelConstruction: "raised" as const,
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

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
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
});

describe("the three fields render", () => {
  it("shows a labelled field, a copy prompt, a preview, and a choose action for each model", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    for (const [model, label] of [["gpt", "GPT"], ["claude", "Claude"], ["gemini", "Gemini"]] as const) {
      const column = screen.getByTestId(`ai-door-model-${model}`);
      expect(column.textContent).toContain(label);
      const field = screen.getByTestId(`ai-door-field-${model}`) as HTMLTextAreaElement;
      expect(field.placeholder).toContain(label);
      expect(field.value).toBe("");
      expect(screen.getByTestId(`ai-door-copy-${model}`).textContent).toContain("Copy prompt");
      expect(screen.getByTestId(`ai-door-choose-${model}`).textContent).toContain("Choose as official");
      // The preview draws even for an empty field: a library-default front.
      expect(column.querySelector('[data-testid="ai-door-preview-svg"]')).toBeTruthy();
    }

    // Three previews side by side, one per model.
    expect(document.querySelectorAll('[data-testid="ai-door-preview-svg"]')).toHaveLength(3);
  });

  it("copies each model's own prompt", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    fireEvent.click(screen.getByTestId("ai-door-copy-claude"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("cabinet door");
    await waitFor(() => expect(screen.getByTestId("ai-door-copy-claude").textContent).toContain("Copied"));
  });
});

describe("previews update from pasted text", () => {
  it("redraws one column's preview when its own text is pasted", () => {
    render(<AiDoorDescriptionCompare style={STYLE} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));

    const svgFor = (model: string) =>
      screen.getByTestId(`ai-door-field-${model}`).closest('[data-testid^="ai-door-model-"]')!
        .querySelector('[data-testid="ai-door-preview-svg"]') as HTMLElement;

    // Empty: no library entry, no raised geometry.
    expect(svgFor("gpt").getAttribute("data-entry")).toBe("none");
    expect(svgFor("gpt").getAttribute("data-raised")).toBe("false");

    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: RAISED_TEXT } });
    expect(svgFor("gpt").getAttribute("data-entry")).toBe("raised-panel-five-piece-bevel");
    expect(svgFor("gpt").getAttribute("data-raised")).toBe("true");
    // Painted: no grain lines.
    expect(svgFor("gpt").getAttribute("data-grain")).toBe("false");

    // A different column, a different shape, all in the same render.
    fireEvent.change(screen.getByTestId("ai-door-field-claude"), { target: { value: SHAKER_TEXT } });
    expect(svgFor("claude").getAttribute("data-entry")).toBe("dl-shaker-frame");
    expect(svgFor("claude").getAttribute("data-raised")).toBe("false");
    // Stained wood keeps the grain lines.
    expect(svgFor("claude").getAttribute("data-grain")).toBe("true");

    // Gemini stays untouched, so pasting into one field never rewrites another.
    expect(svgFor("gemini").getAttribute("data-entry")).toBe("none");
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
