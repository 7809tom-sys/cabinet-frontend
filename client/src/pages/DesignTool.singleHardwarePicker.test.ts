import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESIGNER_HARDWARE_STYLE_ID, HARDWARE_STYLES, catalogHardwareStyleId, hardwareStyle, savedHardwareFallbackStyleId,
} from "@/lib/hardware";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const designer = read("./DesignTool.tsx");
const viewer = read("../components/design/InteractiveRoom3D.tsx");
const dialog = read("../components/design/CabinetAttributesDialog.tsx");

describe("the brand catalog picker is the only hardware section", () => {
  it("the generic handle controls and their 3D toolbar button are deleted", () => {
    expect(existsSync(new URL("../components/design/CabinetHandlesControl.tsx", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../components/design/ThreeDHandlesControl.tsx", import.meta.url))).toBe(false);
    for (const source of [designer, viewer, dialog]) {
      expect(source).not.toMatch(/CabinetHandlesControl|ThreeDHandlesControl|designer-handles-select|three-d-handles-trigger/);
    }
    expect(viewer).not.toContain("onHardwareStyleChange");
    expect(designer).not.toContain("setGenericHardwareStyle");
  });
  it("renders no generic style list: the only hardware picker mounts are the toolbar and the phone sheet", () => {
    expect(designer.match(/<HardwareCatalogPicker/g)).toHaveLength(2);
    expect(designer).not.toMatch(/HARDWARE_STYLES\.map/);
    expect(dialog).not.toMatch(/HARDWARE_STYLES/);
  });
  it("keeps the internal mapping and the handle-position controls", () => {
    expect(HARDWARE_STYLES.length).toBeGreaterThan(0);
    expect(dialog).toContain("Hardware placement");
  });
});

describe("brand hardware drives the 3D, elevation and corner handle style", () => {
  it("a brand pick maps to the style the views render", () => {
    expect(hardwareStyle(catalogHardwareStyleId("Knob")!).doorPiece).toBe("knob");
    expect(hardwareStyle(catalogHardwareStyleId("Cup pull")!).drawerPiece).toBe("cup");
    expect(hardwareStyle(catalogHardwareStyleId("Bar pull")!).doorPiece).toBe("pull");
    expect(catalogHardwareStyleId("Appliance handle")).toBeNull();
  });
  it("picking brand hardware sets the style id passed to the views", () => {
    const pick = designer.slice(designer.indexOf("const selectCatalogHardware"), designer.indexOf("const selectedPlanSurfaces"));
    expect(pick).toContain("catalogHardwareStyleId(normalized.productType)");
    expect(pick).toContain("setHardwareStyleId(proxy)");
    expect(pick).toContain("setCatalogHardwareSelection(normalized)");
  });
});

describe("saved designs with only a generic hardwareStyleId still load", () => {
  it("reads the saved id as the fallback when there is no brand pick, and shows no brand selection", () => {
    const load = designer.slice(designer.indexOf("const restoredCatalogHardware"), designer.indexOf("if (d.wallCabHeight === 30"));
    expect(load).toContain("setHardwareStyleId(savedHardwareFallbackStyleId(d.hardwareStyleId))");
    expect(load).toContain("setCatalogHardwareSelection(null)");
  });
  it("every older generic id keeps its style; unknown or missing ids use the Designer default", () => {
    for (const style of HARDWARE_STYLES) expect(savedHardwareFallbackStyleId(style.id)).toBe(style.id);
    expect(savedHardwareFallbackStyleId("none")).toBe("none");
    expect(savedHardwareFallbackStyleId("retired-style")).toBe(DEFAULT_DESIGNER_HARDWARE_STYLE_ID);
    expect(savedHardwareFallbackStyleId(undefined)).toBe(DEFAULT_DESIGNER_HARDWARE_STYLE_ID);
  });
});
