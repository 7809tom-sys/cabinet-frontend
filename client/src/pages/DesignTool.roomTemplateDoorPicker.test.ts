import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("room templates ask for a door style before creating the room", () => {
  it("opens the shared door picker from the bathroom and closet templates when no style is chosen", () => {
    expect(source).toContain("const beginRoomTemplateAfterDoorStyle = useCallback((apply: () => void) => {");
    expect(source).toContain("if (styleId != null) {\n      apply();\n      return;\n    }");
    expect(source).toContain("pendingRoomApplyRef.current = apply;");
    expect(source).toContain("window.setTimeout(() => setCatalogSetupOpen(true), 0);");
    expect(source).toContain("onClick={() => beginRoomTemplateAfterDoorStyle(applyBathroomStarterTemplate)}");
    expect(source).toContain("beginRoomTemplateAfterDoorStyle(() => {");
    const finish = source.slice(source.indexOf("const finishCabinetStylePopup"), source.indexOf("const beginRoomTemplateAfterDoorStyle"));
    expect(finish).toContain("const pendingRoom = pendingRoomApplyRef.current;");
    expect(finish).toContain("if (pendingRoom) {\n      pendingRoom();\n      return;\n    }");
    expect(finish.indexOf("if (cabinetStylePopupPurpose === \"auto-design\")")).toBeLessThan(finish.indexOf("const pendingRoom"));
  });

  it("still creates a kitchen layout through the existing room-layout follow-up", () => {
    expect(source).toContain("onLayoutSelected={handleRoomLayoutSelected}");
    expect(source).toContain('window.setTimeout(() => setLayoutStarterOpen(true), 0);');
  });
});
