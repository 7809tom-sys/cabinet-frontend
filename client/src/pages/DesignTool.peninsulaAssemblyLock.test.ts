import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const planCanvas = readFileSync(new URL("../components/design/PlanCanvas.tsx", import.meta.url), "utf8");

describe("peninsula assembly lock", () => {
  it("offers a persistent lock in both the selected peninsula toolbar and attributes", () => {
    expect(designTool).toContain('data-testid="peninsula-assembly-lock"');
    expect(designTool).toContain("Lock peninsula assembly");
    expect(designTool).toContain("togglePeninsulaAssemblyLock");
    expect(designTool).toContain("Peninsula locked — its wall attachment and connected returns are frozen.");
    expect(designTool).toContain('id="peninsula-assembly-lock-toggle"');
    expect(designTool).toContain('aria-label="Lock peninsula assembly against accidental movement"');
  });

  it("blocks accidental attachment movement, return creation, deletion, and saved geometry edits until unlocked", () => {
    expect(designTool).toContain("peninsulaRunAssemblyLocked(run, room)");
    expect(designTool).toContain("This peninsula is locked. Unlock the peninsula before moving its wall attachment.");
    expect(designTool).toContain("Unlock this peninsula before adding a connected return.");
    expect(designTool).toContain("Unlock this peninsula before deleting a run or connected return.");
    expect(designTool).toContain("Unlock this peninsula before changing its attachment, turn, direction, or length.");
    expect(designTool).toContain('const editBlockReason = peninsulaWizardEditBlockReason(room, placed, editingPeninsulaWizardRootId);');
    expect(designTool).toContain('if (editBlockReason) { failWizard(editBlockReason); return; }');
  });

  it("removes the drag affordance and labels the selected run as locked in plan view", () => {
    expect(planCanvas).toContain("const runLocked = peninsulaRunAssemblyLocked(run, room)");
    expect(planCanvas).toContain('runLocked ? "cursor-default" : "cursor-pointer"');
    expect(planCanvas).toContain('!run.parentRunId && !runLocked');
    expect(planCanvas).toContain('runLocked ? " · LOCKED" : ""');
  });
});
