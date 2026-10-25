import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/design/PlanCanvas.tsx"), "utf8");

describe("Peninsula Wizard edit badge", () => {
  it("marks every owned root or connected return with an accessible editable badge", () => {
    expect(source).toContain("const wizardRootId = peninsulaRootRunId(run, room);");
    expect(source).toContain("const wizardEditable = wizardRoot?.wizardRecipe?.schemaVersion === 1;");
    expect(source).toContain('data-testid="peninsula-wizard-built-badge"');
    expect(source).toContain("WIZARD-BUILT · EDITABLE");
    expect(source).toContain("Wizard-built and editable in Peninsula Wizard.");
  });
});
