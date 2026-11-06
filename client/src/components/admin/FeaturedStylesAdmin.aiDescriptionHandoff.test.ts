/**
 * The door editor's half of the AI description handoff.
 *
 * These assertions read the editor's own source, the same way the other editor
 * tests in this repo pin a UI contract. What they protect:
 *
 * - the panel's generated text reaches the door's own Profile Description field,
 *   not only the compare panel;
 * - that field's text is what travels to the model as instructions;
 * - the AI's own last answer is never fed back as if it were an instruction;
 * - the citation gate and the WalzCraft wizard are untouched.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editorSource = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/FeaturedStylesAdmin.tsx"),
  "utf8",
);

/** The `<AiDoorDescriptionCompare ... />` element as written in the editor. */
function panelMount(): string {
  const start = editorSource.indexOf("<AiDoorDescriptionCompare");
  expect(start).toBeGreaterThan(-1);
  const end = editorSource.indexOf("/>", start);
  expect(end).toBeGreaterThan(start);
  return editorSource.slice(start, end + 2);
}

/** The `handleGeneratedDescription` handler body. */
function handoffHandler(): string {
  const start = editorSource.indexOf("const handleGeneratedDescription");
  expect(start).toBeGreaterThan(-1);
  return editorSource.slice(start, editorSource.indexOf("const descriptionInstructions", start));
}

describe("the generated description reaches the door's own field", () => {
  it("passes an onDescription handler to the panel, next to onChooseOfficial", () => {
    const mount = panelMount();
    expect(mount).toContain("onDescription={handleGeneratedDescription}");
    expect(mount).toContain("onChooseOfficial={handleChooseOfficialDescription}");
  });

  it("writes that description into the Profile Description field's state", () => {
    // `profileDescription` is the state the ed-profile-desc textarea renders, so
    // the text appears in the field the operator is looking at.
    const handler = handoffHandler();
    expect(handler).toContain("setProfileDescription(next)");
    expect(handler).toContain("desc");
  });

  it("reports success back to the panel so its indicator can turn green", () => {
    const handler = handoffHandler();
    expect(handler).toContain("return true");
    // An empty answer is not a success.
    expect(handler).toContain("if (!next) return false");
  });

  it("keeps the panel's own copy: the handoff does not clear the compare fields", () => {
    const handler = handoffHandler();
    expect(handler).not.toContain("setFields");
    expect(handler).not.toContain("saveAiDoorComparison");
  });

  it("does not save on its own, the editor's normal Save still does", () => {
    // The handler only sets state; persistence stays with the existing payload.
    const handler = handoffHandler();
    expect(handler).not.toContain(".mutate");
    expect(editorSource).toContain("profileDescription: profileDescription.trim() || null");
  });
});

describe("the typed instructions travel to the model", () => {
  it("passes the description field's text to the panel as instructions", () => {
    expect(panelMount()).toContain("instructions={descriptionInstructions}");
  });

  it("sends what is in the field", () => {
    const start = editorSource.indexOf("const descriptionInstructions");
    expect(start).toBeGreaterThan(-1);
    const block = editorSource.slice(start, editorSource.indexOf("const applySiblingSpecs", start));
    expect(block).toContain("profileDescription");
  });

  it("never feeds the AI's own previous answer back in as an instruction", () => {
    // Otherwise one model's words would be re-sent to the next as the operator's
    // own view of the door, and the door would drift away from the photograph.
    const start = editorSource.indexOf("const descriptionInstructions");
    const block = editorSource.slice(start, editorSource.indexOf("const applySiblingSpecs", start));
    expect(block).toContain("lastAiDescription.current");
    expect(handoffHandler()).toContain("lastAiDescription.current = next");
  });

  it("forgets that answer when the editor switches styles", () => {
    const reset = editorSource.slice(editorSource.indexOf("const resetToStyle"));
    const body = reset.slice(0, reset.indexOf("};"));
    expect(body).toContain('lastAiDescription.current = ""');
  });
});

describe("the rules that must not move", () => {
  it("leaves the citation gate alone", () => {
    // The AI's dimensions still need the official source citation; this change
    // does not weaken that gate.
    expect(editorSource).toContain("if (frameEntryStatus === \"complete\" && !effectiveFrameCitation)");
    expect(editorSource).toContain("const effectiveFrameCitation = sourceSpecification.trim() || styleSourceNote.trim()");
    // And the handler that takes the AI text never bypasses it.
    expect(handoffHandler()).not.toContain("sourceSpecification");
    expect(handoffHandler()).not.toContain("frameEntryStatus");
  });

  it("leaves the WalzCraft wizard in the door editor only", () => {
    expect(editorSource).toContain("DoorEditorWalzAudit");
    // The handoff handler never touches the wizard's storage or its record.
    const handler = handoffHandler();
    expect(handler).not.toContain("wizard");
    expect(handler).not.toContain("WalzCraft");
  });

  it("never sets a render hex from a description", () => {
    const handler = handoffHandler();
    expect(handler).not.toContain("setRenderHex");
    // The chosen-official path still does not touch color either.
    const official = editorSource.slice(
      editorSource.indexOf("const handleChooseOfficialDescription"),
      editorSource.indexOf("const handleGeneratedDescription"),
    );
    expect(official).not.toContain("setRenderHex");
  });
});
