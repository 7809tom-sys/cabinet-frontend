/**
 * Tom's report: the live 3D designer showed TWO approve buttons where there should
 * be one Approve and one Edit.
 *
 * The duplicate was `ApproveDoorButton` rendered with `place="designer"`, which
 * drew BOTH a status badge and an "Approve this door" button side by side. In the
 * Designer that slot is now a single Edit action that opens the door style editor
 * (color and style) and returns to the same design spot. Approving stays inside the
 * style editor, where the door's color and style actually live.
 *
 * This is a source-level guard: the components are wired through tRPC hooks that
 * need the whole app, so the check is that the Designer slot renders no approve
 * control and the shared component renders no approve button when `place` is
 * "designer".
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designToolSource = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const approveButtonSource = readFileSync(
  new URL("../components/admin/ApproveDoorButton.tsx", import.meta.url),
  "utf8",
);

describe("the 3D designer has one Edit control, not two approve buttons", () => {
  it("renders ApproveDoorButton in the Designer only in its edit form", () => {
    const calls = designToolSource.match(/<ApproveDoorButton[\s\S]*?\/>/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      // Every designer placement asks for the edit form and carries a return path,
      // so the person comes back to the same design spot.
      expect(call).toContain('place="designer"');
      expect(call).toContain("returnTo={designerEditReturnUrl}");
    }
  });

  it("never draws the approve status chip and approve button in the designer form", () => {
    // The chip + button pair is exactly what read as two approve buttons.
    // Everything between the designer branch opening and its `) : (` divider is
    // the designer form. The approve chip and button must not be in it.
    const start = approveButtonSource.indexOf('{place === "designer" ? (');
    const divider = approveButtonSource.indexOf(") : (", start);
    expect(start).toBeGreaterThan(-1);
    expect(divider).toBeGreaterThan(start);
    const designerBranch = approveButtonSource.slice(start, divider);
    expect(designerBranch).toContain("DoorStyleEditButton");
    expect(designerBranch).not.toContain("Approve this door");
    expect(designerBranch).not.toContain('data-testid="approve-door-status"');
  });

  it("keeps the real approval control in the style editor", () => {
    // Approving belongs where the door's color and style live.
    expect(approveButtonSource).toContain("Approve again");
    expect(approveButtonSource).toContain("Approve this door");
    expect(approveButtonSource).toContain("approve.mutateAsync");
  });

  it("has exactly one door-edit entry point in the designer toolbar area", () => {
    // One control, reachable from the selected cabinet's header.
    expect(designToolSource.match(/data-testid="selected-cabinet-edit-door-style"/g) ?? []).toHaveLength(0);
    expect(designToolSource).toContain("<DoorStyleEditButton");
    expect(designToolSource).toContain('testId="selected-cabinet-edit-door-style"');
  });
});
