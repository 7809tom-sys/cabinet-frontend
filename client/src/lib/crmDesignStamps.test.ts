import { describe, expect, it } from "vitest";
import { CRM_DESIGN_STAMP_LABELS, designSavedTitle, formatDesignSavedDate } from "./crmDesignStamps";

describe("crmDesignStamps", () => {
  it("formats a stamped date and shows a dash when missing or invalid", () => {
    expect(formatDesignSavedDate("2026-11-23T23:21:00Z")).toBe(new Date("2026-11-23T23:21:00Z").toLocaleDateString("en-US"));
    expect(formatDesignSavedDate(null)).toBe("—");
    expect(formatDesignSavedDate(undefined)).toBe("—");
    expect(formatDesignSavedDate("not a date")).toBe("—");
    expect(designSavedTitle(null)).toBe("");
  });

  it("has English and Spanish labels", () => {
    expect(CRM_DESIGN_STAMP_LABELS.first.en).toBe("First design saved");
    expect(CRM_DESIGN_STAMP_LABELS.last.en).toBe("Last design saved");
    expect(CRM_DESIGN_STAMP_LABELS.first.es).toBeTruthy();
  });
});
