import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("DesignTool peninsula settings dialog", () => {
  it("keeps save and cancel actions reachable inside a viewport-bounded modal", () => {
    expect(source).toContain('data-testid="peninsula-settings-dialog"');
    expect(source).toContain("max-h-[calc(100dvh-1rem)]");
    expect(source).toContain("overflow-hidden p-0 sm:max-w-lg");
    expect(source).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain");
    expect(source).toContain('data-testid="peninsula-settings-actions"');
    expect(source).toContain("shrink-0 border-t bg-background");
    expect(source).toContain(">Save wall<");
    expect(source).toContain(">Cancel<");
  });
});
