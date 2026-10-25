import { describe, expect, it } from "vitest";
import { CABINET_ATTRIBUTES_DIALOG_CLASS } from "./cabinetAttributesDialogLayout";

describe("Cabinet Attributes dialog responsive layout", () => {
  it("keeps a compact mobile width while allowing a wide laptop workspace", () => {
    expect(CABINET_ATTRIBUTES_DIALOG_CLASS).toContain("max-w-[440px]");
    expect(CABINET_ATTRIBUTES_DIALOG_CLASS).toContain("sm:max-w-[760px]");
    expect(CABINET_ATTRIBUTES_DIALOG_CLASS).toContain("lg:max-w-[920px]");
  });

  it("prevents horizontal scrolling while keeping long forms vertically usable", () => {
    expect(CABINET_ATTRIBUTES_DIALOG_CLASS).toContain("overflow-x-hidden");
    expect(CABINET_ATTRIBUTES_DIALOG_CLASS).toContain("overflow-y-auto");
  });
});
