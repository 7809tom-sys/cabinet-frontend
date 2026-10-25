import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/admin/CabinetConfigAdmin.tsx"), "utf8");

describe("Cabinet Config editor viewport layout", () => {
  it("bounds the editor to the viewport while preserving a flex layout", () => {
    expect(source).toContain("h-[min(88dvh,52rem)]");
    expect(source).toContain("max-h-[calc(100dvh-1rem)]");
    expect(source).toContain("flex-col overflow-hidden");
  });

  it("keeps the header and footer fixed while each tab content area scrolls internally", () => {
    expect(source).toContain('DialogHeader className="shrink-0"');
    expect(source).toContain('className="flex min-h-0 w-full flex-1 flex-col"');
    expect(source).toContain("flex-1 space-y-5 overflow-y-auto");
    expect(source).toContain("shrink-0 flex-row justify-end gap-2 border-t");
  });
});
