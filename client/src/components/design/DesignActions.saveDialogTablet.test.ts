import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DesignActions.tsx", import.meta.url), "utf8");

describe("Save Plan dialog tablet layout", () => {
  it("bounds the dialog to the viewport and gives the form its own touch-scroll region", () => {
    expect(source).toContain('h-[min(92dvh,900px)]');
    expect(source).toContain('max-h-[calc(100dvh-1rem)]');
    expect(source).toContain('min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain');
    expect(source).toContain('[touch-action:pan-y]');
  });

  it("keeps the action footer outside the scrolling form", () => {
    expect(source).toContain('DialogHeader className="shrink-0"');
    expect(source).toContain('DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-border pt-3');
    expect(source).toContain('t("dt_act_save_design")');
  });
});
