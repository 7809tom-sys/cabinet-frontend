import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COPYABLE_SPEC_FIELDS,
  FRAME_CITATION_REQUIRED,
  NEVER_COPY_FIELDS,
  applySpecPatchToStyles,
  buildSpecPatch,
  defaultSpecGroupIds,
  doorStyleVendorLabel,
  frameCopyBlockReason,
  siblingDoorStyles,
  specBatchToast,
  specValuesFromEditor,
  stylesWillChangeLabel,
  toggleSelectedId,
  type EditorSpecInput,
  type SpecGroupId,
} from "./applyDoorStyleSpecs";

const adminSource = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/FeaturedStylesAdmin.tsx"),
  "utf8",
);
const batchSource = readFileSync(
  resolve(
    process.cwd(),
    "client/src/components/admin/ApplySpecsToOtherStyles.tsx",
  ),
  "utf8",
);
const helperSource = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/applyDoorStyleSpecs.ts"),
  "utf8",
);

const skyline = (
  overrides: Partial<EditorSpecInput> = {},
): EditorSpecInput => ({
  railWidth: "2.75",
  stileWidth: "2.75",
  centerRailWidth: "2.75",
  sourceSpecification: "Skyline 2026 Shaker catalog — style code SH-W",
  panelConstruction: "flat",
  doorPanelType: "Recessed shaker panel",
  bevelWidth: "",
  bevelDepth: "",
  insideEdgeProfile: "square",
  drawerFrontType: "five-piece-flat",
  finish: "Painted",
  finishSheen: "satin",
  woodSpecies: "Maple",
  grainDirection: "vertical-stiles-horizontal-rails",
  profileNotes: "Beaded inner edge",
  profileDescription: "Five-piece shaker with a flat center panel.",
  ...overrides,
});

describe("FeaturedStylesAdmin batch spec apply", () => {
  it("keeps the existing frame citation check and hooks the batch section in beside it", () => {
    expect(adminSource).toContain(
      'if (frameEntryStatus === "complete" && !sourceSpecification.trim())',
    );
    expect(adminSource).toContain(
      "A source citation is required before a frame can render in Designer",
    );
    expect(adminSource).toContain('id="ed-frame-source"');
    expect(adminSource).toContain("<ApplySpecsToOtherStyles");
    expect(adminSource).toContain("catalogStyles={styles}");
    expect(adminSource).toContain(
      "trpc.doorStyles.adminUpdateDoorStyle.useMutation",
    );
    expect(adminSource).toContain("applySpecPatchToStyles(");
    expect(adminSource).toContain("frameCopyBlockReason(");
    expect(adminSource).toContain(
      "Choose at least one spec group to copy, or clear the other styles.",
    );
  });

  it("mirrors the vendor checklist and refuses identity fields in the section copy", () => {
    expect(batchSource).toContain("Apply these specs to other styles");
    expect(batchSource).toContain("Check only styles made with this");
    expect(batchSource).toContain("same physical door profile");
    expect(batchSource).toContain("Select all");
    expect(batchSource).toContain("Clear");
    expect(batchSource).toContain("useState<number[]>([])");
    expect(batchSource).toContain("stylesWillChangeLabel");
    expect(helperSource).toContain("Official frame source citation");
    expect(helperSource).toContain(
      "Panel construction, door panel type, and profile",
    );
    expect(helperSource).toContain("Finish and sheen");
    expect(helperSource).toContain("Wood species");
    expect(helperSource).toContain("Grain direction");
    expect(helperSource).toContain("Profile notes and description");
    expect(helperSource).toContain("will change");
    expect(batchSource).toContain("style-verified flags stay on each style");
    expect(batchSource).toContain("warehouse ZIPs");
    expect(helperSource).toContain("doorStyles.adminUpdateDoorStyle");
    expect(helperSource).not.toContain("styleVerified:");
    expect(helperSource).not.toContain("warehouseZips:");
  });

  it("lists other styles from the same distributor only, with none preselected", () => {
    const styles = [
      {
        id: 1,
        distributorId: 9,
        ourName: "Skyline White Shaker",
        styleCode: "SW",
      },
      {
        id: 3,
        distributorId: 9,
        ourName: "Skyline Gray Shaker",
        styleCode: "SG",
      },
      {
        id: 2,
        distributorId: 9,
        ourName: "Skyline Navy Shaker",
        styleCode: "SN",
      },
      { id: 8, distributorId: 4, ourName: "Other Line Slab", styleCode: "OLS" },
    ];
    expect(
      siblingDoorStyles(styles, styles[0]).map((style) => style.id),
    ).toEqual([3, 2]);
    expect(toggleSelectedId([], 3, true)).toEqual([3]);
    expect(toggleSelectedId([3], 3, false)).toEqual([]);
    expect(
      doorStyleVendorLabel({
        distributorId: 9,
        supplierBrandName: "Skyline",
        supplierName: "Line A",
      }),
    ).toBe("Skyline");
    expect(
      doorStyleVendorLabel({ distributorId: 9, supplierName: "Line A" }),
    ).toBe("Line A");
    expect(doorStyleVendorLabel({ distributorId: 9 })).toBe("Distributor #9");
  });

  it("copies only the chosen physical spec groups", () => {
    const specs = specValuesFromEditor(skyline());
    expect(defaultSpecGroupIds()).toEqual([
      "frame",
      "panel",
      "finish",
      "wood",
      "grain",
      "notes",
    ]);
    expect(buildSpecPatch(specs, ["frame"])).toEqual({
      railWidth: 2.75,
      stileWidth: 2.75,
      centerRailWidth: 2.75,
      sourceSpecification: "Skyline 2026 Shaker catalog — style code SH-W",
    });
    expect(buildSpecPatch(specs, ["panel", "wood"])).toEqual({
      panelConstruction: "flat",
      doorPanelType: "Recessed shaker panel",
      bevelWidth: null,
      bevelDepth: null,
      insideEdgeProfile: "square",
      drawerFrontType: "five-piece-flat",
      woodSpecies: "Maple",
    });
    const everything = buildSpecPatch(specs, defaultSpecGroupIds());
    expect(Object.keys(everything).sort()).toEqual(
      [...COPYABLE_SPEC_FIELDS].sort(),
    );
    for (const field of NEVER_COPY_FIELDS) {
      expect(everything).not.toHaveProperty(field);
    }
    expect(
      COPYABLE_SPEC_FIELDS.some((field) =>
        (NEVER_COPY_FIELDS as readonly string[]).includes(field),
      ),
    ).toBe(false);
  });

  it("requires an official frame citation before copying a complete frame, and not for other groups", () => {
    const missingCitation = specValuesFromEditor(
      skyline({ sourceSpecification: "  " }),
    );
    const partial = specValuesFromEditor(
      skyline({ stileWidth: "", sourceSpecification: "" }),
    );
    expect(frameCopyBlockReason(missingCitation, ["frame"])).toBe(
      FRAME_CITATION_REQUIRED,
    );
    expect(
      frameCopyBlockReason(missingCitation, ["finish", "notes"]),
    ).toBeNull();
    expect(frameCopyBlockReason(partial, ["frame"])).toBeNull();
    expect(
      frameCopyBlockReason(specValuesFromEditor(skyline()), [
        "frame",
        "finish",
      ]),
    ).toBeNull();
    expect(
      specValuesFromEditor(skyline({ railWidth: "0", stileWidth: "100" })),
    ).toMatchObject({
      railWidth: null,
      stileWidth: null,
    });
  });

  it("saves each checked style with the same patch and reports success and failure counts", async () => {
    const calls: Array<{ id: number } & Record<string, unknown>> = [];
    const patch = buildSpecPatch(specValuesFromEditor(skyline()), [
      "frame",
    ] satisfies SpecGroupId[]);
    const result = await applySpecPatchToStyles(
      async (input) => {
        calls.push(input);
        if (input.id === 3) throw new Error("rejected");
      },
      [3, 5],
      patch,
    );
    expect(result).toEqual({ saved: 1, failed: 1 });
    expect(calls.map((call) => call.id).sort()).toEqual([3, 5]);
    expect(
      calls.every(
        (call) =>
          call.railWidth === 2.75 &&
          !("color" in call) &&
          !("styleVerified" in call),
      ),
    ).toBe(true);
    expect(stylesWillChangeLabel(2)).toBe("2 styles will change");
    expect(stylesWillChangeLabel(1)).toBe("1 style will change");
    expect(specBatchToast(2, 0)).toEqual({
      kind: "success",
      message: "Style updated. Applied specs to 2 other styles.",
    });
    expect(specBatchToast(1, 1)).toEqual({
      kind: "error",
      message: "Style updated. Applied specs to 1 of 2 other styles. 1 failed.",
    });
  });
});
