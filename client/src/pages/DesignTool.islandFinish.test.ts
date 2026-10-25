import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("DesignTool island finish routing", () => {
  it("routes Island setup through valid finish options and the island-only scope", () => {
    expect(source).toContain("cabinetFinishOptions={islandCabinetFinishOptions}");
    expect(source).toContain('applyCabinetFinishScope(resized.placed, nextIsland, styleId, draft.cabinetStyleId ?? styleId, "island")');
    expect(source).toContain("if (islandForPlacement.cabinetStyleId != null) newCab.styleId = islandForPlacement.cabinetStyleId");
  });

  it("offers three explicit color scopes when perimeter Apply to all has an island", () => {
    expect(source).toContain("Where should this cabinet color be applied?");
    expect(source).toContain('data-testid="apply-finish-non-island-only"');
    expect(source).toContain('commitSelectedFinishScope(finishApplyScopePrompt.targetStyleId, "non-island")');
    expect(source).toContain('data-testid="apply-finish-include-island"');
    expect(source).toContain('commitSelectedFinishScope(finishApplyScopePrompt.targetStyleId, "all")');
    expect(source).toContain('data-testid="apply-finish-island-only"');
    expect(source).toContain('commitSelectedFinishScope(finishApplyScopePrompt.targetStyleId, "island")');
    expect(source).toContain("Island cabinets only");
  });

  it("keeps a dedicated bottom cancel action and explains every color scope with an accessible tooltip", () => {
    expect(source).toContain('data-testid="cancel-finish-apply-scope"');
    expect(source).toContain('className="w-full">Cancel</AlertDialogCancel>');
    expect(source).toContain("Changes only cabinets outside the island. Island cabinet color stays unchanged.");
    expect(source).toContain("Changes every cabinet in the design, including all island cabinets.");
    expect(source).toContain("Changes only island cabinets. All cabinets outside the island keep their current color.");
    expect(source).toContain('aria-label="Non-island cabinets only: change every cabinet outside the island; island cabinet color stays unchanged"');
    expect(source).toContain('aria-label="Include island cabinets: change every cabinet in the design, including the island"');
    expect(source).toContain('aria-label="Island cabinets only: change island cabinet color; all non-island cabinet color stays unchanged"');
  });
});
