/**
 * The AI door-description comparison belongs to the door editor only.
 *
 * These assertions read the door editor's own source, the same way the other
 * editor tests in this repo pin a UI contract: the tool is mounted in the edit
 * dialog, it is not reachable from the public Door Styles page, no preview is
 * drawn for an empty column, and nothing in it runs on open.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editorSource = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/FeaturedStylesAdmin.tsx"),
  "utf8",
);
const publicStylesSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/DoorStyles.tsx"),
  "utf8",
);
const compareSource = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/AiDoorDescriptionCompare.tsx"),
  "utf8",
);
const designerSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/DesignTool.tsx"),
  "utf8",
);

describe("the comparison is a door-editor tool", () => {
  it("is mounted in the door editor's edit dialog", () => {
    expect(editorSource).toContain('from "@/components/admin/AiDoorDescriptionCompare"');
    expect(editorSource).toContain("<AiDoorDescriptionCompare");
    // Mounted inside the edit dialog that carries the profile fields.
    const dialogIndex = editorSource.indexOf("Profile Description");
    const mountIndex = editorSource.indexOf("<AiDoorDescriptionCompare");
    expect(mountIndex).toBeGreaterThan(dialogIndex);
  });

  it("is not on the public Door Styles page", () => {
    expect(publicStylesSource).not.toContain("AiDoorDescriptionCompare");
    expect(publicStylesSource).not.toContain("ai-door-compare");
  });

  it("keeps the color description field in the editor too, and off the public page", () => {
    expect(editorSource).toContain('from "@/components/admin/DoorColorDescriptionField"');
    expect(editorSource).toContain("<DoorColorDescriptionField");
    expect(publicStylesSource).not.toContain("DoorColorDescriptionField");
  });

  it("saves the chosen winner through the editor's existing profile save", () => {
    // The handler writes the winner's stated values into the editor's own state,
    // so the normal Save button persists them with the rest of the profile.
    expect(editorSource).toContain("handleChooseOfficialDescription");
    expect(editorSource).toContain("officialRecordAsStylePatch(record)");
    expect(editorSource).toContain("setProfileDescription(patch.profileDescription)");
    // The color description takes part in the normal save as well.
    expect(editorSource).toContain("saveDoorColorDescription(style.id, colorDescription)");
  });

  it("gives the chosen profile the values the Designer needs to redraw", () => {
    // The tool reads the editor's live frame and finish fields, not a stale copy,
    // so "already saved" can be judged against what is actually on the row.
    const mount = editorSource.slice(
      editorSource.indexOf("<AiDoorDescriptionCompare"),
      editorSource.indexOf("/>", editorSource.indexOf("<AiDoorDescriptionCompare")),
    );
    for (const field of ["railWidth", "stileWidth", "bevelWidth", "bevelDepth", "insideEdgeProfile", "finishSheen", "grainDirection"]) {
      expect(mount, field).toContain(field);
    }
  });

  it("does no work until the operator starts it", () => {
    // The collapsed branch renders before any parsing or storage read.
    const collapsedIndex = compareSource.indexOf("ai-door-compare-closed");
    const parseIndex = compareSource.indexOf("parseAiDoorComparison(fields, style)");
    expect(collapsedIndex).toBeGreaterThan(-1);
    expect(parseIndex).toBeGreaterThan(-1);
    // Parsing is gated behind the open flag and the start handler. The style is
    // passed so a documented USCD family can be read from the style name.
    expect(compareSource).toContain("open ? parseAiDoorComparison(fields, style) : null");
    expect(compareSource).toContain("readAiDoorComparison(style.id)");
    // The storage read lives in the start handler, not in a mount effect.
    const startHandler = compareSource.slice(
      compareSource.indexOf("function startComparison"),
      compareSource.indexOf("async function copyPrompt"),
    );
    expect(startHandler).toContain("readAiDoorComparison(style.id)");
    expect(compareSource).not.toMatch(/useEffect\(\s*\(\)\s*=>\s*\{[^}]*readAiDoorComparison/);
  });
});

describe("the tool calls a model only on Generate", () => {
  it("has exactly one place that runs a generation, and it is the button", () => {
    // One call site, inside `generate`, which is wired to the Generate button.
    const callSites = compareSource.match(/describe\.generate\(/g) ?? [];
    expect(callSites).toHaveLength(1);
    const generateStart = compareSource.indexOf("async function generate(");
    const generateEnd = compareSource.indexOf("function saveComparison(");
    expect(generateStart).toBeGreaterThan(-1);
    expect(compareSource.slice(generateStart, generateEnd)).toContain("describe.generate(");
    // The button is the only trigger.
    expect(compareSource).toContain("onClick={() => void generate(model)}");
  });

  it("has no effect that could start one", () => {
    expect(compareSource).not.toMatch(/useEffect\([^)]*\)[\s\S]{0,200}generate\(/);
    // And nothing fires on the open handler beyond reading saved drafts.
    const startHandler = compareSource.slice(
      compareSource.indexOf("function startComparison"),
      compareSource.indexOf("async function copyPrompt"),
    );
    expect(startHandler).not.toContain("generate(");
  });

  it("sends no key and reads no key", () => {
    expect(compareSource).not.toContain("OPENAI_API_KEY\":");
    expect(compareSource).not.toMatch(/process\.env/);
    expect(compareSource).not.toMatch(/import\.meta\.env/);
  });
});

describe("a column shows nothing until it has text", () => {
  it("gates both the preview and the parsed lines on real text", () => {
    expect(compareSource).toContain("const hasText = text.length > 0;");
    const previewIndex = compareSource.indexOf("{hasText && (");
    expect(previewIndex).toBeGreaterThan(-1);
    // The entry caption, the unstated list, and the preview are all inside it.
    const gated = compareSource.slice(previewIndex, compareSource.indexOf("<Button", previewIndex));
    expect(gated).toContain("<DoorPreview");
    expect(gated).toContain("ai-door-entry-");
    expect(gated).toContain("ai-door-unstated-");
  });

  it("draws no placeholder door from a defaulted parameter set", () => {
    // There is no unconditional DoorPreview anywhere in the file.
    const calls = compareSource.match(/\{hasText && \(/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    expect(compareSource.match(/<DoorPreview/g) ?? []).toHaveLength(1);
  });
});

describe("choosing a description redraws the actual door", () => {
  it("hands the choice to the Designer through the chosen-profile bridge", () => {
    expect(compareSource).toContain("chosenProfileFromRecord(record)");
    expect(compareSource).toContain("saveChosenDoorProfile(style.id, profile)");
    expect(compareSource).toContain("announceChosenDoorProfile(style.id)");
  });

  it("merges that choice into the door styles the 3D designer renders", () => {
    expect(designerSource).toContain('from "@/lib/useChosenDoorProfiles"');
    expect(designerSource).toContain("useChosenDoorProfiles()");
    expect(designerSource).toContain("withChosenProfiles<(typeof catalogDoorStyles)[number]>(catalogDoorStyles, chosenProfileFor)");
    // The merged rows feed the 3D renderer, so the door Tom sees changes.
    expect(designerSource).toContain("threeDCabinetDoorProfiles");
    expect(designerSource).toContain("activeCatalogDoorProfile");
  });

  it("leaves color precedence where it was", () => {
    // A choice never carries a hex: the preview and the 3D door keep resolving
    // color the same way, an accepted render first.
    expect(compareSource).toContain("previewFaceHex");
    expect(compareSource).not.toContain("renderHex:");
    expect(compareSource).not.toContain("setRenderHex");
  });
});

describe("the WalzCraft wizard stays where it was", () => {
  it("is still only in the door editor", () => {
    expect(editorSource).toContain("DoorEditorWalzAudit");
    expect(publicStylesSource).not.toContain("DoorEditorWalzAudit");
    // The comparison tool does not reach into the wizard's storage.
    expect(compareSource).not.toContain("walzcraftDesignerPickup");
    expect(compareSource).not.toContain("WIZARD_DOOR_FINISH_STORAGE_KEY");
  });
});
