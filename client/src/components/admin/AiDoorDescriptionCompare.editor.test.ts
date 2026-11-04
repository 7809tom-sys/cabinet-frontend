/**
 * The AI door-description comparison belongs to the door editor only.
 *
 * These assertions read the door editor's own source, the same way the other
 * editor tests in this repo pin a UI contract: the tool is mounted in the edit
 * dialog, it is not reachable from the public Door Styles page, and nothing in it
 * runs on open.
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

  it("does no work until the operator starts it", () => {
    // The collapsed branch renders before any parsing or storage read.
    const collapsedIndex = compareSource.indexOf("ai-door-compare-closed");
    const parseIndex = compareSource.indexOf("parseAiDoorComparison(fields)");
    expect(collapsedIndex).toBeGreaterThan(-1);
    expect(parseIndex).toBeGreaterThan(-1);
    // Parsing is gated behind the open flag and the start handler.
    expect(compareSource).toContain("open ? parseAiDoorComparison(fields) : null");
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

describe("the WalzCraft wizard stays where it was", () => {
  it("is still only in the door editor", () => {
    expect(editorSource).toContain("DoorEditorWalzAudit");
    expect(publicStylesSource).not.toContain("DoorEditorWalzAudit");
    // The comparison tool does not reach into the wizard's storage.
    expect(compareSource).not.toContain("walzcraftDesignerPickup");
    expect(compareSource).not.toContain("WIZARD_DOOR_FINISH_STORAGE_KEY");
  });
});
